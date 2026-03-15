export default class Sauna {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
    }

    init() {
        this.scene.fog = new THREE.FogExp2(0x1a0a05, 0.04);
        this.scene.background = new THREE.Color(0x966b4b);
        this.camera.position.set(0, 0, 0);
    }

    destoy() {
        this.scene.fog = null;
        this.scene.background = null;
    }

}