import * as THREE from 'three';
import Entity from './Entity.js';

export default class Clock extends Entity {
    async createMesh() {
        const group = new THREE.Group();
        group.interactable = true;
        
        const clockFaceGeometry = new THREE.CircleGeometry(0.15, 32);
        const clockMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.5, side: THREE.DoubleSide });
        const clockFace = new THREE.Mesh(clockFaceGeometry, clockMaterial);
        clockFace.castShadow = true;
        clockFace.receiveShadow = true;
        clockFace.interactionObject = group;
        group.add(clockFace);
    
        // Рамка часов
        const clockFrameGeometry = new THREE.TorusGeometry(0.15, 0.015, 8, 32);
        const clockFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2810, roughness: 0.6 });
        const clockFrame = new THREE.Mesh(clockFrameGeometry, clockFrameMaterial);
        clockFrame.interactionObject = group;
        group.add(clockFrame);
        this.clockFrame = clockFrame;
    
        // Стрелки
        const hourHandGeo = new THREE.BoxGeometry(0.08, 0.015, 0.003);
        const handMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
        const hourHand = new THREE.Mesh(hourHandGeo, handMaterial);
        hourHand.position.set(0.03, 0, 0.002);
        hourHand.interactionObject = group;
        group.add(hourHand);
    
        const minuteHandGeo = new THREE.BoxGeometry(0.12, 0.01, 0.003);
        const minuteHand = new THREE.Mesh(minuteHandGeo, handMaterial);
        minuteHand.position.set(0.025, 0.04, 0.002);
        minuteHand.rotation.z = Math.PI / 4;
        minuteHand.interactionObject = group;
        group.add(minuteHand);

        return group;   
    }

    createPhysics(physics) {
        const bodyDesc = physics.RAPIER.RigidBodyDesc.fixed()
            .setTranslation(...this.mesh.position)
            .setRotation({w: this.mesh.quaternion.w, x: this.mesh.quaternion.x, y: this.mesh.quaternion.y, z: this.mesh.quaternion.z})
            .setLinearDamping(0.5)     // Сопротивление движению
            .setAngularDamping(100.5);

        const body = physics.world.createRigidBody(bodyDesc);
        this.physicsBody = body;
        body.userData = { mesh: this.mesh };

        // Начальная ориентация Torus в THREE и cylinder в RAPIER отличается на 90гр. по оси x
        const colliderQuaternion = new THREE.Quaternion().copy(this.clockFrame.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2, 0, 0)));
        const colliderDesc = physics.RAPIER.ColliderDesc.cylinder(this.clockFrame.geometry.parameters.tube, this.clockFrame.geometry.parameters.radius+this.clockFrame.geometry.parameters.tube)
            .setTranslation(...this.clockFrame.position)
            .setRotation({w: colliderQuaternion.w, x: colliderQuaternion.x, y: colliderQuaternion.y, z: colliderQuaternion.z});
        physics.world.createCollider(colliderDesc, body);

        
        this.mesh.userData.physicsBody = body;
        this.mesh.userData.isDynamic = true;
    }
}