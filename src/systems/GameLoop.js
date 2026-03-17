export default class GameLoop {
    scene
    camera
    physics
    objectSelector

    constructor() {
        this.scene = null;
        this.physics = null;
        this.playerController = null;
        this.objectSelector = null;
        this.updateBeforePhysics = [];
        this.updateAfterPhysics = [];
    }

    init() {

    }

    update() {

    }
}