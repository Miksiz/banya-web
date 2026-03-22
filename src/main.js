import * as THREE from 'three';
import Scene from './systems/Scene.js'
import Bucket from './entities/Bucket.js';
import Bench from './entities/Bench.js';
import Bench2 from './entities/Bench2.js';
import Stove from './entities/Stove.js';
import SaunaBox from './entities/SaunaBox.js';

import Physics from './systems/Physics.js';
import ObjectSelector from './systems/ObjectSelector.js';
import Clock from './entities/Clock.js';
import Thermometer from './entities/Thermometer.js';

// Основные переменные
let camera, scene, sceneObj, physics, objectSelector;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const mouseSensitivity = 0.002;
const touchSensitivity = 0.003;
let isLocked = false;
let timer = new THREE.Timer();
timer.connect(document);

let touchActivity = {
    inProgress: false,
    touchId: undefined,
    x: undefined,
    y: undefined,
}

// Инициализация сцены
async function init() {
    // === Сначала инициализируем Rapier ===
    physics = new Physics()

    sceneObj = new Scene(physics)

    objectSelector = new ObjectSelector(sceneObj, physics)

    // Сцена
    scene = sceneObj.scene;
    scene.fog = new THREE.FogExp2(0x1a0a05, 0.04);
    scene.background = new THREE.Color(0x966b4b);

    // Камера (вид от первого лица)
    camera = sceneObj.camera;
    camera.position.set(0, 1.7, 0);

    // Создание парилки
    // createSauna(physics);

    new SaunaBox(
        sceneObj,
        physics,
        new THREE.Vector3(0, 0, 0),
        new THREE.Euler(0, 0, 0),
    );
    new Stove(
        sceneObj,
        physics,
        new THREE.Vector3(-2.34, 0.53, -1.85),
        new THREE.Euler(0, Math.PI/4, 0),
    );
    new Bench2(
        sceneObj,
        physics,
        new THREE.Vector3(0, 0.6, -1.75),
        new THREE.Euler(0, Math.PI, 0)
    );
    new Bench(
        sceneObj,
        physics,
        new THREE.Vector3(-2.6, 0.56, 0.1),
        new THREE.Euler(0, Math.PI/2, 0)
    );
    new Clock(
        sceneObj,
        physics,
        new THREE.Vector3(0.0, 2.2, -2.48),
        new THREE.Euler(0, 0, 0)
    );
    new Thermometer(
        sceneObj,
        physics,
        new THREE.Vector3(-1.5, 2, -2.48),
        new THREE.Euler(0, 0, 0)
    );

    // === Создаём физические коллизии для статических объектов ===
    physics.createPlayer();

    new Bucket(
        sceneObj,
        physics,
        new THREE.Vector3(-1.24, 0.32, -2.15),
        new THREE.Euler(0, Math.PI * 1.2,0)
    )
    createLighting();

    // События управления
    setupControls(objectSelector);


    await physics.init();

    requestAnimationFrame(animate);
}



// Создание освещения
function createLighting() {
    // Ambient light (мягкое освещение)
    const ambientLight = new THREE.AmbientLight(0xff9966, 1);
    scene.add(ambientLight);

    // Дополнительное тёплое освещение сверху
    // const ceilingLight = new THREE.PointLight(0xff8844, 2.0, 6);
    // ceilingLight.position.set(0, 2.7, 1);
    // ceilingLight.castShadow = true;
    // scene.add(ceilingLight);

}

// Настройка управления
function setupControls(objectSelector) {
    // Клик для активации управления от первого лица
    document.getElementById('click-to-start').addEventListener('click', () => {
        document.body.requestPointerLock();
    });

    // Блокировка указателя
    document.addEventListener('pointerlockchange', () => {
        isLocked = document.pointerLockElement === document.body;
        
        if (isLocked) {
            document.getElementById('click-to-start').classList.add('hidden');
            // document.getElementById('instructions').classList.remove('hidden');
            document.getElementById('crosshair').classList.remove('hidden');
            document.getElementById('temp-indicator').classList.remove('hidden');
        } else {
            document.getElementById('click-to-start').classList.remove('hidden');
            document.getElementById('instructions').classList.add('hidden');
            document.getElementById('crosshair').classList.add('hidden');
            document.getElementById('temp-indicator').classList.add('hidden');
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
        sceneObj.rotateCamera(event.movementX || 0, event.movementY || 0, mouseSensitivity);
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
            sceneObj.rotateCamera(-dx, -dy, touchSensitivity);
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
            case 'KeyN':
                try {
                    physics.toggleDebug();
                } catch (e) {console.log(e)}
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

// Анимация
function animate(time) {
    requestAnimationFrame(animate);

    timer.update(time);
    const delta = timer.getDelta();

    // === Установка скорости игрока на основе ввода ===
    if (physics.player) {
        const maxSpeed = 3;
        // Вычисляем направление движения на основе ввода
        const direction = new THREE.Vector3(
            Number(moveLeft) - Number(moveRight),
            0,
            Number(moveForward) - Number(moveBackward),
        ).normalize().multiplyScalar(maxSpeed);

        camera.updateMatrixWorld();
        const cameraQuaternion = camera.getWorldQuaternion(new THREE.Quaternion());
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternion);
        forward.y = 0;
        forward.normalize();
        const yAngle = Math.atan2(forward.x, forward.z);
        const cameraYQuaternion = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yAngle
        );

        const interpolationFactor = 0.15;
        const currentLinvel = physics.player.linvel();
        const targetVelocity = new THREE.Vector3(0, currentLinvel.y, 0).add(direction).applyQuaternion(cameraYQuaternion);
        const newVelocity = new THREE.Vector3(currentLinvel.x, currentLinvel.y, currentLinvel.z).lerp(targetVelocity, interpolationFactor);

        physics.player.setLinvel(newVelocity, true);
    }
    if (isLocked) objectSelector.update(delta);

    if (objectSelector.pickedUp) physics.updateBodyFromThree(objectSelector.selected);

    physics.update(delta);
    
    sceneObj.update(delta);

    sceneObj.render();
}

// Запуск
await init();