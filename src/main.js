import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import bucketModel from "../assets/woodenbucketa.glb";

// Основные переменные
let camera, scene, renderer, composer, outlinePass, RAPIER;
let steamParticles = [];
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let euler = new THREE.Euler(0, 0, 0, 'YXZ'); // Для вычисления направления камеры
let PI_2 = Math.PI / 2;
const mouseSensitivity = 0.002;
const touchSensitivity = 0.003;
let isLocked = false;
let timer = new THREE.Timer();
timer.connect(document);
const enableLog = false;
let log_values = new Map();

let rapierWorld = null;
let playerBody = null;
let playerCollider = null;
const uninitializedDynamicBodies = new Map();
const dynamicBodies = new Map(); // Связь Three.js объектов с их физическими телами
let rapierInitialized = false;
let rapierDebugRenderer

// Создание загрузчика GLTF
const gltfLoader = new GLTFLoader();

let touchActivity = {
    inProgress: false,
    touchId: undefined,
    x: undefined,
    y: undefined,
}

async function initRapier() {
    RAPIER = await import('@dimforge/rapier3d');
    
    // Создаём физический мир с гравитацией
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    rapierWorld = new RAPIER.World(gravity);
    
    console.log('Rapier physics initialized');
    return true;
}
// Вспомогательная функция создания вектора Rapier
function rapierVec(x, y, z) {
    return { x, y, z };
}

// Класс для выбора объекта 
class ObjectSelector {
  constructor() {
    this.enabled = false;
    this.selected = undefined;
    this.raycaster = new THREE.Raycaster();
    this.pickedUp = undefined;
    this.pickedRotating = undefined;
    this.verticalRotationOn = true;
    this.horizontalRotationOn = true;

    
    // Константы
    this.objectMoveSpeed = 8.0;
    this.objectHoldMinDistance = 0.5;
    this.objectHoldMaxDistance = 5;
    this.objectHoldDefaultDistance = 2;
    this.objectRotateSpeed = 8.0;
    
    // Переменные
    this.objectHoldDistance = this.objectHoldDefaultDistance;
    this.objectRotation = undefined;

  }
  getLookedAtObject(normalizedPosition = {x: 0, y: 0}) {
    camera.updateMatrixWorld();
    this.raycaster.setFromCamera(normalizedPosition, camera);
    const intersectedObjects = this.raycaster.intersectObjects(scene.children);
    // Возвращаем пустое значение, если не было объектов
    if (!intersectedObjects.length) return undefined;
    // Первый ближайший объект, если есть пересечения
    const intersectedObject = intersectedObjects[0].object;
    // Взаимодействие не всегда с тем, с которым произошло пересечение, поэтому проходим по interactionObject атрибуту пока он указан до родителя
    // Необходимо для правильного выбора объекта в случае загруженных из gltf файлов (при загрузке для каждого указать это свойство правильно)
    let interactionObject = intersectedObject;
    while (Object.hasOwn(interactionObject, 'interactionObject')) interactionObject = interactionObject.interactionObject;
    // Проверка, что объект интерактивный, закомментировать, чтобы можно было выбирать любые объекты
    if (!(interactionObject.interactable ?? false)) return undefined;

    return interactionObject;
  }
  update_outlined_object() {
    if (this.selected) outlinePass.selectedObjects = [this.selected];
    else outlinePass.selectedObjects = []
  }
  select(normalizedPosition = {x: 0, y: 0}) {
    const lookedAtObject = this.getLookedAtObject(normalizedPosition);
    if (lookedAtObject === this.selected) return;
    this.selected = lookedAtObject;
    this.pickedUp = false;
    this.pickedRotating = false;
    this.update_outlined_object();
  }
  deselect() {
    this.selected = undefined;
    this.pickedUp = undefined;
    this.pickedRotating = undefined;
    this.objectRotation = undefined;
    this.update_outlined_object();
  }
  pickUp() {
    if (!this.selected) return;
    this.pickedUp = true;
    this.objectHoldDistance = this.objectHoldDefaultDistance;

    // console.log('picked up', this.selected.uuid);
    // === Отключаем физику при подборе ===
    const physicsData = dynamicBodies.get(this.selected.uuid);
    if (physicsData) {
        // Переключаем в кинематический режим для управления вручную
        physicsData.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
        physicsData.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        physicsData.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        // console.log('disabled physics', this.selected.uuid);
    }

    camera.updateMatrixWorld();
    this.selected.updateMatrixWorld();
    // Получаем кватернион камеры
    const cameraQuaternion = new THREE.Quaternion();
    camera.getWorldQuaternion(cameraQuaternion);

    // R = C⁻¹ × O  — смещение относительно камеры как кватернион
    // Для того, чтобы объект поворачивался вверх/вниз при взгляде камеры выше/ниже
    // Для работы требуется, чтобы был согласованный исходный квартенион в moveSelectedObjectToCamera
    // this.objectRotation = cameraQuaternion.clone().invert().multiply(this.selected.quaternion.clone());

    // Вектор "вперёд" в локальных координатах камеры (negative Z)
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(cameraQuaternion);
    
    // Проецируем на горизонтальную плоскость XZ
    forward.y = 0;
    forward.normalize();
    
    // Вычисляем Y-угол: atan2(x, z) работает корректно во всех квадрантах
    const yAngle = Math.atan2(forward.x, forward.z);
    const cameraYQuaternion = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        yAngle
    );
    
    // R = (C_y)⁻¹ × O — смещение относительно Y-вращения камеры
    this.objectRotation = cameraYQuaternion.clone().invert().multiply(this.selected.quaternion.clone());
  }
  changeObjectHoldDistance(delta) {
    if (!this.pickedUp) return;
    this.objectHoldDistance += 0.001*delta;
    if (this.objectHoldDistance < this.objectHoldMinDistance) this.objectHoldDistance = this.objectHoldMinDistance;
    if (this.objectHoldDistance > this.objectHoldMaxDistance) this.objectHoldDistance = this.objectHoldMaxDistance;
  }
  putDown() {
    if (!this.selected) return;
    this.pickedUp = false;
    // === Включаем физику при отпускании ===
    const physicsData = dynamicBodies.get(this.selected.uuid);
    if (physicsData) {
        // Возвращаем динамический режим
        physicsData.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        // console.log('restored physics')
    }

  }
  pickUpToggle() {
    if (!this.pickedUp) this.pickUp();
    else this.putDown();
  }
  rotationStart() {
    this.pickedRotating = true;
  }
  rotationStop() {
    this.pickedRotating = false;
  }
  toggleVerticalRotation() {
    if (!this.enabled) return;
    this.verticalRotationOn = !this.verticalRotationOn;
  }
  toggleHorizontalRotation() {
    if (!this.enabled) return;
    this.horizontalRotationOn = !this.horizontalRotationOn;
  }
  rotate(movementX, movementY, sensitivity) {
    if (!this.objectRotation) return;
    if (movementX == 0 && movementY == 0) return;

    // Создаём кватернионы приращения вокруг локальных осей камеры
    const deltaY = new THREE.Quaternion()
    if (this.horizontalRotationOn) {
        deltaY.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), 
            movementX * sensitivity
        );
    }
    const deltaX = new THREE.Quaternion()
    if (this.verticalRotationOn) {
        deltaX.setFromAxisAngle(
            new THREE.Vector3(1, 0, 0), 
            -movementY * sensitivity
        );
    }
    
    // Объединяем (Y → X для естественного порядка: yaw, затем pitch)
    const deltaRotation = new THREE.Quaternion().copy(deltaY).multiply(deltaX);
    
    // Вращаем в пространстве камеры: R' = δ × R (умножение слева = premultiply)
    this.objectRotation.premultiply(deltaRotation);
  }
  enable() {
    this.enabled = true;
    this.select();
  }
  disable() {
    this.deselect();
    this.enabled = false;
  }
  toggle() {
    if (this.enabled) this.disable();
    else this.enable();
  }
  delete() {
    if (!this.enabled || !this.selected) return;
    this.selected.parent.remove(this.selected);
    this.deselect();
  }
  moveSelectedObjectToCamera(delta) {
    if (!this.selected) return;

    camera.updateMatrixWorld();
    // Получаем позицию камеры и направление взгляда
    const cameraPosition = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    const cameraQuaternion = new THREE.Quaternion();
    // Получаем мировую позицию камеры
    camera.getWorldPosition(cameraPosition);
    // Получаем направление взгляда камеры
    camera.getWorldDirection(cameraDirection);
    camera.getWorldQuaternion(cameraQuaternion);

    // Сразу перемащаем в позицию камеры
    const targetPosition = cameraPosition.add(cameraDirection.multiplyScalar(this.objectHoldDistance));

    // Для того, чтобы объект поворачивался вверх/вниз при взгляде камеры выше/ниже
    // Для работы требуется, чтобы был согласованный исходный квартенион в pickUp
    // Перемещаем запрошенный поворот объекта в позицию камеры
    // const targetQuaternion = cameraQuaternion.clone().multiply(this.objectRotation);

    // Извлекаем Y-вращение камеры через вектор направления
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(cameraQuaternion);
    forward.y = 0;
    forward.normalize();
    
    const yAngle = Math.atan2(forward.x, forward.z);
    const cameraYQuaternion = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        yAngle
    );
    
    // targetQuaternion = C_y × R
    const targetQuaternion = cameraYQuaternion.clone().multiply(this.objectRotation);

    this.selected.updateMatrixWorld();
    

    // Плавное перемещение
    if (this.selected.position.distanceTo(targetPosition) < 0.01) {
        this.selected.position.copy(targetPosition);
    } else {
        this.selected.position.lerp(targetPosition, this.objectMoveSpeed*delta);
    }
    // Плавное перемещение
    if (this.selected.quaternion.angleTo(targetQuaternion) < 0.01) {
        this.selected.quaternion.copy(targetQuaternion);
    } else {
        this.selected.quaternion.slerp(targetQuaternion, this.objectRotateSpeed*delta);
    }
  }
  log_object_parameters() {
    if (!this.enabled || !this.selected) return;
    console.log(this.selected);
    console.log('Position: ', this.selected.getWorldPosition(new THREE.Vector3()));
    console.log('Rotation: ', this.selected.getWorldDirection(new THREE.Vector3()));
    console.log('Quaternion: ', this.selected.getWorldQuaternion(new THREE.Quaternion()));
    const bbox = new THREE.Box3().setFromObject(this.selected)
    console.log('Bounding box: ', bbox.min, bbox.max, new THREE.Vector3().copy(bbox.max).sub(bbox.min));
  }
  update(delta) {
    if (!this.enabled) return;
    if (this.pickedUp) {
        this.moveSelectedObjectToCamera(delta);
        return;
    }
    this.select();
  }
}

const objectSelector = new ObjectSelector();

class RapierDebugRenderer {
  mesh
  world
  enabled = true

  constructor(scene, world) {
    this.world = world
    this.mesh = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: true }))
    this.mesh.frustumCulled = false
    scene.add(this.mesh)
  }

  update() {
    if (this.enabled) {
      const { vertices, colors } = this.world.debugRender()
      this.mesh.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      this.mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
      this.mesh.visible = true
    } else {
      this.mesh.visible = false
    }
  }
}

// Инициализация сцены
async function init() {
    // === Сначала инициализируем Rapier ===
    try {
        rapierInitialized = await initRapier();
    } catch (error) {
        console.error('Ошибка инициализации Rapier:', error);
        // Продолжаем без физики
    }


    // Сцена
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a0a05, 0.04);
    scene.background = new THREE.Color(0x966b4b);

    // Камера (вид от первого лица)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.7, 0);

    // Рендерер
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    // renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    document.body.appendChild(renderer.domElement);
    
    composer = new EffectComposer( renderer );
    const renderPass = new RenderPass( scene, camera );
    composer.addPass( renderPass );
    outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
    composer.addPass( outlinePass );
    const outputPass = new OutputPass()
    composer.addPass( outputPass );


    // Создание парилки
    createSauna();
    createStove();
    createBench();

    // === Создаём физические коллизии для статических объектов ===
    if (rapierInitialized) {
        createAllStaticColliders();
        createPlayerPhysics();
        // Установка начальной позиции игрока
        if (playerBody) {
            // Стартовая позиция — в центре парилки
            const startPos = { x: 0, y: 0.85, z: 0 };
            playerBody.setTranslation(startPos, true);
            
            // Начальная скорость ноль
            playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
            
            console.log('Player spawned at', startPos);
        }
        // rapierDebugRenderer = new RapierDebugRenderer(scene, rapierWorld)
    }

    createAccessories();
    createLighting();

    if (enableLog) createLog();

    // События управления
    setupControls();

    // Обработка изменения размера окна
    window.addEventListener('resize', onWindowResize);

    animate();
}

function loadGLBModel(modelPath, position = new THREE.Vector3(0, 0, 0), 
                      rotation = new THREE.Euler(0, 0, 0), 
                      scale = new THREE.Vector3(1, 1, 1)) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;
                
                // Применяем трансформации
                model.position.copy(position);
                model.rotation.copy(rotation);
                model.scale.copy(scale);
                
                // Включаем тени для всех меши в модели
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                // Добавляем модель в сцену
                scene.add(model);
                
                console.log(`Модель ${modelPath} успешно загружена`);
                resolve(model);
            },
            // (progress) => {
            //     // Прогресс загрузки
            //     const percentLoaded = Math.round((progress.loaded / progress.total) * 100);
            //     console.log(`Загрузка: ${percentLoaded}%`);
            // },
            undefined,
            (error) => {
                console.error(`Ошибка загрузки модели ${modelPath}:`, error);
                reject(error);
            }
        );
    });
}

// Создание текстуры дерева
function createWoodTexture(baseColor, darken = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Базовый цвет
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    // Волокна дерева
    for (let i = 0; i < 50; i++) {
        ctx.strokeStyle = `rgba(${30 + Math.random() * 40}, ${15 + Math.random() * 30}, ${5}, ${0.1 + Math.random() * 0.15})`;
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        let y = Math.random() * 512;
        ctx.moveTo(0, y);
        for (let x = 0; x < 512; x += 20) {
            y += (Math.random() - 0.5) * 4;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Сучки
    for (let i = 0; i < 5; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const r = 5 + Math.random() * 10;
        ctx.fillStyle = `rgba(40, 20, 10, 0.3)`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);

    return texture;
}

function createMeshTexture(baseColor, meshSize = 10) {
    const canvas = document.createElement('canvas');
    const textureSize = meshSize*10;
    canvas.width = textureSize;
    canvas.height = textureSize;
    const ctx = canvas.getContext('2d');


    ctx.strokeStyle = baseColor;
    ctx.lineWidth = Math.max(1, meshSize/10);
    for (let y = 0; y < textureSize; y += meshSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(textureSize-y-1, textureSize-1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(textureSize-1, y);
        ctx.lineTo(y-1, textureSize-1);
        ctx.stroke();
    }
    for (let x = meshSize; x < textureSize; x += meshSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(textureSize-1, textureSize-x-1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(textureSize-x, 0);
        ctx.lineTo(0, textureSize-x-1);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 1);
    return texture;
}

// Создание парилки
function createSauna() {
    const wallTexture = createWoodTexture('#8B4513');
    const ceilingTexture = createWoodTexture('#a0522d');
    const floorTexture = createWoodTexture('#5a3520');
    const doorTexture = createWoodTexture('#4b2d1bff');

    // Размеры парилки
    const width = 6;
    const height = 3;
    const depth = 5;

    // Пол
    const floorGeometry = new THREE.PlaneGeometry(width, depth);
    const floorMaterial = new THREE.MeshStandardMaterial({
        map: floorTexture,
        roughness: 0.9,
        metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Потолок
    const ceilingGeometry = new THREE.PlaneGeometry(width, depth);
    const ceilingMaterial = new THREE.MeshStandardMaterial({
        map: ceilingTexture,
        roughness: 0.8,
        metalness: 0.1
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.position.y = height;
    ceiling.rotation.x = Math.PI / 2;
    ceiling.receiveShadow = true;
    ceiling.castShadow = true;
    scene.add(ceiling);

    // Стены
    const wallMaterial = new THREE.MeshStandardMaterial({
        map: wallTexture,
        roughness: 0.85,
        metalness: 0.05
    });

    // Задняя стена
    const backWall = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        wallMaterial
    );
    backWall.position.set(0, height / 2, -depth / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Левая стена
    const leftWall = new THREE.Mesh(
        new THREE.PlaneGeometry(depth, height),
        wallMaterial
    );
    leftWall.position.set(-width / 2, height / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Правая стена
    const rightWall = new THREE.Mesh(
        new THREE.PlaneGeometry(depth, height),
        wallMaterial
    );
    rightWall.position.set(width / 2, height / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    rightWall.castShadow = true;
    scene.add(rightWall);

    // Передняя стена с дверью
    const frontWallGroup = new THREE.Group();

    // Верхняя часть над дверью
    const topPart = new THREE.Mesh(
        new THREE.PlaneGeometry(width, 0.8),
        wallMaterial
    );
    topPart.position.set(0, height - 0.4, depth / 2);
    topPart.rotation.y = Math.PI;
    topPart.receiveShadow = true;
    topPart.castShadow = true;
    frontWallGroup.add(topPart);

    // Левая часть стены
    const leftFrameOffset = 1.2
    const leftPart = new THREE.Mesh(
        new THREE.PlaneGeometry(width / 2 + leftFrameOffset, height - 0.8),
        wallMaterial
    );
    leftPart.position.set(leftFrameOffset/2 - width/4, (height - 0.8) / 2, depth / 2);
    leftPart.rotation.y = Math.PI;
    leftPart.receiveShadow = true;
    leftPart.castShadow = true;
    frontWallGroup.add(leftPart);
    
    const rightFrameOffset = 2.4
    // Правая часть стены
    const rightPart = new THREE.Mesh(
        new THREE.PlaneGeometry(width / 2 - rightFrameOffset, height - 0.8),
        wallMaterial
    );

    rightPart.position.set(rightFrameOffset/2 + width/4, (height - 0.8) / 2, depth / 2);
    rightPart.rotation.y = Math.PI;
    rightPart.receiveShadow = true;
    rightPart.castShadow = true;
    frontWallGroup.add(rightPart);

    // Рама двери
    const doorFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, metalness: 0.1 });
    const frameThickness = 0.08;

    // Вертикальные части рамы
    const frameGeo = new THREE.BoxGeometry(frameThickness, 2.2, frameThickness);
    const leftFrame = new THREE.Mesh(frameGeo, doorFrameMaterial);
    leftFrame.position.set(leftFrameOffset, 1.1, depth / 2);
    leftFrame.receiveShadow = true;
    // leftFrame.castShadow = true;
    frontWallGroup.add(leftFrame);
    
    const rightFrame = new THREE.Mesh(frameGeo, doorFrameMaterial);
    rightFrame.position.set(rightFrameOffset, 1.1, depth / 2);
    rightFrame.receiveShadow = true;
    // rightFrame.castShadow = true;
    frontWallGroup.add(rightFrame);
    
    // Горизонтальная часть рамы
    const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry((rightFrameOffset-leftFrameOffset) + frameThickness * 2, frameThickness, frameThickness),
        doorFrameMaterial
    );
    topFrame.position.set((rightFrameOffset+leftFrameOffset)/2, 2.2, depth / 2);
    topFrame.receiveShadow = true;
    // topFrame.castShadow = true;
    frontWallGroup.add(topFrame);

    scene.add(frontWallGroup);

    // Дверь (полупрозрачная)
    const doorGeometry = new THREE.PlaneGeometry(rightFrameOffset-leftFrameOffset, 2.2);
    // const doorMaterial = new THREE.MeshStandardMaterial({
    //     color: 0x654321,
    //     transparent: true,
    //     opacity: 0.8,
    //     roughness: 0.5,
    //     metalness: 0.2
    // });
    // const door = new THREE.Mesh(doorGeometry, doorMaterial);
    const doorMaterial = new THREE.MeshStandardMaterial({
        map: doorTexture,
        roughness: 0.9,
        metalness: 0.05
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set((rightFrameOffset+leftFrameOffset)/2, 1.1, depth / 2 - 0.01);
    door.rotation.y = Math.PI;
    door.receiveShadow = true;
    // door.castShadow = true;
    scene.add(door);

    // Дверная ручка
    const handleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8);
    // const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.4, metalness: 0.8 });
    const handle = new THREE.Mesh(handleGeometry, doorFrameMaterial);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(rightFrameOffset-0.18, 1.1, depth / 2 - 0.05);
    handle.receiveShadow = true;
    scene.add(handle);
}

// Создание пара
function createSteam(group, interactionObject) {
    const steamMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15,
        depthWrite: false
    });

    // Начальное облако пара
    for (let i = 0; i < 25; i++) {
        createSteamParticle(steamMaterial, group, interactionObject);
    }
}

function createSteamParticle(material, group, interactionObject) {
    const size = 0.2 + Math.random() * 0.2;
    const geometry = new THREE.CircleGeometry(size, 12);
    const steam = new THREE.Mesh(geometry, material.clone());
    
    steam.position.set(
        -2.3 + (Math.random() - 0.5) * 0.5,
        1.3 + Math.random() * 0.3,
        -2 + (Math.random() - 0.5) * 0.5
    );
    
    steam.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    
    steam.userData = {
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            0.3 + Math.random() * 0.3,
            (Math.random() - 0.5) * 0.3
        ),
        life: 0,
        maxLife: 3 + Math.random() * 2
    };
    steam.interactionObject = interactionObject
    group.add(steam);
    steamParticles.push(steam);
}

function animateSteam(delta) {
    steamParticles.forEach(steam => {
        steam.position.add(steam.userData.velocity.clone().multiplyScalar(delta));
        steam.userData.life += delta;
        // Затухание
        steam.material.opacity = 0.15 * (1 - steam.userData.life / steam.userData.maxLife);
        // Растягивание пара
        steam.scale.setScalar(1 + steam.userData.life * 0.3);
        
        // Удаление старого пара и создание нового
        if (steam.userData.life > steam.userData.maxLife) {
            steam.position.set(
                -2.3 + (Math.random() - 0.5) * 0.5,
                1.3 + Math.random() * 0.3,
                -2 + (Math.random() - 0.5) * 0.5
            );
            steam.userData.life = 0;
            steam.userData.velocity.set(
                (Math.random() - 0.5) * 0.3,
                0.3 + Math.random() * 0.3,
                (Math.random() - 0.5) * 0.3
            );
            steam.material.opacity = 0.15;
            steam.scale.setScalar(1);
        }
    })
}

// Создание печи-каменки
function createStove() {
    const stoveGroup = new THREE.Group();
    const stoveInnerGroup = new THREE.Group();

    // Основание печи
    const baseGeometry = new THREE.BoxGeometry(0.8, 0.9, 0.6);
    const stoveMaterial = new THREE.MeshStandardMaterial({
        color: 0x252525,
        roughness: 0.6,
        metalness: 0.9
    });
    const base = new THREE.Mesh(baseGeometry, stoveMaterial);
    base.position.set(-2.3, 0.45, -2);
    base.castShadow = true;
    base.receiveShadow = true;
    base.interactionObject = stoveGroup;
    stoveInnerGroup.add(base);

    // Топка (с дверцей)
    const doorGeometry = new THREE.BoxGeometry(0.35, 0.25, 0.05);
    const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.5,
        metalness: 0.95
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(-2.3, 0.35, -1.67);
    door.interactionObject = stoveGroup;
    stoveInnerGroup.add(door);

    // Свечение из топки
    const glowGeometry = new THREE.PlaneGeometry(0.3, 0.2);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.8
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(-2.3, 0.35, -1.66);
    glow.interactionObject = stoveGroup;
    stoveInnerGroup.add(glow);


    // Контейнер для камней
    const meshTexture = createMeshTexture('#302c29ff');
    const containerMaterial = new THREE.MeshStandardMaterial({
        map: meshTexture,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        roughness: 0.6,
        metalness: 0.9
    });
    const stonesContainerGeometry = new THREE.CylinderGeometry(0.45, 0.3, 0.3, 24, 1, true);
    const stonesContainer = new THREE.Mesh(stonesContainerGeometry, containerMaterial);
    stonesContainer.position.set(-2.3, 1.1, -2);
    stonesContainer.castShadow = true;
    stonesContainer.interactionObject = stoveGroup;
    stoveInnerGroup.add(stonesContainer);

    // Камни
    for (let i = 0; i < 25; i++) {
        const stoneGeometry = new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.03, 0);
        const stoneMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.05 + Math.random() * 0.05, 0.2, 0.25 + Math.random() * 0.15),
            roughness: 0.8,
            metalness: 0.1
        });
        const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
        // const angle = Math.random() * Math.PI * 2;
        // const radius = Math.random() * 0.38;
        // stone.position.set(
        //     -2.3 + Math.cos(angle) * radius,
        //     1.0 + Math.random() * 0.3,
        //     -2 + Math.sin(angle) * radius
        // );
        const height = 0.3/25*(i+1);
        const angle = 159*Math.PI/25*(i+5);
        const radius = 0.25;
        stone.position.set(
            -2.3 + Math.cos(angle) * radius,
            1.0 + height,
            -2 + Math.sin(angle) * radius
        );
        stone.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        stone.castShadow = true;
        stone.interactionObject = stoveGroup;
        stoveInnerGroup.add(stone);
    }

    // Труба
    const pipeGeometry = new THREE.CylinderGeometry(0.12, 0.15, 2, 12);
    const pipe = new THREE.Mesh(pipeGeometry, stoveMaterial);
    pipe.position.set(-2.3, 2.05, -2);
    pipe.castShadow = true;
    pipe.interactionObject = stoveGroup;
    stoveInnerGroup.add(pipe);

    
    // Свет от печи
    const stoveLight = new THREE.PointLight(0xff6622, 1.5, 4);
    stoveLight.position.set(-2.3, 1.5, -2);
    stoveLight.castShadow = true;
    stoveInnerGroup.add(stoveLight);

    // Отражённый свет от горячих камней
    const stoneGlow = new THREE.PointLight(0xff6633, 0.4, 2);
    stoneGlow.position.set(-2.3, 1.3, -2);
    stoveInnerGroup.add(stoneGlow);

    createSteam(stoveInnerGroup, stoveGroup);

    const bbox = new THREE.Box3().setFromObject(stoveInnerGroup);
    stoveInnerGroup.position.set(-(bbox.min.x + bbox.max.x) / 2, -(bbox.min.y + bbox.max.y) / 2, -(bbox.min.z + bbox.max.z) / 2);
    stoveGroup.add(stoveInnerGroup);
    stoveGroup.position.set((bbox.min.x + bbox.max.x) / 2, (bbox.min.y + bbox.max.y) / 2, (bbox.min.z + bbox.max.z) / 2);
    stoveGroup.interactable = true;
    scene.add(stoveGroup);
}

// Создание лавок
function createBench() {
    const benchTexture = createWoodTexture('#a0522d');
    const benchMaterial = new THREE.MeshStandardMaterial({
        map: benchTexture,
        roughness: 0.7,
        metalness: 0.05
    });

    // Нижняя лавка
    const bench1Group = new THREE.Group();
    const bench1InnerGroup = new THREE.Group();
    
    // Сиденье
    const seatGeometry = new THREE.BoxGeometry(1.8, 0.08, 0.6);
    const seat1 = new THREE.Mesh(seatGeometry, benchMaterial);
    seat1.position.set(0, 0.6, -1.4);
    seat1.castShadow = true;
    seat1.receiveShadow = true;
    seat1.interactionObject = bench1Group;
    bench1InnerGroup.add(seat1);

    // Ножки
    const legGeometry = new THREE.BoxGeometry(0.08, 0.6, 0.08);
    const positions = [[-0.8, 0.3, -1.7], [-0.8, 0.3, -1.15], [0.8, 0.3, -1.7], [0.8, 0.3, -1.15]];
    positions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, benchMaterial);
        leg.position.set(...pos);
        leg.castShadow = true;
        leg.receiveShadow = true;
        leg.interactionObject = bench1Group;
        bench1InnerGroup.add(leg);
    });

    // Спинка
    const backGeometry = new THREE.BoxGeometry(1.8, 0.5, 0.05);
    const back1 = new THREE.Mesh(backGeometry, benchMaterial);
    back1.position.set(0, 0.85, -1.725);
    back1.castShadow = true;
    back1.receiveShadow = true;
    back1.interactionObject = bench1Group;
    bench1InnerGroup.add(back1);

    // Верхняя лавка (полка)
    const seat2 = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.08, 0.8),
        benchMaterial
    );
    seat2.position.set(0, 1.1, -2.1);
    seat2.castShadow = true;
    seat2.receiveShadow = true;
    seat2.interactionObject = bench1Group;
    bench1InnerGroup.add(seat2);

    // Опоры
    const supportGeometry = new THREE.BoxGeometry(0.08, 1.05, 0.08);
    const supportPositions = [[-0.8, 0.525, -2.45], [0.8, 0.525, -2.45]];
    supportPositions.forEach(pos => {
        const support = new THREE.Mesh(supportGeometry, benchMaterial);
        support.position.set(...pos);
        support.castShadow = true;
        support.receiveShadow = true;
        support.interactionObject = bench1Group;
        bench1InnerGroup.add(support);
    });

    var bbox = new THREE.Box3().setFromObject(bench1InnerGroup);
    bench1InnerGroup.position.set(-(bbox.min.x + bbox.max.x) / 2, -(bbox.min.y + bbox.max.y) / 2, -(bbox.min.z + bbox.max.z) / 2);
    bench1Group.add(bench1InnerGroup);
    bench1Group.position.set((bbox.min.x + bbox.max.x) / 2, (bbox.min.y + bbox.max.y) / 2, (bbox.min.z + bbox.max.z) / 2);
    bench1Group.interactable = true;
    scene.add(bench1Group);
    uninitializedDynamicBodies.set('bench1', bench1Group);

    // Лавка слева
    const tmpGroup = new THREE.Group();
    const leftBenchGroup = new THREE.Group();
    
    const leftSeat = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.08, 2),
        benchMaterial
    );
    leftSeat.position.set(-2.6, 0.6, -0.5);
    leftSeat.castShadow = true;
    leftSeat.receiveShadow = true;
    leftSeat.interactionObject = leftBenchGroup;
    tmpGroup.add(leftSeat);
    
    // Ножки левой лавки
    const leftLegPositions = [
        [-2.85, 0.3, -1.3], [-2.85, 0.3, 0.3], 
        [-2.35, 0.3, -1.3], [-2.35, 0.3, 0.3]
    ];
    leftLegPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, benchMaterial);
        leg.position.set(...pos);
        leg.castShadow = true;
        leg.interactionObject = leftBenchGroup;
        tmpGroup.add(leg);
    });

    bbox = new THREE.Box3().setFromObject(tmpGroup);
    tmpGroup.position.set(-(bbox.min.x + bbox.max.x) / 2, -(bbox.min.y + bbox.max.y) / 2, -(bbox.min.z + bbox.max.z) / 2);
    leftBenchGroup.add(tmpGroup);
    leftBenchGroup.position.set((bbox.min.x + bbox.max.x) / 2, (bbox.min.y + bbox.max.y) / 2, (bbox.min.z + bbox.max.z) / 2);
    leftBenchGroup.interactable = true;
    scene.add(leftBenchGroup);
    uninitializedDynamicBodies.set('leftBench', leftBenchGroup);
}

// Создание аксессуаров
function createAccessories() {
    // Ведро
    loadGLBModel(bucketModel, new THREE.Vector3(-1.24, 0.32, -2.15), new THREE.Euler(0, Math.PI * 1.2,0), (new THREE.Vector3(1,1,1)).multiplyScalar(0.3)).then((model) => {
        const bucketGroup = new THREE.Group();
        const tmpGroup = new THREE.Group();
        // Задаем параметр interactionObject для Mesh, которая выбирается при наведении
        model.children[0].children[0].children[0].children[0].interactionObject = bucketGroup;
        tmpGroup.add(model)

        // Рисуем воду в ведре
        const bb = new THREE.Box3();
        bb.setFromObject(model);
        const width = bb.max.x - bb.min.x;
        const innerRadius = width*0.65 / 2;
        const x = (bb.max.x + bb.min.x) / 2;
        const z = (bb.max.z + bb.min.z) / 2;
        const height = bb.max.y - bb.min.y;
        const fillAmount = 0.6
        const y = bb.min.y + height*fillAmount;
        
        const waterGeometry = new THREE.CircleGeometry(innerRadius, 12);
        const waterMaterial = new THREE.MeshStandardMaterial({
            color: 0x3366aa,
            transparent: true,
            opacity: 0.6,
            roughness: 0.1,
            metalness: 0.3
        });
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.rotation.x = -Math.PI / 2;
        // water.rotation.y = 0.1; // поворот относительно горизонта
        water.rotation.z = 0.3;
        water.position.set(x, y, z);
        water.interactionObject = bucketGroup;
        tmpGroup.add(water);

        const bbox = new THREE.Box3().setFromObject(tmpGroup);
        tmpGroup.position.set(-(bbox.min.x + bbox.max.x) / 2, -(bbox.min.y + bbox.max.y) / 2, -(bbox.min.z + bbox.max.z) / 2);
        bucketGroup.add(tmpGroup);
        bucketGroup.position.set((bbox.min.x + bbox.max.x) / 2, (bbox.min.y + bbox.max.y) / 2, (bbox.min.z + bbox.max.z) / 2);

        scene.add(bucketGroup);

        // === Добавляем физику для ведра ===
        if (rapierWorld) {
            // Вычисляем bounding box для точных размеров
            const bb = new THREE.Box3().setFromObject(bucketGroup);
            const size = new THREE.Vector3();
            bb.getSize(size);
            
            // Создаём динамическое rigid body
            const bucketDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(bucketGroup.position.x, bucketGroup.position.y, bucketGroup.position.z)
                .setRotation({w: bucketGroup.quaternion._w, x: bucketGroup.quaternion._x, y: bucketGroup.quaternion._y, z: bucketGroup.quaternion._z})
                .setLinearDamping(0.5)     // Сопротивление движению
                .setAngularDamping(0.5);   // Сопротивление вращению
            
            const bucketBody = rapierWorld.createRigidBody(bucketDesc);
            
            // Создаём коллайдер (ящик вместо точной формы для производительности)
            const bucketColliderDesc = RAPIER.ColliderDesc.cylinder(size.y*0.9 / 2, size.x*0.65 / 2)
                .setTranslation(-0.02, -0.02, 0.02)
                .setMass(2.0)            // Масса в кг
                .setFriction(0.6)         // Трение дерева
                .setRestitution(0.2);     // Небольшая упругость
            
            rapierWorld.createCollider(bucketColliderDesc, bucketBody);
            
            // Сохраняем связь между Three.js объектом и физическим телом
            dynamicBodies.set(bucketGroup.uuid, {
                mesh: bucketGroup,
                body: bucketBody
            });
            
            bucketGroup.userData.physicsBody = bucketBody;
            bucketGroup.userData.isDynamic = true;
            bucketGroup.interactable = true;
        }
    })

    // Часы на стене
    const clockGroup = new THREE.Group();
    
    const clockFaceGeometry = new THREE.CircleGeometry(0.15, 32);
    const clockMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.5 });
    const clockFace = new THREE.Mesh(clockFaceGeometry, clockMaterial);
    clockFace.position.set(0, 2.2, -2.48);
    clockGroup.add(clockFace);

    // Рамка часов
    const clockFrameGeometry = new THREE.TorusGeometry(0.15, 0.015, 8, 32);
    const clockFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2810, roughness: 0.6 });
    const clockFrame = new THREE.Mesh(clockFrameGeometry, clockFrameMaterial);
    clockFrame.position.set(0, 2.2, -2.48);
    clockGroup.add(clockFrame);

    // Стрелки
    const hourHandGeo = new THREE.BoxGeometry(0.08, 0.015, 0.003);
    const handMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const hourHand = new THREE.Mesh(hourHandGeo, handMaterial);
    hourHand.position.set(0.03, 2.2, -2.47);
    clockGroup.add(hourHand);

    const minuteHandGeo = new THREE.BoxGeometry(0.12, 0.01, 0.003);
    const minuteHand = new THREE.Mesh(minuteHandGeo, handMaterial);
    minuteHand.position.set(0.025, 2.24, -2.47);
    minuteHand.rotation.z = Math.PI / 4;
    clockGroup.add(minuteHand);

    scene.add(clockGroup);

    // Термометр
    const thermometerGroup = new THREE.Group();
    
    const thermoBodyGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 12);
    const thermoMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.7,
        roughness: 0.1 
    });
    const thermoBody = new THREE.Mesh(thermoBodyGeometry, thermoMaterial);
    thermoBody.position.set(-1.5, 2, -2.48);
    thermometerGroup.add(thermoBody);

    // Ртуть (температура высокая)
    const mercuryGeometry = new THREE.CylinderGeometry(0.012, 0.012, 0.18, 12);
    const mercuryMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333 });
    const mercury = new THREE.Mesh(mercuryGeometry, mercuryMaterial);
    mercury.position.set(-1.5, 1.98, -2.47);
    thermometerGroup.add(mercury);

    scene.add(thermometerGroup);
}

// Создание освещения
function createLighting() {
    // Ambient light (мягкое освещение)
    const ambientLight = new THREE.AmbientLight(0xff9966, 0.5);
    scene.add(ambientLight);

    // Дополнительное тёплое освещение сверху
    const ceilingLight = new THREE.PointLight(0xff8844, 2.0, 6);
    ceilingLight.position.set(0, 2.7, 1);
    ceilingLight.castShadow = true;
    scene.add(ceilingLight);

}


function createPhysicsWalls() {
    if (!rapierWorld) return;
    
    // Размеры парилки (из createSauna)
    const width = 6;
    const height = 3;
    const depth = 5;
    
    // === Пол ===
    const floorDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(0, 0, 0);
    const floorBody = rapierWorld.createRigidBody(floorDesc);
    const floorColliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, 0.01, depth / 2);
    rapierWorld.createCollider(floorColliderDesc, floorBody);
    
    // === Потолок ===
    const ceilingDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(0, height, 0);
    const ceilingBody = rapierWorld.createRigidBody(ceilingDesc);
    const ceilingColliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, 0.01, depth / 2)
    rapierWorld.createCollider(ceilingColliderDesc, ceilingBody);
    
    // === Задняя стена ===
    const backWallDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(0, height / 2, -depth / 2);
    const backWallBody = rapierWorld.createRigidBody(backWallDesc);
    const backWallColliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, 0.01);
    rapierWorld.createCollider(backWallColliderDesc, backWallBody);
    
    // // === Левая стена ===
    const leftWallDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(-width / 2, height / 2, 0);
    const leftWallBody = rapierWorld.createRigidBody(leftWallDesc);
    const leftWallColliderDesc = RAPIER.ColliderDesc.cuboid(0.01, height / 2, depth / 2);
    rapierWorld.createCollider(leftWallColliderDesc, leftWallBody);
    
    // // === Правая стена ===
    const rightWallDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(width / 2, height / 2, 0);
    const rightWallBody = rapierWorld.createRigidBody(rightWallDesc);
    const rightWallColliderDesc = RAPIER.ColliderDesc.cuboid(0.01, height / 2, depth / 2);
    rapierWorld.createCollider(rightWallColliderDesc, rightWallBody);
    
    // === Передняя стена ===
    const frontWallDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(0, height / 2, depth / 2);
    const frontWallBody = rapierWorld.createRigidBody(frontWallDesc);
    const frontWallColliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, 0.01);
    rapierWorld.createCollider(frontWallColliderDesc, frontWallBody);


    // // === Передняя стена (с дверью) ===
    // // Левая часть передней стены
    // const leftFrameOffset = 1.2;
    // const frontLeftDesc = RAPIER.RigidBodyDesc.fixed(rapierVec(leftFrameOffset / 2 - width / 4, (height - 0.8) / 2, depth / 2));
    // const frontLeftBody = rapierWorld.createRigidBody(frontLeftDesc);
    // const frontLeftColliderDesc = RAPIER.ColliderDesc.cuboid(width / 4 + leftFrameOffset / 2, (height - 0.8) / 2, 0.01);
    // rapierWorld.createCollider(frontLeftColliderDesc, frontLeftBody);
    
    // // Правая часть передней стены
    // const rightFrameOffset = 2.4;
    // const frontRightDesc = RAPIER.RigidBodyDesc.fixed(rapierVec(rightFrameOffset / 2 + width / 4, (height - 0.8) / 2, depth / 2));
    // const frontRightBody = rapierWorld.createRigidBody(frontRightDesc);
    // const frontRightColliderDesc = RAPIER.ColliderDesc.cuboid(width / 4 - rightFrameOffset / 2, (height - 0.8) / 2, 0.01);
    // rapierWorld.createCollider(frontRightColliderDesc, frontRightBody);
    
    // // Верхняя часть над дверью
    // const frontTopDesc = RAPIER.RigidBodyDesc.fixed(rapierVec(0, height - 0.4, depth / 2));
    // const frontTopBody = rapierWorld.createRigidBody(frontTopDesc);
    // const frontTopColliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, 0.4, 0.01);
    // rapierWorld.createCollider(frontTopColliderDesc, frontTopBody);
}

function createPhysicsStove() {
    if (!rapierWorld) return;
    
    // Основание печи (коробка)
    const stoveBaseDesc = RAPIER.RigidBodyDesc.fixed(rapierVec(-2.3, 0.45, -2));
    const stoveBaseBody = rapierWorld.createRigidBody(stoveBaseDesc);
    const stoveBaseColliderDesc = RAPIER.ColliderDesc.cuboid(0.4, 0.45, 0.3)
        .setRestitution(0.1) // Небольшая упругость
        .setFriction(0.7);
    rapierWorld.createCollider(stoveBaseColliderDesc, stoveBaseBody);
    
    // Контейнер для камней (цилиндр — аппроксимируем кубом)
    const stonesContainerDesc = RAPIER.RigidBodyDesc.fixed(rapierVec(-2.3, 1.1, -2));
    const stonesContainerBody = rapierWorld.createRigidBody(stonesContainerDesc);
    const stonesContainerColliderDesc = RAPIER.ColliderDesc.cuboid(0.35, 0.2, 0.35);
    rapierWorld.createCollider(stonesContainerColliderDesc, stonesContainerBody);
    
    // Труба
    const pipeDesc = RAPIER.RigidBodyDesc.fixed(rapierVec(-2.3, 2.05, -2));
    const pipeBody = rapierWorld.createRigidBody(pipeDesc);
    const pipeColliderDesc = RAPIER.ColliderDesc.cuboid(0.12, 0.75, 0.12);
    rapierWorld.createCollider(pipeColliderDesc, pipeBody);
}

function createPhysicsBenches() {
    if (!rapierWorld) return;
    
    const benchMaterial = { friction: 0.8, restitution: 0.1 };

    // Первая лавка
    const bench1Desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 0.57, -1.8)
        .setRotation({ x: 0, y: 0, z: 0, w: 1 })
        .setLinearDamping(0.5)     // Сопротивление движению
        .setAngularDamping(0.5);   // Сопротивление вращению
    const bench1Body = rapierWorld.createRigidBody(bench1Desc);
    const bench1Seat1ColliderDesc = RAPIER.ColliderDesc.cuboid(0.9, 0.04, 0.3)
        .setTranslation(0, 0.03, 0.4)
        .setMass(10.0) // Масса в кг
        .setFriction(benchMaterial.friction)
        .setRestitution(benchMaterial.restitution);
    rapierWorld.createCollider(bench1Seat1ColliderDesc, bench1Body);
    const bench1LegPositions = [[-0.8, -0.27, 0.1], [-0.8, -0.27, 0.65], [0.8, -0.27, 0.1], [0.8, -0.27, 0.65]];
    bench1LegPositions.forEach(pos => {
        const legColliderDesc = RAPIER.ColliderDesc.cuboid(0.04, 0.3, 0.04)
        .setTranslation(...pos)
        .setMass(2.0) // Масса в кг
        .setFriction(benchMaterial.friction)
        .setRestitution(benchMaterial.restitution);
        rapierWorld.createCollider(legColliderDesc, bench1Body);
    });
    const bench1BackColliderDesc = RAPIER.ColliderDesc.cuboid(0.9, 0.25, 0.025)
        .setTranslation(0, 0.28, 0.075)
        .setMass(10.0) // Масса в кг
        .setFriction(benchMaterial.friction)
        .setRestitution(benchMaterial.restitution);
    rapierWorld.createCollider(bench1BackColliderDesc, bench1Body);
    const bench1Seat2ColliderDesc = RAPIER.ColliderDesc.cuboid(0.9, 0.04, 0.4)
        .setTranslation(0, 0.53, -0.3)
        .setMass(10.0) // Масса в кг
        .setFriction(benchMaterial.friction)
        .setRestitution(benchMaterial.restitution);
    rapierWorld.createCollider(bench1Seat2ColliderDesc, bench1Body);
    const bench1SupportPositions = [[-0.8, -0.045, -0.65], [0.8, -0.045, -0.65]];
    bench1SupportPositions.forEach(pos => {
        const supportColliderDesc = RAPIER.ColliderDesc.cuboid(0.04, 0.525, 0.04)
        .setTranslation(...pos)
        .setMass(2.0) // Масса в кг
        .setFriction(benchMaterial.friction)
        .setRestitution(benchMaterial.restitution);
        rapierWorld.createCollider(supportColliderDesc, bench1Body);
    });
    const bench1Group = uninitializedDynamicBodies.get('bench1');
    dynamicBodies.set(bench1Group.uuid, {
        mesh: bench1Group,
        body: bench1Body
    });
    
    bench1Group.userData.physicsBody = bench1Body;
    bench1Group.userData.isDynamic = true;
    uninitializedDynamicBodies.delete('bench1');

    // === Левая лавка ===
    const leftBenchDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(-2.6, 0.32, -0.5)
        .setRotation({ x: 0, y: 0, z: 0, w: 1 })
        .setLinearDamping(0.5)     // Сопротивление движению
        .setAngularDamping(0.5);   // Сопротивление вращению
    const leftBenchBody = rapierWorld.createRigidBody(leftBenchDesc);
    const leftBenchColliderDesc = RAPIER.ColliderDesc.cuboid(0.3, 0.04, 1.0)
        .setTranslation(0, 0.28, 0)
        .setMass(10.0) // Масса в кг
        .setFriction(benchMaterial.friction)
        .setRestitution(benchMaterial.restitution);
    rapierWorld.createCollider(leftBenchColliderDesc, leftBenchBody);
    const leftLegPositions = [
        [-0.25, -0.02, -0.8], [-0.25, -0.02, 0.8], 
        [0.25, -0.02, -0.8], [0.25, -0.02, 0.8]
    ];
    leftLegPositions.forEach(pos => {
        const leftLegColliderDesc = RAPIER.ColliderDesc.cuboid(0.04, 0.3, 0.04)
        .setTranslation(...pos)
        .setMass(2.0) // Масса в кг
        .setFriction(benchMaterial.friction)
        .setRestitution(benchMaterial.restitution);
        rapierWorld.createCollider(leftLegColliderDesc, leftBenchBody);
    });
    const leftBenchGroup = uninitializedDynamicBodies.get('leftBench');
    dynamicBodies.set(leftBenchGroup.uuid, {
        mesh: leftBenchGroup,
        body: leftBenchBody
    });
    
    leftBenchGroup.userData.physicsBody = leftBenchBody;
    leftBenchGroup.userData.isDynamic = true;
    uninitializedDynamicBodies.delete('leftBench');
}

// Создание всех статических коллизий
function createAllStaticColliders() {
    createPhysicsWalls();
    // createPhysicsStove();
    createPhysicsBenches();
}

// function createPlayerPhysics() {
//     if (!rapierWorld) return;
    
//     // Игрок как динамическое тело (капсула аппроксимируется цилиндром + сферы, или просто капсула)
//     // Для простоты используем шар с немного приплюснутой формой
    
//     const playerHeight = 1.7;
//     const playerRadius = 0.3; // Радиус столкновений игрока
    
//     // Жёсткое тело игрока (кинематическое, управляемое напрямую)
//     const playerDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
//         .setTranslation(camera.position.x, camera.position.y - playerHeight / 2, camera.position.z);
    
//     playerBody = rapierWorld.createRigidBody(playerDesc);
    
//     // Капсула не поддерживается напрямую в некоторых версиях, используем цилиндр
//     // Ось Y — вертикальная для цилиндра
//     const playerColliderDesc = RAPIER.ColliderDesc.capsule(playerHeight / 2 - playerRadius, playerRadius)
//         .setFriction(0.0)      // Без трения при движении (мы управляем сами)
//         .setRestitution(0.0);  // Без упругости
    
//     // Альтернативно, если капсула не поддерживается:
//     // const playerColliderDesc = RAPIER.ColliderDesc.ball(playerRadius);
    
//     playerCollider = rapierWorld.createCollider(playerColliderDesc, playerBody);
    
//     console.log('Player physics created');
// }

function createPlayerPhysics() {
    if (!rapierWorld) return;
    
    // const RAPIER = window.RAPIER;
    
    // === Игрок — DYNAMIC rigid body ===
    // Это позволяет телу сталкиваться со стенами и препятствиями
    const playerDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(camera.position.x, camera.position.y - 0.85, camera.position.z)
        .setLinvel(0, 0, 0)
        .lockRotations();  // Запрещаем вращение тела — оно всегда вертикально
    
    playerBody = rapierWorld.createRigidBody(playerDesc);
    
    // Капсула для игрока
    const playerRadius = 0.3;
    const playerHeight = 1.7;
    
    const playerColliderDesc = RAPIER.ColliderDesc.capsule(
        playerHeight / 2 - playerRadius,  // half-height цилиндра (без полусфер)
        playerRadius
    )
        .setFriction(0.0)        // Без трения при скольжении
        .setRestitution(0.0);    // Без упругости
    
    playerCollider = rapierWorld.createCollider(playerColliderDesc, playerBody);
    
    console.log('Player physics created (dynamic body with locked rotations)');
}

function addLogValue(log_div, row_title) {
    const log_row = document.createElement('p');
    const log_title = document.createElement('span');
    log_title.innerHTML = row_title;
    log_row.appendChild(log_title);
    const log_value = document.createElement('span');
    log_row.appendChild(log_value);
    log_values.set(row_title, log_value);
    log_div.appendChild(log_row);
}

function setLogValue(row_title, val) {
    if (log_values.has(row_title)) log_values.get(row_title).innerHTML = val.toFixed(3);
}

function createLog() {
    const log_div = document.createElement('div');
    log_div.setAttribute('id', 'log');
    log_div.classList.add('hidden');

    addLogValue(log_div, 'camera.position.x');
    addLogValue(log_div, 'camera.position.y');
    addLogValue(log_div, 'camera.position.z'); 
    addLogValue(log_div, 'velocity.x');
    addLogValue(log_div, 'velocity.z');
    addLogValue(log_div, 'direction.x');
    addLogValue(log_div, 'direction.z');
    addLogValue(log_div, 'euler.x');
    addLogValue(log_div, 'euler.y');
    addLogValue(log_div, 'camera.rotation.x');
    addLogValue(log_div, 'camera.rotation.y');
    addLogValue(log_div, 'camera.rotation.z');

    document.body.appendChild(log_div);
}

function rotateCamera(movementX, movementY, sensitivity) {
    if (movementX == 0 && movementY == 0) return;

    // Применяем вращение к Euler углам
    euler.setFromQuaternion(camera.quaternion);

    // Горизонтальное вращение (вокруг оси Y)
    euler.y -= movementX * sensitivity;
    // Вертикальное вращение (вокруг оси X)
    euler.x -= movementY * sensitivity;

    // Ограничение вертикального вращения
    euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));

    // Применяем к камере
    camera.quaternion.setFromEuler(euler);
    
    if (enableLog) {
        setLogValue('euler.x', euler.x);
        setLogValue('euler.y', euler.y);
        setLogValue('camera.rotation.x', camera.rotation.x);
        setLogValue('camera.rotation.y', camera.rotation.y);
        setLogValue('camera.rotation.z', camera.rotation.z);
    }
}

// Настройка управления
function setupControls() {
    // Клик для активации управления от первого лица
    document.getElementById('click-to-start').addEventListener('click', () => {
        document.body.requestPointerLock();
    });

    // Блокировка указателя
    document.addEventListener('pointerlockchange', () => {
        isLocked = document.pointerLockElement === document.body;
        
        if (isLocked) {
            document.getElementById('click-to-start').classList.add('hidden');
            document.getElementById('instructions').classList.remove('hidden');
            document.getElementById('crosshair').classList.remove('hidden');
            document.getElementById('temp-indicator').classList.remove('hidden');
            if (enableLog) document.getElementById('log').classList.remove('hidden');
        } else {
            document.getElementById('click-to-start').classList.remove('hidden');
            document.getElementById('instructions').classList.add('hidden');
            document.getElementById('crosshair').classList.add('hidden');
            document.getElementById('temp-indicator').classList.add('hidden');
            if (enableLog) document.getElementById('log').classList.add('hidden');
            objectSelector.disable();
        }
    });

    // Движение мыши (осмотр)
    document.addEventListener('mousemove', (event) => {
        if (!isLocked) return;
        if (objectSelector.pickedRotating) {
            objectSelector.rotate(event.movementX || 0, event.movementY || 0, mouseSensitivity);
            return;
        }
        rotateCamera(event.movementX || 0, event.movementY || 0, mouseSensitivity);
    });

    document.addEventListener('touchstart', (event) => {
        if (!isLocked || touchActivity.inProgress) return;
        touchActivity.inProgress = true;
        touchActivity.touchId = event.changedTouches[0].identifier;
        touchActivity.x = event.changedTouches[0].screenX;
        touchActivity.y = event.changedTouches[0].screenY;
    });
    document.addEventListener('touchmove', (event) => {
        if (!touchActivity.inProgress) return;
        for (const touch of event.changedTouches) {
            if (touch.identifier != touchActivity.touchId) continue;
            const dx = touch.screenX - touchActivity.x;
            const dy = touch.screenY - touchActivity.y;
            touchActivity.x = touch.screenX;
            touchActivity.y = touch.screenY;
            // Для касаний - обратное направление поворота, чтобы совпадало с направлением движения пальца
            rotateCamera(-dx, -dy, touchSensitivity);
        }
    });
    document.addEventListener('touchend', (event) => {
        if (!touchActivity.inProgress) return;
        for (const touch of event.changedTouches) {
            if (touch.identifier != touchActivity.touchId) continue;
            touchActivity.inProgress = false;
            touchActivity.touchId = undefined;
            touchActivity.x = undefined;
            touchActivity.y = undefined;
        }
    });
    document.addEventListener('touchcancel', (event) => {
        if (!touchActivity.inProgress) return;
        for (const touch of event.changedTouches) {
            if (touch.identifier != touchActivity.touchId) continue;
            touchActivity.inProgress = false;
            touchActivity.touchId = undefined;
            touchActivity.x = undefined;
            touchActivity.y = undefined;
        }
    });

    document.addEventListener('mousedown', (event) => {
        if (!isLocked || !objectSelector.enabled) return;
        if (event.button == 0) {
            objectSelector.pickUpToggle();
        } else if (event.button == 1) {
            objectSelector.delete();
        } else if (event.button == 2) {
            objectSelector.rotationStart();
        }
    })

    document.addEventListener('mouseup', (event) => {
        if (!isLocked || !objectSelector.enabled) return;
        if (event.button == 2) {
            objectSelector.rotationStop();
        }
    })
    
    document.addEventListener('wheel', (event) => {
        if (!isLocked || !objectSelector.enabled) return;
        // Передаем обратное значение
        // Колесо вниз - event.deltaY положительное - сдивинуть к себе, т.е. уменьшить, поэтому значение обратное
        objectSelector.changeObjectHoldDistance(-event.deltaY);
    })



    // Клавиатура
    document.addEventListener('keydown', (event) => {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                moveForward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                moveBackward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                moveLeft = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                moveRight = true;
                break;
            case 'KeyC':
                objectSelector.toggle();
                break;
            case 'KeyX':
                objectSelector.toggleHorizontalRotation();
                break;
            case 'KeyZ':
                objectSelector.toggleVerticalRotation();
                break;
            case 'KeyB':
                objectSelector.log_object_parameters();
                break;
        }
    });

    document.addEventListener('keyup', (event) => {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                moveForward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                moveBackward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                moveLeft = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                moveRight = false;
                break;
            // case 'KeyC':
            //     objectSelector.disable();
            //     break;
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Анимация
function animate(time) {
    requestAnimationFrame(animate);

    timer.update(time);
    const delta = timer.getDelta();

    // === Установка скорости игрока на основе ввода ===
    if (playerBody) {
        // Вычисляем направление движения на основе ввода
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();
        
        // Параметры движения
        // const acceleration = 20.0;
        const maxSpeed = 3.0;      // Максимальная скорость движения
        const deceleration = 15.0; // Замедление при отсутствии ввода
        
        if (!playerBody.isValid) {
            console.log('player body does not have isValid')
        } else if (!playerBody.isValid()) {
            console.log('player body is not valid')
        }
        // Текущая скорость
        const currentLinvel = playerBody.linvel();
        
        // Вектор "вперёд" относительно направления взгляда камеры
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;  // Движение строго в плоскости XZ
        cameraDirection.normalize();
        
        // Вектор "вправо" относительно камеры
        const cameraRight = new THREE.Vector3();
        cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
        cameraRight.normalize();
        
        // Желаемая скорость
        const desiredVelocity = {
            x: 0,
            y: currentLinvel.y, // Сохраняем вертикальную скорость (гравитацию)
            z: 0
        };
        
        // Применяем ускорение
        // const speed = acceleration * delta;
        
        if (moveForward || moveBackward) {
            desiredVelocity.x += cameraDirection.x * velocity.z;
            desiredVelocity.z += cameraDirection.z * velocity.z;
        } else {
            // Плавное замедление при отпускании клавиш
            velocity.z *= Math.max(0, 1 - deceleration * delta);
            if (Math.abs(velocity.z) < 0.01) velocity.z = 0;
        }
        
        if (moveLeft || moveRight) {
            desiredVelocity.x += cameraRight.x * velocity.x;
            desiredVelocity.z += cameraRight.z * velocity.x;
        } else {
            velocity.x *= Math.max(0, 1 - deceleration * delta);
            if (Math.abs(velocity.x) < 0.01) velocity.x = 0;
        }
        
        // Ограничиваем максимальную скорость
        const speed2D = Math.sqrt(currentLinvel.x ** 2 + currentLinvel.z ** 2);
        if (speed2D > maxSpeed) {
            const scale = maxSpeed / speed2D;
            desiredVelocity.x = currentLinvel.x * scale;
            desiredVelocity.z = currentLinvel.z * scale;
        }
        
        // Обновляем скорость на основе ввода
        let targetVelocityX = 0;
        let targetVelocityZ = 0;
        
        if (moveForward || moveBackward) {
            targetVelocityX += cameraDirection.x * direction.z * maxSpeed;
            targetVelocityZ += cameraDirection.z * direction.z * maxSpeed;
        }
        
        if (moveLeft || moveRight) {
            targetVelocityX += cameraRight.x * direction.x * maxSpeed;
            targetVelocityZ += cameraRight.z * direction.x * maxSpeed;
        }
        
        // Плавная интерполяция скорости (чтобы не было рывков)
        const interpolationFactor = 0.15; // Меньше = плавнее, но медленнее реакция
        desiredVelocity.x = currentLinvel.x + (targetVelocityX - currentLinvel.x) * interpolationFactor;
        desiredVelocity.z = currentLinvel.z + (targetVelocityZ - currentLinvel.z) * interpolationFactor;
        
        // Устанавливаем скорость тела
        playerBody.setLinvel(desiredVelocity, true);
    }
    // === Шаг физики Rapier ===
    if (rapierWorld) {
        rapierWorld.timestep = Math.min(delta, 0.1);
        rapierWorld.step();
        if (rapierDebugRenderer) rapierDebugRenderer.update();
    }
    // === Синхронизация камеры с физическим телом ===
    if (playerBody) {
        const position = playerBody.translation();
        
        // Камера находится на высоте глаз игрока
        camera.position.set(position.x, position.y + 0.85, position.z);
        
        // Ограничение по высоте (если игрок "вылетел" за пределы):
        if (camera.position.y > 2.5) {
            camera.position.y = 1.7;
            const correctedPos = { x: position.x, y: 0.85, z: position.z };
            playerBody.setTranslation(correctedPos, true);
        }
        if (camera.position.y < 0.5) {
            camera.position.y = 1.7;
        }
    }

    if (!playerBody && !rapierWorld && isLocked) {
        // Движение

        // Замедление
        const slowDownSpeed = 8.0; // Во сколько раз замедляется игрок за секунду (это происходит каждый фрейм и замедление всегда от новой скорости на каждом фрейме)
        const stopSpeed = 1e-2; // При какой скорости происходит окончательная остановка
        velocity.x -= velocity.x * slowDownSpeed * delta;
        if (Math.abs(velocity.x) < stopSpeed) velocity.x = 0;
        velocity.z -= velocity.z * slowDownSpeed * delta;
        if (Math.abs(velocity.z) < stopSpeed) velocity.z = 0;
        
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();
        
        if (enableLog) {
            setLogValue('direction.x', direction.x);
            setLogValue('direction.z', direction.z);
        }

        const speed = 20.0; // С какой скоростью игрок ускоряется
        
        if (moveForward || moveBackward) {
            velocity.z += direction.z * speed * delta;
        }
        if (moveLeft || moveRight) {
            velocity.x += direction.x * speed * delta;
        }

        if (enableLog) {
            setLogValue('velocity.x', velocity.x);
            setLogValue('velocity.z', velocity.z);
        }

        // Применение движения с учётом направления камеры
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();

        camera.position.add(forward.multiplyScalar(velocity.z * delta));
        camera.position.add(right.multiplyScalar(velocity.x * delta));

        // Ограничение позиции внутри парилки
        camera.position.x = Math.max(-2.7, Math.min(2.7, camera.position.x));
        camera.position.z = Math.max(-2.2, Math.min(2.2, camera.position.z));
        camera.position.y = 1.7; // Фиксированная высота (рост человека)

        if (enableLog) {
            setLogValue('camera.position.x', camera.position.x);
            setLogValue('camera.position.y', camera.position.y);
            setLogValue('camera.position.z', camera.position.z);
        }
        
    }

    if (isLocked) objectSelector.update(delta);

    // === Синхронизация динамических объектов ===
    dynamicBodies.forEach((data, uuid) => {
        const { mesh, body } = data;
        
        if (body.bodyType() === RAPIER.RigidBodyType.Dynamic && (!objectSelector.pickedUp || objectSelector.pickedUp && objectSelector.selected?.uuid != mesh.uuid)) {
            // Объект под физикой и не поднят игроком
            const position = body.translation();
            const rotation = body.rotation();
            
            mesh.position.set(position.x, position.y, position.z);
            mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        } else if (objectSelector.pickedUp && objectSelector.selected?.uuid == mesh.uuid) {
            body.setTranslation({...mesh.position});
            body.setRotation({w: mesh.quaternion._w, x: mesh.quaternion._x, y: mesh.quaternion._y, z: mesh.quaternion._z});
        }
    });

    animateSteam(delta);

    // Лёгкое мерцание света от печи
    const stoveLights = scene.children.filter(c => c.type === 'PointLight' && c.position.x === -2.3);
    stoveLights.forEach(light => {
        if (light.position.y > 1.4) {
            light.intensity = 1.2 + Math.sin(Date.now() * 0.003) * 0.3 + Math.random() * 0.2;
        }
    });

    // renderer.render(scene, camera);
    composer.render();
}

// Запуск
await init();