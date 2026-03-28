import * as THREE from 'three';

import Location from './Location.js';
import Bucket from '../entities/Bucket.js';
import Bench from '../entities/Bench.js';
import Bench2 from '../entities/Bench2.js';
import Stove from '../entities/Stove.js';
import SaunaBox from '../entities/SaunaBox.js';
import Clock from '../entities/Clock.js';
import Thermometer from '../entities/Thermometer.js';
import Door from '../entities/Door.js';
import Ladle from '../entities/Ladle.js';
// Position:  Vector3 {x: -0.3916890025138855, y: 1.053815245628357, z: -1.1862999200820923}
// ObjectSelector.js:511 Rotation:  Vector3 {x: -0.5698016175787662, y: -0.0006308358037020978, z: 0.8217820384084883}
export default class Sauna extends Location {
    initialize() {
        this.entityDesctiptions = [
            {entityClass: SaunaBox, position: [0, 0, 0], rotation: [0, 0, 0]},
            {entityClass: Door, position: [1.8, 1.1, 2.5], rotation: [0, Math.PI, 0], dependsOn: [[SaunaBox, 0]]},
            {entityClass: Stove, position: [-2.34, 0.53, -1.85], rotation: [0, Math.PI/4, 0]},
            {entityClass: Bench2, position: [0, 0.6, -1.75], rotation: [0, Math.PI, 0]},
            {entityClass: Bench, position: [-2.6, 0.56, 0.1], rotation: [0, Math.PI/2, 0]},
            {entityClass: Clock, position: [0.0, 2.2, -2.48], rotation: [0, 0, 0]},
            {entityClass: Thermometer, position: [-1.5, 2, -2.48], rotation: [0, 0, 0]},
            {entityClass: Bucket, position: [-1.28, 0.289, -2.10], rotation: [0, Math.PI * 1.2,0]},
            // {entityClass: Bucket, position: [-0.26168, 1.15381, -0.9863], rotation: [-0.56980, -0.00063, 0.821782]},
            {entityClass: Ladle, position: [-2.61, 0.8, -0.5], rotation: [0, Math.PI/2, 0]},
        ];
    }

    setupScene() {
        this.scene.scene.fog = new THREE.FogExp2(0x1a0a05, 0.04);
        this.scene.scene.background = new THREE.Color(0x966b4b);
        this.scene.camera.position.set(0, 1.7, 0);
        this.scene.camera.rotation.set(-0.3539372590502969, 0.5705401158060064, 0.19697275212788495);
        // this.scene.camera.rotation.set(0,0,0);
        this.createLighting();
    }

    restoreScene() {
        this.scene.scene.fog = null;
        this.scene.scene.background = null;
        this.scene.camera.position.set(0, 0, 0);
        this.scene.camera.rotation.set(0, 0, 0);
        this.removeLighting();
    }


    createLighting() {
        // Ambient light (мягкое освещение)
        this.ambientLight = new THREE.AmbientLight(0xff9966, 1);
        this.scene.scene.add(this.ambientLight);

        // Дополнительное тёплое освещение сверху
        // const ceilingLight = new THREE.PointLight(0xff8844, 2.0, 6);
        // ceilingLight.position.set(0, 2.7, 1);
        // ceilingLight.castShadow = true;
        // scene.add(ceilingLight);
    }

    removeLighting() {
        this.scene.scene.remove(this.ambientLight);
    }
}