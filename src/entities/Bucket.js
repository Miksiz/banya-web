import * as THREE from 'three';
import Entity from './Entity.js';
import { loadGLBModel } from '../utils/loaders.js'
import bucketModel from "../../assets/woodenbucketa.glb";

export default class Bucket extends Entity {
    waterFillAmount = 0.8

    async createMesh() {
        const bucketGroup = new THREE.Group();
        bucketGroup.interactable = true;

        const model = await loadGLBModel(bucketModel);
        model.scale.copy(new THREE.Vector3(1, 1, 1).multiplyScalar(0.3))
        // Указываем отбрасывание и получение тени
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        model.children[0].children[0].children[0].children[0].interactionObject = bucketGroup;
        bucketGroup.add(model);

        // Рисуем воду в ведре
        if (this.waterFillAmount > 0) {
            const bbox = new THREE.Box3().setFromObject(model);
            const width = bbox.max.x - bbox.min.x;
            const innerRadius = width * 0.82 / 2;
            const dy = bbox.max.y - bbox.min.y;
            const [minFillAmount, maxFillAmount] = [0.2, 0.8];
            const fillAmount = minFillAmount + (maxFillAmount - minFillAmount) * this.waterFillAmount;
            const y = bbox.min.y + dy * fillAmount;
            const waterGeometry = new THREE.CircleGeometry(innerRadius, 12);
            const waterMaterial = new THREE.MeshStandardMaterial({
                color: 0x3366aa,
                transparent: true,
                opacity: 0.6,
                roughness: 0.1,
                metalness: 0.3
            });
            const water = new THREE.Mesh(waterGeometry, waterMaterial);
            water.setRotationFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
            water.position.set(0.02, y, 0);
            water.interactionObject = bucketGroup;
            bucketGroup.add(water);
        }
        return bucketGroup;
    }

    createPhysics() {
        const physics = this.physics;
        // === Добавляем физику для ведра ===
        // Вычисляем bounding box для точных размеров
        const bbox = new THREE.Box3().setFromObject(this.mesh);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        // Создаём динамическое rigid body
        const bucketDesc = physics.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z)
            .setRotation({ w: this.mesh.quaternion.w, x: this.mesh.quaternion.x, y: this.mesh.quaternion.y, z: this.mesh.quaternion.z })
            .setLinearDamping(0.5)     // Сопротивление движению
            .setAngularDamping(0.5);   // Сопротивление вращению

        const bucketBody = physics.world.createRigidBody(bucketDesc);
        this.physicsBody = bucketBody;
        bucketBody.userData = { mesh: this.mesh };

        const bucketPoints = [
            [0, -0.297],
            [0.24, -0.297],
            [0.267, 0.2262],
            [0.231, 0.2262],
            [0.20811, -0.26238],
            [0, -0.26238],
        ].map(([x, y]) => new THREE.Vector2(x, y));

        const bucketGeometry = new THREE.LatheGeometry(bucketPoints, 12);
        const bucketColliderDesc = physics.RAPIER.ColliderDesc.trimesh(bucketGeometry.attributes.position.array, bucketGeometry.index.array)
            .setTranslation(0.0219, 0, 0.003255)
            .setMass(1.0 + 5*this.waterFillAmount) // Масса в кг
            .setFriction(0.6)         // Трение дерева
            .setRestitution(0.2);     // Небольшая упругость

        physics.world.createCollider(bucketColliderDesc, bucketBody);

        this.mesh.userData.physicsBody = bucketBody;
        this.mesh.userData.isDynamic = true;
        this.mesh.userData.rotationStrategy = "overTurn";
    }
}