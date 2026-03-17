import * as THREE from 'three';

export default class Entity {
    mesh
    physicsBody
    friction = 0.8 // Сила трения объекта
    restitution = 0.1 // Упругость объекта

    constructor(
        scene,
        physics,
        position = new THREE.Vector3(0, 0, 0),
        rotation = new THREE.Euler(0, 0, 0),
        scale = 1
    ) {
        if (this.initialize) this.initialize();
        // const meshPromise = this.createMesh().then(mesh => {
        this.createMesh().then(mesh => {
            this.mesh = mesh;
            this.mesh.position.copy(position);
            this.mesh.setRotationFromEuler(rotation);
            this.mesh.scale.multiplyScalar(scale);
            this.mesh.updateMatrix();
            this.mesh.updateMatrixWorld(true);
            scene.add(this.mesh);
            physics.atInit(this.createPhysics.bind(this))
        })
        // this.physicsPromise = Promise.all([meshPromise, rapierPromise]).then(([_, {RAPIER, rapierWorld}]) => this.createPhysics(RAPIER, rapierWorld))
    }

    async createMesh() {
        throw new Error("Method 'createMesh()' must be implemented.");
    }
    
    createPhysics(physics) {
        // Вычисляем bounding box для точных размеров
        const bbox = new THREE.Box3().setFromObject(this.mesh);
        var size = bbox.getSize(new THREE.Vector3());

        const worldPosition = this.mesh.getWorldPosition(new THREE.Vector3());
        const worldQuaternion = this.mesh.getWorldQuaternion(new THREE.Quaternion());

        // Создаём динамическое rigid body
        const bodyDesc = physics.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(worldPosition.x, worldPosition.y, worldPosition.z)
            .setRotation({ w: worldQuaternion.w, x: worldQuaternion.x, y: worldQuaternion.y, z: worldQuaternion.z })
            .setLinearDamping(0.5)     // Сопротивление движению
            .setAngularDamping(0.5);   // Сопротивление вращению

        this.physicsBody = physics.world.createRigidBody(bodyDesc);
        this.physicsBody.userData = { mesh: this.mesh };

        this.mesh.traverse((child) => {
            if (child.isMesh) {
                size = this.computeCuboidDimensions(child);
                const childColliderDesc = physics.RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
                    .setTranslation(child.position.x, child.position.y, child.position.z)
                    .setRotation({ w: child.quaternion.w, x: child.quaternion.x, y: child.quaternion.y, z: child.quaternion.z })
                    .setFriction(this.friction)         // Трение дерева
                    .setRestitution(this.restitution);     // Небольшая упругость
                physics.world.createCollider(childColliderDesc, this.physicsBody);
            }
        });

        this.mesh.userData.physicsBody = this.physicsBody;
        this.mesh.userData.isDynamic = true;
    }

    computeCuboidDimensions(mesh) {
        mesh.geometry.computeBoundingBox();
        const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
        const worldScale = mesh.getWorldScale(new THREE.Vector3());
        size.multiply(worldScale);
        return size;
    }
}