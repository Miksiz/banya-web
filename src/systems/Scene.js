import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export default class Scene {
    scene
    camera
    physics
    renderer
    composer
    outlinePass
    onWindowResize
    updatedObjects
    
    constructor(physics) {
        // Сцена
        this.scene = new THREE.Scene();
        physics.scene = this;

        // Камера
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 0, 0);

        // Рендерер
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        // this.renderer.shadowMap.type = THREE.BasicShadowMap;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        // this.renderer.shadowMap.type = THREE.VSMShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.8;
        document.body.appendChild(this.renderer.domElement);
        
        this.composer = new EffectComposer( this.renderer );
        this.composer.addPass( new RenderPass( this.scene, this.camera ) );
        this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
        this.composer.addPass( this.outlinePass );
        this.composer.addPass( new OutputPass() );

        window.addEventListener('resize', this.onWindowResize = this.onWindowResizeHandler.bind(this));
        
        physics.atInit((physics) => {
            this.physics = physics
        })
        this.updatedObjects = [];
    }

    onWindowResizeHandler() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.outlinePass.setSize(window.innerWidth, window.innerHeight);
    }

    add(entity) {
        this.scene.add(entity.mesh);
        if (typeof entity.update === 'function') this.updatedObjects.push(entity);
    }

    remove(entity) {
        this.scene.remove(entity.mesh);
        if (typeof entity.update === 'function') {
            const entityIdx = this.updatedObjects.indexOf(entity);
            if (entityIdx > -1) this.updatedObjects.splice(entityIdx, 1);
        }
    }

    rotateCamera(movementX, movementY, sensitivity) {
        if (movementX == 0 && movementY == 0) return;

        // Применяем вращение к Euler углам
        const euler = new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(this.camera.quaternion);

        // Горизонтальное вращение (вокруг оси Y)
        euler.y -= movementX * sensitivity;
        // Вертикальное вращение (вокруг оси X)
        euler.x -= movementY * sensitivity;

        // Ограничение вертикального вращения
        euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, euler.x));

        // Применяем к камере
        this.camera.quaternion.setFromEuler(euler);
    }

    update(delta) {
        this.updatedObjects.forEach(obj => obj.update(delta))
    }

    render() {
        this.composer.render();
    }
}