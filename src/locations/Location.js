import * as THREE from 'three';

export default class Location {
    scene
    physics
    objectSelector
    entities
    ambientLight

    constructor(scene, physics, objectSelector) {
        this.scene = scene;
        this.physics = physics;
        this.objectSelector = objectSelector;
        this.entityMap = [];
        this.entities = [];
        this.ambientLight = null;
        if (this.initialize) this.initialize();
        if (this.setupScene) this.setupScene();
        this.physics.createPlayer();
        this.addEntities(this.entityMap);
    }

    addEntities(entityArray) {
        this.entities = entityArray.map(({entityClass, position, rotation}) => new entityClass(
                this.scene,
                this.physics,
                this,
                new THREE.Vector3(...position),
                new THREE.Euler(...rotation),
            ));
    }

    removeEntity(entity) {
        const entityIdx = this.entities.indexOf(entity);
        if (entityIdx > -1) this.entities.splice(entityIdx, 1);
    }
    
    destroy() {
        while (this.entities.length > 0) {
            const entity = this.entities.pop();
            entity.destroy();
        }
        this.physics.destroyPlayer();
        this.restoreScene();
    }
}