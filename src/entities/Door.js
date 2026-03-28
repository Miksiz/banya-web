import * as THREE from 'three';
import Entity from './Entity.js';
import { wood as createWoodTexture } from '../utils/textures.js';

export default class Door extends Entity {
    initialize() {
        this.width = 1.11;
        this.height = 2.11;
        this.thickness = 0.1;
        this.doorColor = '#4b2d1bff';
        this.doorHandleColor = 0x8B4513;
        this.boxParts = [];
        this.density = 20.0;
        this.preferredPosition = new THREE.Vector3(0,0,0);
    }

    async createMesh() {
        const group = new THREE.Group();
        group.interactable = true;

        const doorTexture = createWoodTexture(this.doorColor);

        // Дверь
        const doorGeometry = new THREE.BoxGeometry(this.width, this.height, this.thickness);
        const doorMaterial = new THREE.MeshStandardMaterial({
            map: doorTexture,
            roughness: 0.9,
            metalness: 0.05,
            side: THREE.DoubleSide
        });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        // door.position.set(0.005, 0, 0);
        door.receiveShadow = true;
        door.castShadow = true;
        door.interactionObject = group;
        group.add(door);
        this.boxParts.push(door);

        // Дверная ручка
        const handleGeometry = new THREE.CylinderGeometry(0.03, 0.03, this.thickness+0.15, 8);
        const handle = new THREE.Mesh(
            handleGeometry,
            new THREE.MeshStandardMaterial({ color: this.doorHandleColor, roughness: 0.9, metalness: 0.1 })
        );
        handle.rotation.set(Math.PI / 2, 0, 0)
        handle.position.set(-0.42, 0, 0);
        handle.receiveShadow = true;
        handle.castShadow = true;
        handle.interactionObject = group;
        group.add(handle);

        return group;   
    }

    createPhysics() {
        const physics = this.physics;
        const bodyDesc = physics.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(...this.mesh.position)
            .setRotation({w: this.mesh.quaternion.w, x: this.mesh.quaternion.x, y: this.mesh.quaternion.y, z: this.mesh.quaternion.z})
            .setLinearDamping(0.5)     // Сопротивление движению
            .setAngularDamping(0.5);   // Сопротивление вращению

        const body = physics.world.createRigidBody(bodyDesc);
        body.userData = { mesh: this.mesh };
        this.physicsBody = body;
        this.mesh.userData.physicsBody = body;
        this.mesh.userData.isDynamic = true;

        this.boxParts.forEach((boxPart) => {
            const boxPartColliderDesc = physics.RAPIER.ColliderDesc.trimesh(boxPart.geometry.attributes.position.array, boxPart.geometry.index.array)
                .setTranslation(boxPart.position.x, boxPart.position.y, boxPart.position.z)
                .setRotation({ w: boxPart.quaternion.w, x: boxPart.quaternion.x, y: boxPart.quaternion.y, z: boxPart.quaternion.z })
                .setDensity(this.density);
            physics.world.createCollider(boxPartColliderDesc, body);
        })

        const saunaBox = this.dependencies[0];
        // const doorConnectionPosition = new THREE.Vector3(this.width/2, 0.0, this.thickness/2);
        const doorConnectionPosition = new THREE.Vector3(this.width/2, 0.0, 0.0435);
        const saunaConnectionPosition = saunaBox.mesh.worldToLocal(this.mesh.localToWorld(new THREE.Vector3().copy(doorConnectionPosition)))
        const revoluteVector = { x: 0, y: 1, z: 0 };
        const jointData = physics.RAPIER.JointData.revolute(doorConnectionPosition, saunaConnectionPosition, revoluteVector)

        physics.world.createImpulseJoint(jointData, body, saunaBox.physicsBody, true);
    }

    update(delta) {
        const currentPositionRp = this.physicsBody.translation();
        const currentPosition = new THREE.Vector3(currentPositionRp.x, currentPositionRp.y, currentPositionRp.z);
        const toPreferredPositionVec = new THREE.Vector3().copy(this.preferredPosition).sub(currentPosition);
        const toPreferredPositionLength = toPreferredPositionVec.length();
        if (toPreferredPositionLength < 0.01) {
            return;
        } else if (toPreferredPositionLength > 0.05) {
            return;
        }
        const linVel = this.physicsBody.linvel();
        const currentLinVel = new THREE.Vector3(linVel.x, linVel.y, linVel.z);

        const newLinVel = new THREE.Vector3().copy(currentLinVel).add(new THREE.Vector3().copy(toPreferredPositionVec).sub(currentLinVel).multiplyScalar(20).sub(new THREE.Vector3().copy(currentLinVel).multiplyScalar(0.05)).multiplyScalar(delta));
        this.physicsBody.setLinvel({ x: newLinVel.x, y: newLinVel.y, z: newLinVel.z }, true);
    }
}