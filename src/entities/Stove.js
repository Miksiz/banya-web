import * as THREE from 'three';
import Entity from './Entity.js';
import { Flame } from '../utils/textures.js';

export default class Stove extends Entity {
    initialize() {
        this.width = 2.0
        this.depth = 1.5
        this.lowerDepth = 0.6
        this.height = 1.2
        this.seatThickness = 0.08
        this.legThickness = 0.08
        this.backPlankWidth = 0.16
        this.minBackPlankGap = 0.02
        this.color = '#a0522d'
        this.seatMesh = undefined
        this.legMeshes = undefined
    }

    async createMesh() {
        const group = new THREE.Group();
        group.interactable = true;

        // Основание печи
        const baseGeometry = new THREE.BoxGeometry(0.7, 0.9, 1);
        const stoveMaterial = new THREE.MeshStandardMaterial({
            color: 0x656565,
            roughness: 0.9,
            metalness: 0.2
        });
        const base = new THREE.Mesh(baseGeometry, stoveMaterial);
        base.position.set(0, 0, 0);
        base.castShadow = true;
        base.receiveShadow = true;
        base.interactionObject = group;
        group.add(base);

        // Свечение из топки
        this.flame = new Flame();
        const glowGeometry = new THREE.PlaneGeometry(0.4, 0.4);
        const glowMaterial = new THREE.MeshBasicMaterial({
            map: this.flame.texture
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.set(0, 0, 0.501);
        glow.interactionObject = group;
        group.add(glow);

        return group;
    }

    update(delta) {
        this.flame.update(delta);
    }

    createPhysics(physics) {
        return;
        const bbox = new THREE.Box3().setFromObject(this.mesh);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        // Создаём динамическое rigid body
        const bucketDesc = physics.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z)
            .setRotation({ w: this.mesh.quaternion._w, x: this.mesh.quaternion._x, y: this.mesh.quaternion._y, z: this.mesh.quaternion._z })
            .setLinearDamping(0.5)     // Сопротивление движению
            .setAngularDamping(0.5);   // Сопротивление вращению

        const bucketBody = physics.world.createRigidBody(bucketDesc);
        this.physicsBody = bucketBody;
        bucketBody.userData = { mesh: this.mesh };

        // Создаём коллайдер (ящик вместо точной формы для производительности)
        const bucketColliderDesc = physics.RAPIER.ColliderDesc.cylinder(size.y * 0.9 / 2, size.x * 0.65 / 2)
            .setTranslation(0.025, -0.02, 0.0)
            .setMass(1.0 + 5*this.waterFillAmount) // Масса в кг
            .setFriction(0.6)         // Трение дерева
            .setRestitution(0.2);     // Небольшая упругость

        physics.world.createCollider(bucketColliderDesc, bucketBody);

        this.mesh.userData.physicsBody = bucketBody;
        this.mesh.userData.isDynamic = true;
    }
}