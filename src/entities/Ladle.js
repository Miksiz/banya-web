import * as THREE from 'three';
import Entity from './Entity.js';

export default class Ladle extends Entity {
    initialize() {
        this.cupHeight = 0.15;
        this.cupRadius = 0.05;
        this.cupWallThickness = 0.01;
        this.handleLength = 0.9;
        this.handleRodRadius = 0.01;
        this.handleGripLength = 0.25;
        this.handleGripRadius = 0.02;

        this.cupColor = 0xC4BCBC;
        this.handleColor = 0x8B4513;
        this.meshParts = [];
    }

    async createMesh() {
        const group = new THREE.Group();
        group.interactable = true;

        const cupMaterial = new THREE.MeshStandardMaterial({ 
            color: this.cupColor, 
            roughness: 0.5,
            metalness: 0.3,
        });

        const cupPoints = [
            [0, -this.cupHeight/2],
            [this.cupRadius, -this.cupHeight/2],
            [this.cupRadius, this.cupHeight/2],
            [this.cupRadius-this.cupWallThickness, this.cupHeight/2],
            [this.cupRadius-this.cupWallThickness, -this.cupHeight/2 + this.cupWallThickness],
            [0, -this.cupHeight/2 + this.cupWallThickness],
        ].map(([x, y]) => new THREE.Vector2(x, y));

        const cupGeometry = new THREE.LatheGeometry(cupPoints, 12);
        const cup = new THREE.Mesh(cupGeometry, cupMaterial);
        cup.interactionObject = group;
        this.meshParts.push(cup);
        group.add(cup);

        const handleRodGeometry = new THREE.CylinderGeometry(this.handleRodRadius, this.handleRodRadius, this.handleLength-this.handleGripLength, 8)
        const handleRod = new THREE.Mesh(handleRodGeometry, cupMaterial); 
        handleRod.interactionObject = group;
        handleRod.position.set(-this.cupRadius-(this.handleLength-this.handleGripLength)/2, 0, 0);
        handleRod.rotation.set(0, 0, Math.PI/2);
        this.meshParts.push(handleRod);
        group.add(handleRod);

        const handleMaterial = new THREE.MeshStandardMaterial({ 
            color: this.handleColor, 
            roughness: 0.8,
            metalness: 0.1,
        });
        const handlePoints = [
            [0, -this.handleGripLength/2],
            [this.handleRodRadius, -this.handleGripLength/2],
            [this.handleGripRadius, -this.handleGripLength/2 + this.handleGripRadius/2],
            [this.handleGripRadius, this.handleGripLength/2 - this.handleGripRadius/2],
            [this.handleRodRadius, this.handleGripLength/2],
            [0, this.handleGripLength/2],
        ].map(([x, y]) => new THREE.Vector2(x, y));
        const handleGeometry = new THREE.LatheGeometry(handlePoints, 12);
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.set(-this.cupRadius-this.handleLength+this.handleGripLength/2, 0, 0);
        handle.rotation.set(0, 0, Math.PI/2);
        handle.interactionObject = group;
        this.meshParts.push(handle);
        group.add(handle);

        return group;
    }

    createPhysics() {
        const physics = this.physics;
        const bodyDesc = physics.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(...this.mesh.position)
            .setRotation({w: this.mesh.quaternion.w, x: this.mesh.quaternion.x, y: this.mesh.quaternion.y, z: this.mesh.quaternion.z})
            .setLinearDamping(0.5)
            .setAngularDamping(0.5)
            .setCcdEnabled(true);
            // .setSoftCcdPrediction(8);

        const body = physics.world.createRigidBody(bodyDesc);
        this.physicsBody = body;
        body.userData = { mesh: this.mesh };

        this.meshParts.forEach((boxPart) => {
            const boxPartColliderDesc = physics.RAPIER.ColliderDesc.trimesh(boxPart.geometry.attributes.position.array, boxPart.geometry.index.array)
                .setTranslation(boxPart.position.x, boxPart.position.y, boxPart.position.z)
                .setRotation({ w: boxPart.quaternion.w, x: boxPart.quaternion.x, y: boxPart.quaternion.y, z: boxPart.quaternion.z })
                .setFriction(0.5)
                .setRestitution(0)
                .setDensity(20);
            physics.world.createCollider(boxPartColliderDesc, body);
        })

        this.mesh.userData.physicsBody = body;
        this.mesh.userData.isDynamic = true;
    }
}