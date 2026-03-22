import * as THREE from 'three';
import Entity from './Entity.js';
import { wood as createWoodTexture } from '../utils/textures.js';

export default class SaunaBox extends Entity {
    initialize() {
        this.width = 6.0;
        this.depth = 5.0;
        this.height = 3.0;
        this.wallColor = '#8B4513';
        this.floorColor = '#5a3520';
        this.ceilingColor = '#a0522d';
        this.doorColor = '#4b2d1bff';
        this.leftFrameOffset = 1.2;
        this.rightFrameOffset = 2.4;
        this.doorFrameColor = 0x8B4513;
        this.frameThickness = 0.08;
        this.boxParts = [];
    }

    async createMesh() {
        const group = new THREE.Group();

        const wallTexture = createWoodTexture(this.wallColor);
        const ceilingTexture = createWoodTexture(this.ceilingColor);
        const floorTexture = createWoodTexture(this.floorColor);
        const doorTexture = createWoodTexture(this.doorColor);

        // Пол
        const floorGeometry = new THREE.PlaneGeometry(this.width, this.depth);
        const floorMaterial = new THREE.MeshStandardMaterial({
            map: floorTexture,
            roughness: 0.9,
            metalness: 0.1
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        group.add(floor);
        this.boxParts.push(floor);

        // Потолок
        const ceilingGeometry = new THREE.PlaneGeometry(this.width, this.depth);
        const ceilingMaterial = new THREE.MeshStandardMaterial({
            map: ceilingTexture,
            roughness: 0.8,
            metalness: 0.1
        });
        const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceiling.position.y = this.height;
        ceiling.rotation.x = Math.PI / 2;
        ceiling.receiveShadow = true;
        group.add(ceiling);
        this.boxParts.push(ceiling);

        // Стены
        const wallMaterial = new THREE.MeshStandardMaterial({
            map: wallTexture,
            roughness: 0.85,
            metalness: 0.05
        });

        // Задняя стена
        const backWall = new THREE.Mesh(
            new THREE.PlaneGeometry(this.width, this.height),
            wallMaterial
        );
        backWall.position.set(0, this.height / 2, -this.depth / 2);
        backWall.receiveShadow = true;
        group.add(backWall);
        this.boxParts.push(backWall);

        // Левая стена
        const leftWall = new THREE.Mesh(
            new THREE.PlaneGeometry(this.depth, this.height),
            wallMaterial
        );
        leftWall.position.set(-this.width / 2, this.height / 2, 0);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.receiveShadow = true;
        group.add(leftWall);
        this.boxParts.push(leftWall);

        // Правая стена
        const rightWall = new THREE.Mesh(
            new THREE.PlaneGeometry(this.depth, this.height),
            wallMaterial
        );
        rightWall.position.set(this.width / 2, this.height / 2, 0);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.receiveShadow = true;
        rightWall.castShadow = true;
        group.add(rightWall);
        this.boxParts.push(rightWall);

        // Верхняя часть над дверью
        const topPart = new THREE.Mesh(
            new THREE.PlaneGeometry(this.width, 0.8),
            wallMaterial
        );
        topPart.position.set(0, this.height - 0.4, this.depth / 2);
        topPart.rotation.y = Math.PI;
        topPart.receiveShadow = true;
        topPart.castShadow = true;
        group.add(topPart);
        this.boxParts.push(topPart);

        // Левая часть стены
        const leftPart = new THREE.Mesh(
            new THREE.PlaneGeometry(this.width / 2 + this.leftFrameOffset, this.height - 0.8),
            wallMaterial
        );
        leftPart.position.set(this.leftFrameOffset/2 - this.width/4, (this.height - 0.8) / 2, this.depth / 2);
        leftPart.rotation.y = Math.PI;
        leftPart.receiveShadow = true;
        group.add(leftPart);
        this.boxParts.push(leftPart);
        
        // Правая часть стены
        const rightPart = new THREE.Mesh(
            new THREE.PlaneGeometry(this.width / 2 - this.rightFrameOffset, this.height - 0.8),
            wallMaterial
        );

        rightPart.position.set(this.rightFrameOffset/2 + this.width/4, (this.height - 0.8) / 2, this.depth / 2);
        rightPart.rotation.y = Math.PI;
        rightPart.receiveShadow = true;
        group.add(rightPart);
        this.boxParts.push(rightPart);

        // Рама двери
        const doorFrameMaterial = new THREE.MeshStandardMaterial({ color: this.doorFrameColor, roughness: 0.9, metalness: 0.1 });

        // Вертикальные части рамы
        const frameGeo = new THREE.BoxGeometry(this.frameThickness, 2.2, this.frameThickness);
        const leftFrame = new THREE.Mesh(frameGeo, doorFrameMaterial);
        leftFrame.position.set(this.leftFrameOffset, 1.1, this.depth / 2);
        leftFrame.receiveShadow = true;
        leftFrame.castShadow = true;
        group.add(leftFrame);
        
        const rightFrame = new THREE.Mesh(frameGeo, doorFrameMaterial);
        rightFrame.position.set(this.rightFrameOffset, 1.1, this.depth / 2);
        rightFrame.receiveShadow = true;
        rightFrame.castShadow = true;
        group.add(rightFrame);
        
        // Горизонтальная часть рамы
        const topFrame = new THREE.Mesh(
            new THREE.BoxGeometry((this.rightFrameOffset-this.leftFrameOffset) + this.frameThickness * 2, this.frameThickness, this.frameThickness),
            doorFrameMaterial
        );
        topFrame.position.set((this.rightFrameOffset+this.leftFrameOffset)/2, 2.2, this.depth / 2);
        topFrame.receiveShadow = true;
        topFrame.castShadow = true;
        group.add(topFrame);

        // Дверь
        const doorGeometry = new THREE.PlaneGeometry(this.rightFrameOffset-this.leftFrameOffset, 2.2);
        const doorMaterial = new THREE.MeshStandardMaterial({
            map: doorTexture,
            roughness: 0.9,
            metalness: 0.05
        });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set((this.rightFrameOffset+this.leftFrameOffset)/2, 1.1, this.depth / 2 - 0.01);
        door.rotation.y = Math.PI;
        door.receiveShadow = true;
        group.add(door);
        this.boxParts.push(door);

        // Дверная ручка
        const handleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8);
        const handle = new THREE.Mesh(handleGeometry, doorFrameMaterial);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(this.rightFrameOffset-0.18, 1.1, this.depth / 2 - 0.05);
        handle.receiveShadow = true;
        handle.castShadow = true;
        group.add(handle);

        return group;   
    }

    createPhysics(physics) {
        const bodyDesc = physics.RAPIER.RigidBodyDesc.fixed()
            .setTranslation(...this.mesh.position)
            .setRotation({w: this.mesh.quaternion.w, x: this.mesh.quaternion.x, y: this.mesh.quaternion.y, z: this.mesh.quaternion.z});

        const body = physics.world.createRigidBody(bodyDesc);
        this.physicsBody = body;
        body.userData = { mesh: this.mesh };

        this.boxParts.forEach((boxPart) => {
            const boxPartColliderDesc = physics.RAPIER.ColliderDesc.trimesh(boxPart.geometry.attributes.position.array, boxPart.geometry.index.array)
                .setTranslation(boxPart.position.x, boxPart.position.y, boxPart.position.z)
                .setRotation({ w: boxPart.quaternion.w, x: boxPart.quaternion.x, y: boxPart.quaternion.y, z: boxPart.quaternion.z });
            physics.world.createCollider(boxPartColliderDesc, body);
        })

        this.mesh.userData.physicsBody = body;
    }
}