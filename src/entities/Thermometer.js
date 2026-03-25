import * as THREE from 'three';
import Entity from './Entity.js';

export default class Thermometer extends Entity {
    async createMesh() {
        const group = new THREE.Group();
        group.interactable = true;

        const thermoBodyGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6);
        const thermoMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.7,
            roughness: 0.1 
        });
        const thermoBody = new THREE.Mesh(thermoBodyGeometry, thermoMaterial);
        thermoBody.interactionObject = group;
        group.add(thermoBody);
        this.thermoBody = thermoBody;
    
        // Ртуть (температура высокая)
        const mercuryGeometry = new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6);
        const mercuryMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333 });
        const mercury = new THREE.Mesh(mercuryGeometry, mercuryMaterial);
        mercury.position.set(0, -0.02, 0.01);
        mercury.interactionObject = group;
        group.add(mercury);

        return group;   
    }

    createPhysics() {
        const physics = this.physics;
        const bodyDesc = physics.RAPIER.RigidBodyDesc.fixed()
            .setTranslation(...this.mesh.position)
            .setRotation({w: this.mesh.quaternion.w, x: this.mesh.quaternion.x, y: this.mesh.quaternion.y, z: this.mesh.quaternion.z})
            .setLinearDamping(0.5)     // Сопротивление движению
            .setAngularDamping(0.5);

        const body = physics.world.createRigidBody(bodyDesc);
        this.physicsBody = body;
        body.userData = { mesh: this.mesh };

        const colliderDesc = physics.RAPIER.ColliderDesc.cylinder(this.thermoBody.geometry.parameters.height / 2, this.thermoBody.geometry.parameters.radiusBottom)
            .setTranslation(...this.thermoBody.position)
            .setRotation({w: this.thermoBody.quaternion.w, x: this.thermoBody.quaternion.x, y: this.thermoBody.quaternion.y, z: this.thermoBody.quaternion.z});
        physics.world.createCollider(colliderDesc, body);
        
        this.mesh.userData.physicsBody = body;
        this.mesh.userData.isDynamic = true;
    }
}