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
        this.entityDesctiptions = [];
        this.entityMap = new Map();
        this.entities = [];
        this.ambientLight = null;
        if (this.initialize) this.initialize(); // Тут ожидается, что будет изменено this.entityDescriptions
        if (this.setupScene) this.setupScene();
        this.physics.createPlayer();
        this.addEntities(this.entityDesctiptions);
    }

    addEntities(entityArray) {
        // this.entities = entityArray.map(({entityClass, position, rotation}) => new entityClass(
        //         this.scene,
        //         this.physics,
        //         this,
        //         new THREE.Vector3(...position),
        //         new THREE.Euler(...rotation),
        //     ));
        const toProcessEntities = [...entityArray];
        const failedToProcessEntities = [];
        while (toProcessEntities.length > 0) {
            const {entityClass, position, rotation, dependsOn, resolveIterations} = toProcessEntities.shift();
            const currentIteration = (resolveIterations ?? 0) + 1;
            const dependencies = [];
            if (dependsOn) {
                let foundMissingDependency = false;
                for (const [dependantEntityClass, dependantIdx] of dependsOn) {
                    if (!this.entityMap.has(dependantEntityClass)) {
                        foundMissingDependency = true;
                        break;
                    }
                    const entityMapDepenantEntityClasses = this.entityMap.get(dependantEntityClass)
                    if (dependantIdx < 0 || dependantIdx >= entityMapDepenantEntityClasses.length) {
                        foundMissingDependency = true;
                        break;
                    }
                    dependencies.push(entityMapDepenantEntityClasses[dependantIdx])
                }
                if (foundMissingDependency) {
                    const failedToProcessEntity = {entityClass, position, rotation, dependsOn, resolveIterations: currentIteration};
                    if (currentIteration > 10) failedToProcessEntities.push(failedToProcessEntity)
                    else toProcessEntities.push(failedToProcessEntity);
                    continue;
                }
            }
            // console.log(entityClass, position, rotation, dependencies);
            const entity = new entityClass(
                this.scene,
                this.physics,
                this,
                new THREE.Vector3(...position),
                new THREE.Euler(...rotation),
                dependencies,
            )
            this.entities.push(entity);
            if (!this.entityMap.has(entityClass)) this.entityMap.set(entityClass, new Array());
            this.entityMap.get(entityClass).push(entity);
        }
        if (toProcessEntities.length > 0) {
            console.log('Could not process all entityDesctiptions after 10 dependency resolve iterations! Left items:', toProcessEntities);
        }
    }

    removeEntity(entity) {
        let entityIdx = this.entities.indexOf(entity);
        if (entityIdx > -1) this.entities.splice(entityIdx, 1);
        entityIdx = this.entityMap.get(entity.constructor).indexOf(entity);
        if (entityIdx > -1) this.entityMap.get(entity.constructor).splice(entityIdx, 1);
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