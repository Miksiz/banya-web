// Основные переменные
let camera, scene, renderer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let euler = new THREE.Euler(0, 0, 0, 'YXZ'); // Для вычисления направления камеры
let PI_2 = Math.PI / 2;
const mouseSensitivity = 0.002;
const touchSensitivity = 0.003;
let isLocked = false;
let steam = [];
let clock = new THREE.Clock();
const enableLog = false;
let log_values = new Map();

let touchActivity = {
    inProgress: false,
    touchId: undefined,
    x: undefined,
    y: undefined,
}

// Инициализация сцены
function init() {
    // Сцена
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a0a05, 0.04);
    scene.background = new THREE.Color(0x0f0705);

    // Камера (вид от первого лица)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.7, 0);

    // Рендерер
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    document.body.appendChild(renderer.domElement);

    // Создание парилки
    createSauna();
    createStove();
    createBench();
    createAccessories();
    createLighting();
    createSteam();

    if (enableLog) createLog();

    // События управления
    setupControls();

    // Обработка изменения размера окна
    window.addEventListener('resize', onWindowResize);

    animate();
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

// Создание парилки
function createSauna() {
    const wallTexture = createWoodTexture('#8B4513');
    const ceilingTexture = createWoodTexture('#a0522d');
    const floorTexture = createWoodTexture('#5a3520');

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
    scene.add(rightWall);

    // Передняя стена с дверью
    const frontWallGroup = new THREE.Group();
    
    // Верхняя часть над дверью
    const topPart = new THREE.Mesh(
        new THREE.PlaneGeometry(width, 0.8),
        wallMaterial
    );
    topPart.position.set(0, height - 0.4, depth / 2);
    frontWallGroup.add(topPart);

    // Левая часть стены
    const leftPart = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, height - 0.8),
        wallMaterial
    );
    leftPart.position.set(-width / 2 + 0.75, (height - 0.8) / 2, depth / 2);
    frontWallGroup.add(leftPart);

    // Правая часть стены
    const rightPart = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, height - 0.8),
        wallMaterial
    );
    rightPart.position.set(width / 2 - 0.75, (height - 0.8) / 2, depth / 2);
    frontWallGroup.add(rightPart);

    // Рама двери
    const doorFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2810, roughness: 0.9 });
    const frameThickness = 0.08;

    // Вертикальные части рамы
    const frameGeo = new THREE.BoxGeometry(frameThickness, 2.2, frameThickness);
    const leftFrame = new THREE.Mesh(frameGeo, doorFrameMaterial);
    leftFrame.position.set(-0.95, 1.1, depth / 2);
    frontWallGroup.add(leftFrame);

    const rightFrame = new THREE.Mesh(frameGeo, doorFrameMaterial);
    rightFrame.position.set(0.95, 1.1, depth / 2);
    frontWallGroup.add(rightFrame);

    // Горизонтальная часть рамы
    const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry(2 + frameThickness * 2, frameThickness, frameThickness),
        doorFrameMaterial
    );
    topFrame.position.set(0, 2.2, depth / 2);
    frontWallGroup.add(topFrame);

    scene.add(frontWallGroup);

    // Дверь (полупрозрачная)
    const doorGeometry = new THREE.PlaneGeometry(1.9, 2.2);
    const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0x654321,
        transparent: true,
        opacity: 0.6,
        roughness: 0.5,
        metalness: 0.2
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, 1.1, depth / 2 - 0.01);
    scene.add(door);

    // Дверная ручка
    const handleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.4, metalness: 0.8 });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.6, 1.1, depth / 2 - 0.05);
    scene.add(handle);
}

// Создание печи-каменки
function createStove() {
    const stoveGroup = new THREE.Group();

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
    stoveGroup.add(base);

    // Топка (с дверцей)
    const doorGeometry = new THREE.BoxGeometry(0.35, 0.25, 0.05);
    const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.5,
        metalness: 0.95
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(-2.3, 0.35, -1.67);
    stoveGroup.add(door);

    // Свечение из топки
    const glowGeometry = new THREE.PlaneGeometry(0.3, 0.2);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.8
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(-2.3, 0.35, -1.66);
    stoveGroup.add(glow);

    // Контейнер для камней
    const stonesContainerGeometry = new THREE.CylinderGeometry(0.35, 0.38, 0.4, 12);
    const stonesContainer = new THREE.Mesh(stonesContainerGeometry, stoveMaterial);
    stonesContainer.position.set(-2.3, 1.1, -2);
    stonesContainer.castShadow = true;
    stoveGroup.add(stonesContainer);

    // Камни
    for (let i = 0; i < 25; i++) {
        const stoneGeometry = new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.06, 0);
        const stoneMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.05 + Math.random() * 0.05, 0.2, 0.25 + Math.random() * 0.15),
            roughness: 0.8,
            metalness: 0.1
        });
        const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.28;
        stone.position.set(
            -2.3 + Math.cos(angle) * radius,
            1.15 + Math.random() * 0.25,
            -2 + Math.sin(angle) * radius
        );
        stone.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        stone.castShadow = true;
        stoveGroup.add(stone);
    }

    // Труба
    const pipeGeometry = new THREE.CylinderGeometry(0.12, 0.15, 1.5, 12);
    const pipe = new THREE.Mesh(pipeGeometry, stoveMaterial);
    pipe.position.set(-2.3, 2.05, -2);
    pipe.castShadow = true;
    stoveGroup.add(pipe);

    scene.add(stoveGroup);

    // Свет от печи
    const stoveLight = new THREE.PointLight(0xff6622, 1.5, 4);
    stoveLight.position.set(-2.3, 1.5, -2);
    stoveLight.castShadow = true;
    scene.add(stoveLight);
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
    
    // Сиденье
    const seatGeometry = new THREE.BoxGeometry(1.8, 0.08, 0.6);
    const seat1 = new THREE.Mesh(seatGeometry, benchMaterial);
    seat1.position.set(0, 0.5, -2.2);
    seat1.castShadow = true;
    seat1.receiveShadow = true;
    bench1Group.add(seat1);

    // Ножки
    const legGeometry = new THREE.BoxGeometry(0.08, 0.45, 0.08);
    const positions = [[-0.8, 0.225, -2.4], [-0.8, 0.225, -2], [0.8, 0.225, -2.4], [0.8, 0.225, -2]];
    positions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, benchMaterial);
        leg.position.set(...pos);
        leg.castShadow = true;
        bench1Group.add(leg);
    });

    // Спинка
    const backGeometry = new THREE.BoxGeometry(1.8, 0.5, 0.05);
    const back1 = new THREE.Mesh(backGeometry, benchMaterial);
    back1.position.set(0, 0.75, -2.45);
    back1.castShadow = true;
    bench1Group.add(back1);

    scene.add(bench1Group);

    // Верхняя лавка (полка)
    const bench2Group = new THREE.Group();

    const seat2 = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.08, 0.8),
        benchMaterial
    );
    seat2.position.set(0, 1.1, -2.1);
    seat2.castShadow = true;
    seat2.receiveShadow = true;
    bench2Group.add(seat2);

    // Опоры
    const supportGeometry = new THREE.BoxGeometry(0.08, 1.05, 0.08);
    const supportPositions = [[-0.8, 0.525, -2.45], [0.8, 0.525, -2.45]];
    supportPositions.forEach(pos => {
        const support = new THREE.Mesh(supportGeometry, benchMaterial);
        support.position.set(...pos);
        support.castShadow = true;
        bench2Group.add(support);
    });

    scene.add(bench2Group);

    // Лавка слева
    const leftBenchGroup = new THREE.Group();
    
    const leftSeat = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.08, 2),
        benchMaterial
    );
    leftSeat.position.set(-2.6, 0.5, -0.5);
    leftSeat.castShadow = true;
    leftSeat.receiveShadow = true;
    leftBenchGroup.add(leftSeat);

    // Ножки левой лавки
    const leftLegPositions = [
        [-2.85, 0.225, -1.3], [-2.85, 0.225, 0.3], 
        [-2.35, 0.225, -1.3], [-2.35, 0.225, 0.3]
    ];
    leftLegPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, benchMaterial);
        leg.position.set(...pos);
        leg.castShadow = true;
        leftBenchGroup.add(leg);
    });

    scene.add(leftBenchGroup);
}

// Создание аксессуаров
function createAccessories() {
    // Ведро
    const bucketGroup = new THREE.Group();
    
    const bucketGeometry = new THREE.CylinderGeometry(0.15, 0.12, 0.25, 16, 1, true);
    const bucketMaterial = new THREE.MeshStandardMaterial({
        color: 0x654321,
        roughness: 0.8,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    const bucket = new THREE.Mesh(bucketGeometry, bucketMaterial);
    bucket.position.set(2, 0.125, -1.5);
    bucket.castShadow = true;
    bucketGroup.add(bucket);

    // Дно ведра
    const bottomGeometry = new THREE.CircleGeometry(0.12, 16);
    const bottom = new THREE.Mesh(bottomGeometry, bucketMaterial);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.set(2, 0.01, -1.5);
    bucketGroup.add(bottom);

    // Деревянные полоски на ведре
    for (let i = 0; i < 3; i++) {
        const stripGeometry = new THREE.BoxGeometry(0.32, 0.03, 0.01);
        const strip = new THREE.Mesh(stripGeometry, bucketMaterial);
        strip.position.set(2, 0.08 + i * 0.08, -1.5);
        bucketGroup.add(strip);
    }

    // Ручка ведра
    const handleGeometry = new THREE.TorusGeometry(0.14, 0.015, 8, 24, Math.PI);
    const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.6, metalness: 0.7 });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(2, 0.28, -1.5);
    handle.rotation.x = Math.PI;
    bucketGroup.add(handle);

    scene.add(bucketGroup);

    // Шайка (деревянная кружка)
    const dipperGroup = new THREE.Group();
    
    const dipperGeometry = new THREE.CylinderGeometry(0.06, 0.05, 0.12, 12, 1, true);
    const dipper = new THREE.Mesh(dipperGeometry, bucketMaterial);
    dipper.position.set(2.2, 0.06, -1.3);
    dipper.rotation.z = 0.3;
    dipper.castShadow = true;
    dipperGroup.add(dipper);

    // Вода в шайке
    const waterGeometry = new THREE.CircleGeometry(0.05, 12);
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x3366aa,
        transparent: true,
        opacity: 0.6,
        roughness: 0.1,
        metalness: 0.3
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.rotation.z = 0.3;
    water.position.set(2.2, 0.1, -1.3);
    dipperGroup.add(water);

    scene.add(dipperGroup);

    // Веник (берёзовый)
    const whiskGroup = new THREE.Group();
    
    // Ручка веника
    const handleWiskGeometry = new THREE.CylinderGeometry(0.025, 0.03, 0.5, 8);
    const handleWhiskMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4020, roughness: 0.9 });
    const handleWhisk = new THREE.Mesh(handleWiskGeometry, handleWhiskMaterial);
    handleWhisk.position.set(2.4, 0.25, -1.7);
    handleWhisk.rotation.z = Math.PI / 6;
    whiskGroup.add(handleWhisk);

    // Листья/ветки веника
    for (let i = 0; i < 20; i++) {
        const leafGeometry = new THREE.ConeGeometry(0.01, 0.3 + Math.random() * 0.2, 4);
        const leafMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.25 + Math.random() * 0.08, 0.5, 0.3 + Math.random() * 0.1),
            roughness: 0.9
        });
        const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.08;
        leaf.position.set(
            2.4 + Math.cos(angle) * radius + 0.1,
            0.45 + Math.random() * 0.15,
            -1.7 + Math.sin(angle) * radius
        );
        leaf.rotation.set(
            (Math.random() - 0.5) * 0.8 + 0.5,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 0.8
        );
        whiskGroup.add(leaf);
    }

    scene.add(whiskGroup);

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

    const minuteHandGeo = new THREE.BoxGeometry(0.11, 0.01, 0.003);
    const minuteHand = new THREE.Mesh(minuteHandGeo, handMaterial);
    minuteHand.position.set(0.02, 2.2, -2.47);
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
    mercury.position.set(-1.5, 2.02, -2.47);
    thermometerGroup.add(mercury);

    scene.add(thermometerGroup);
}

// Создание освещения
function createLighting() {
    // Ambient light (мягкое填充ное освещение)
    const ambientLight = new THREE.AmbientLight(0xff9966, 0.15);
    scene.add(ambientLight);

    // Тёплый солнечный/световой поток (имитация света через дверь)
    const sunLight = new THREE.SpotLight(0xffaa66, 0.8, 10, Math.PI / 6, 0.3);
    sunLight.position.set(0, 2.5, 3);
    sunLight.target.position.set(0, 1, -1);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 10;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // Дополнительное тёплое освещение сверху
    const ceilingLight = new THREE.PointLight(0xff8844, 0.5, 6);
    ceilingLight.position.set(0, 2.7, -1);
    scene.add(ceilingLight);

    // Отражённый свет от горячих камней
    const stoneGlow = new THREE.PointLight(0xff6633, 0.4, 2);
    stoneGlow.position.set(-2.3, 1.3, -2);
    scene.add(stoneGlow);
}

// Создание пара
function createSteam() {
    const steamMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15,
        depthWrite: false
    });

    // Начальное облако пара
    for (let i = 0; i < 25; i++) {
        createSteamParticle(steamMaterial);
    }
}

function createSteamParticle(material) {
    const size = 0.2 + Math.random() * 0.4;
    const geometry = new THREE.PlaneGeometry(size, size);
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
    
    scene.add(steam);
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
    if (log_values.has(row_title)) log_values.get(row_title).innerHTML = val;
}

function createLog() {
    const log_div = document.createElement('div');
    log_div.setAttribute('id', 'log');
    log_div.classList.add('hidden');

    addLogValue(log_div, 'velocity.x');    
    addLogValue(log_div, 'velocity.z');    
    addLogValue(log_div, 'direction.x');    
    addLogValue(log_div, 'direction.z');
    addLogValue(log_div, 'event.movementX');
    addLogValue(log_div, 'event.movementY');
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
        }
    });

    // Движение мыши (осмотр)
    document.addEventListener('mousemove', (event) => {
        if (!isLocked) return;
        
        rotateCamera(event.movementX || 0, event.movementY || 0, mouseSensitivity);

        if (enableLog) {
            setLogValue('event.movementX', event.movementX || 0);
            setLogValue('event.movementY', event.movementY || 0);
            setLogValue('camera.rotation.x', camera.rotation.x);
            setLogValue('camera.rotation.y', camera.rotation.y);
            setLogValue('camera.rotation.z', camera.rotation.z);
        }
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
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Анимация
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (isLocked) {
        // Движение

        // Замедление
        const slowDownSpeed = 8.0; // Во сколько раз замедляется игрок за секунду (это происходит каждый фрейм и замедление всегда от новой скорости на каждом фрейме)
        const stopSpeed = 1e-2; // При какой скорости происходит окончательная остановка
        velocity.x -= velocity.x * slowDownSpeed * delta;
        if (Math.abs(velocity.x) < stopSpeed) velocity.x = 0;
        velocity.z -= velocity.z * slowDownSpeed * delta;
        if (Math.abs(velocity.z) < stopSpeed) velocity.z = 0;

        if (enableLog) {
            setLogValue('velocity.x', velocity.x);
            setLogValue('velocity.z', velocity.z);
        }
        
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
    }

    // Анимация пара
    scene.children.forEach(child => {
        if (child.userData && child.userData.velocity) {
            child.position.add(child.userData.velocity.clone().multiplyScalar(delta));
            child.userData.life += delta;
            
            // Затухание
            child.material.opacity = 0.15 * (1 - child.userData.life / child.userData.maxLife);
            
            // Растягивание пара
            child.scale.setScalar(1 + child.userData.life * 0.3);
            
            // Удаление старого пара и создание нового
            if (child.userData.life > child.userData.maxLife) {
                child.position.set(
                    -2.3 + (Math.random() - 0.5) * 0.5,
                    1.3 + Math.random() * 0.3,
                    -2 + (Math.random() - 0.5) * 0.5
                );
                child.userData.life = 0;
                child.userData.velocity.set(
                    (Math.random() - 0.5) * 0.3,
                    0.3 + Math.random() * 0.3,
                    (Math.random() - 0.5) * 0.3
                );
                child.material.opacity = 0.15;
                child.scale.setScalar(1);
            }
        }
    });

    // Лёгкое мерцание света от печи
    const stoveLights = scene.children.filter(c => c.type === 'PointLight' && c.position.x === -2.3);
    stoveLights.forEach(light => {
        if (light.position.y > 1.4) {
            light.intensity = 1.2 + Math.sin(Date.now() * 0.003) * 0.3 + Math.random() * 0.2;
        }
    });

    renderer.render(scene, camera);
}

// Запуск
init();