import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Создание загрузчика GLTF
const gltfLoader = new GLTFLoader();

function loadGLBModel(modelPath) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(
            modelPath,
            (gltf) => {
                const model = gltf.scene;
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

export { loadGLBModel };