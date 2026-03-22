import * as THREE from 'three';
import Entity from './Entity.js';
import { Flame, mesh as createMeshTexture } from '../utils/textures.js';
import { contain } from 'three/src/extras/TextureUtils.js';

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
        this.steamParticles = [];
        this.steamFadeInTime = 0.25;
        this.steamMaxOpacity = 0.15;
        this.steamMaxScale = 3;
        this.base = null;
        this.stonesContainer = null;
        this.pipeProtector = null;
        this.glow = null;
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
        this.base = base;


        // Свечение из топки
        this.flame = new Flame();
        const glowGeometry = new THREE.PlaneGeometry(0.4, 0.4);
        const glowMaterial = new THREE.MeshBasicMaterial({
            map: this.flame.texture,
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.set(0, 0, 0.501);
        // glow.receiveShadow = false;
        // glow.castShadow = false;
        glow.interactionObject = group;
        group.add(glow);
        this.glow = glow;

        this.light = new THREE.SpotLight('rgba(255, 150, 50, 1)', this.flame.intensity*10, 5, Math.PI/2.2, 0.5, 0.5);
        this.light.castShadow = true;
        this.light.position.set(0, 0, 0.5);
        this.light.target = glow;
        group.add(this.light);

        // Контейнер для камней
        const meshTexture = createMeshTexture('#302c29ff');
        const containerMaterial = new THREE.MeshStandardMaterial({
            map: meshTexture,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
            roughness: 0.6,
            metalness: 0.4
        });
        const stonesContainerGeometry = new THREE.CylinderGeometry(0.5, 0.35, 0.35, 24, 1, true);
        const stonesContainer = new THREE.Mesh(stonesContainerGeometry, containerMaterial);
        stonesContainer.position.set(0, 0.55, -0.15);
        stonesContainer.castShadow = true;
        stonesContainer.interactionObject = group;
        group.add(stonesContainer);
        this.stonesContainer = stonesContainer;
        // console.log(this.stonesContainer)

        // Камни
        for (let i = 0; i < 35; i++) {
            const stoneRadius = 0.08 + Math.random() * 0.03;
            const stoneGeometry = new THREE.DodecahedronGeometry(stoneRadius, 0);
            const stoneMaterial = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(0.05 + Math.random() * 0.05, 0.2, 0.25 + Math.random() * 0.15),
                roughness: 0.8,
                metalness: 0.1
            });
            const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
            const height = (0.3/35)*i;
            const angle = Math.PI*8*(i/34);
            const radius = 0.35+0.15*(height/0.3)-stoneRadius*0.8;
            stone.position.set(
                0 + Math.cos(angle) * radius,
                0.5 + height,
                -0.15 + Math.sin(angle) * radius
            );
            stone.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            stone.castShadow = true;
            stone.receiveShadow = true;
            stone.interactionObject = group;
            group.add(stone);
        }

        const pipeProtectorGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.8, 12, 1, true);
        const pipeProtector = new THREE.Mesh(pipeProtectorGeometry, containerMaterial);
        pipeProtector.position.set(0, 0.85, -0.15);
        pipeProtector.castShadow = true;
        pipeProtector.interactionObject = group;
        group.add(pipeProtector);
        this.pipeProtector = pipeProtector;

        // Труба
        const pipeGeometry = new THREE.CylinderGeometry(0.14, 0.14, 2.2, 12);
        const pipe = new THREE.Mesh(pipeGeometry, stoveMaterial);
        pipe.position.set(0, 1.55, -0.15);
        pipe.castShadow = true;
        pipe.receiveShadow = true;
        pipe.interactionObject = group;
        group.add(pipe);
        this.pipe = pipe;

        this.steamMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.createSteamParticle(group);

        return group;
    }
    
    createSteamParticle(group) {
        const size = 0.15 + Math.random() * 0.05;
        const geometry = new THREE.CircleGeometry(size, 12);
        const steam = new THREE.Mesh(geometry, this.steamMaterial.clone());
        steam.material.opacity = 0;
        
        const angle = Math.PI*2*Math.random();
        // const radius = 0.5-size*0.8
        const radius = 0.4+Math.random()*0.1;
        steam.position.set(
            0 + Math.cos(angle) * radius,
            0.8,
            -0.15 + Math.sin(angle) * radius
        );
        
        steam.rotation.set(
            // Math.PI/2+Math.PI/12*Math.random(),
            Math.PI/6*Math.random(),
            Math.PI*2*Math.random(),
            Math.PI/6*Math.random()
        );
        
        steam.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                0.2 + Math.random() * 0.3,
                (Math.random() - 0.5) * 0.2
            ),
            life: 0,
            maxLife: 3 + Math.random() * 1
        };
        steam.interactionObject = group
        group.add(steam);
        this.steamParticles.push(steam);
    }

    updateSteam(delta) {
        const leftSteamParticles = [];
        while (this.steamParticles.length > 0) {
            const steam = this.steamParticles.pop();
            steam.userData.life += delta;
            
            if (steam.userData.life > steam.userData.maxLife) {
                this.mesh.remove(steam);
                continue;
            }

            steam.position.add(steam.userData.velocity.clone().multiplyScalar(delta));

            if (steam.userData.life < this.steamFadeInTime) {
                steam.material.opacity = this.steamMaxOpacity * (steam.userData.life / this.steamFadeInTime);
            } else {
                steam.material.opacity = this.steamMaxOpacity * (1 - ((steam.userData.life-this.steamFadeInTime) / (steam.userData.maxLife-this.steamFadeInTime)));
                steam.scale.setScalar(1 + (this.steamMaxScale-1) * ((steam.userData.life-this.steamFadeInTime) / (steam.userData.maxLife-this.steamFadeInTime)));
            }
            leftSteamParticles.push(steam);
        }
        this.steamParticles = leftSteamParticles;
        if (Math.random() < 0.05) this.createSteamParticle(this.mesh);
    }

    update(delta) {
        this.flame.update(delta);
        this.light.intensity = this.flame.intensity*10;
        this.updateSteam(delta);
    }

    createPhysics(physics) {
        const bodyDesc = physics.RAPIER.RigidBodyDesc.fixed()
            .setTranslation(...this.mesh.position)
            .setRotation({w: this.mesh.quaternion.w, x: this.mesh.quaternion.x, y: this.mesh.quaternion.y, z: this.mesh.quaternion.z});

        const body = physics.world.createRigidBody(bodyDesc);
        this.physicsBody = body;
        body.userData = { mesh: this.mesh };

        const baseColliderDesc = physics.RAPIER.ColliderDesc.cuboid(this.base.geometry.parameters.width / 2, this.base.geometry.parameters.height / 2, this.base.geometry.parameters.depth / 2)
            .setTranslation(...this.base.position)
            .setRotation({w: this.base.quaternion.w, x: this.base.quaternion.x, y: this.base.quaternion.y, z: this.base.quaternion.z});
        physics.world.createCollider(baseColliderDesc, body);

        const upperPathPoints = [
            new THREE.Vector2(0,0),
            new THREE.Vector2(this.stonesContainer.geometry.parameters.radiusBottom,0),
            new THREE.Vector2(this.stonesContainer.geometry.parameters.radiusTop,this.stonesContainer.geometry.parameters.height),
            new THREE.Vector2(this.stonesContainer.geometry.parameters.radiusTop,this.stonesContainer.geometry.parameters.height*1.3),
            new THREE.Vector2(this.pipeProtector.geometry.parameters.radiusBottom,this.stonesContainer.geometry.parameters.height*1.5),
            new THREE.Vector2(
                this.pipeProtector.geometry.parameters.radiusTop,
                this.stonesContainer.geometry.parameters.height/2 + this.pipeProtector.position.y - this.stonesContainer.position.y + this.pipeProtector.geometry.parameters.height/2
            ),
            new THREE.Vector2(
                this.pipe.geometry.parameters.radiusBottom,
                this.stonesContainer.geometry.parameters.height/2 + this.pipeProtector.position.y - this.stonesContainer.position.y + this.pipeProtector.geometry.parameters.height/2
            ),
            new THREE.Vector2(
                this.pipe.geometry.parameters.radiusTop,
                this.stonesContainer.geometry.parameters.height/2 + this.pipe.position.y - this.stonesContainer.position.y + this.pipe.geometry.parameters.height/2
            ),
            new THREE.Vector2(
                0,
                this.stonesContainer.geometry.parameters.height/2 + this.pipe.position.y - this.stonesContainer.position.y + this.pipe.geometry.parameters.height/2
            ),
            
        ];
        const upperGeometry = new THREE.LatheGeometry(upperPathPoints, this.stonesContainer.geometry.parameters.radialSegments/2);
        // const stonesContainerColliderDesc = physics.RAPIER.ColliderDesc.trimesh(this.stonesContainer.geometry.attributes.position.array, this.stonesContainer.geometry.index.array)
        const upperColliderDesc = physics.RAPIER.ColliderDesc.trimesh(upperGeometry.attributes.position.array, upperGeometry.index.array)
            .setTranslation(this.stonesContainer.position.x, this.stonesContainer.position.y-this.stonesContainer.geometry.parameters.height*0.5, this.stonesContainer.position.z)
            .setRotation({ w: this.stonesContainer.quaternion.w, x: this.stonesContainer.quaternion.x, y: this.stonesContainer.quaternion.y, z: this.stonesContainer.quaternion.z });
        
        physics.world.createCollider(upperColliderDesc, body);

        

        this.mesh.userData.physicsBody = body;
        // this.mesh.userData.isDynamic = true;
    }
}