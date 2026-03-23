import * as THREE from 'three';
import Scene from './Scene.js'
import Physics from './Physics.js';
import ObjectSelector from './ObjectSelector.js';
import PlayerController from './PlayerController.js';
import Sauna from '../locations/Sauna.js';

export default class GameLoop {
    scene
    physics
    objectSelector
    playerController
    location
    timer
    nextAnimationFrameRequestId

    constructor() {
        this.physics = new Physics();
        this.scene = new Scene(this.physics);
        this.objectSelector = new ObjectSelector(this.scene, this.physics);
        this.playerController = new PlayerController(this.scene, this.physics, this.objectSelector, this);
        this.timer = new THREE.Timer();
        this.timer.connect(document);
        this.loadLocation(Sauna);
        this.nextAnimationFrameRequestId = null;
    }

    async init() {
        await this.physics.init();
        
        this.nextAnimationFrameRequestId = requestAnimationFrame(this.update.bind(this));
    }

    getDelta(time) {
        this.timer.update(time);
        return this.timer.getDelta();
    }

    update(time) {
        this.nextAnimationFrameRequestId = requestAnimationFrame(this.update.bind(this));
        const delta = this.getDelta(time);

        this.playerController.update(delta);
        this.objectSelector.update(delta);
        this.physics.update(delta);
        this.scene.update(delta);
        this.scene.render();
    }

    loadLocation(locationClass) {
        this.unloadLocation();
        this.location = new locationClass(this.scene, this.physics, this.objectSelector);
    }

    unloadLocation() {
        if (!this.location) return;
        this.location.destroy();
        this.location = null;
    }
}