import * as THREE from 'three';

const gravity = { x: 0.0, y: -9.81, z: 0.0 }

class RapierDebugRenderer {
  mesh
  world
  enabled = true;

  constructor(scene, world) {
    this.world = world;
    this.mesh = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: true }));
    this.mesh.frustumCulled = false;
    this.mesh.intersectable = false;
    this.mesh.visible = true;
    scene.scene.add(this.mesh);
  }

  update() {
    const { vertices, colors } = this.world.debugRender()
    this.mesh.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    this.mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
  }

  destroy() {
    this.mesh.parent.remove(this.mesh);
  }
}

export default class Physics {
    RAPIER
    world
    player
    cameraToBodyPosition
    scene
    debug
    libraryInitialized
    initialized
    postInit
    rapierDebugRenderer

    constructor() {
        this.initialized = false;
        this.debug = false;
        this.world = null;
        this.RAPIER = null;
        this.libraryInitialized = new Promise((resolve, reject) => {
            import('@dimforge/rapier3d')
            .then(
                (RAPIER) => {
                    this.RAPIER = RAPIER;
                    this.world = new RAPIER.World(gravity);
                    resolve(true);
                }
            ).catch((error) => {
                console.log('Ошибка инициализации Rapier:', error);
                reject(error);
            });
        })
        this.postInit = [this.libraryInitialized];
        this.rapierDebugRenderer = null;
    }

    atInit(fn) {
        const atInitPromise = this.libraryInitialized.then(() => { try { fn(this) } catch (error) { console.log(error) } })
        this.postInit.push(atInitPromise);
        return atInitPromise;
    }

    createPlayer(height = 1.7, radius = 0.3, cameraToBodyPosition = { x: 0, y: 0.85, z: 0 }) {
        return this.atInit(() => this.createPlayerInner(height, radius, cameraToBodyPosition));
    }

    createPlayerInner(height, radius, cameraToBodyPosition) {
        // Это позволяет телу сталкиваться со стенами и препятствиями
        const playerDesc = this.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(
                this.scene.camera.position.x - cameraToBodyPosition.x,
                this.scene.camera.position.y - cameraToBodyPosition.y,
                this.scene.camera.position.z - cameraToBodyPosition.z,
            )
            .setLinvel(0, 0, 0)
            .lockRotations();  // Запрещаем вращение тела — оно всегда вертикально
        
        this.player = this.world.createRigidBody(playerDesc);
        this.cameraToBodyPosition = cameraToBodyPosition;
        
        // Капсула для игрока
        const playerColliderDesc = this.RAPIER.ColliderDesc.capsule(
            height / 2 - radius,  // half-height цилиндра (без полусфер)
            radius
        )
            .setFriction(0.0)        // Без трения при скольжении
            .setRestitution(0.0);    // Без упругости
        
        this.world.createCollider(playerColliderDesc, this.player);
    }

    destroyPlayer() {
        this.world.removeRigidBody(this.player);
        this.player = undefined;
    }

    async init() {
        await Promise.allSettled(this.postInit);
        this.initialized = true;
    }

    updateBodyFromThree(mesh) {
        const body = mesh?.userData?.physicsBody;
        if (!body) return;

        body.setTranslation(mesh.position, true);
        body.setRotation(mesh.quaternion, true);
    }

    updateSceneFromPhysics() {
        this.world.forEachActiveRigidBody((body) => {
            const mesh = body?.userData?.mesh;
            if (!mesh) return;
            const position = body.translation();
            const rotation = body.rotation();
            mesh.position.set(position.x, position.y, position.z);
            mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        })
        // Для тела игрока обновляется только позиция, без поворота камеры
        if (!this.player) return;
        const position = this.player.translation();
        this.scene.camera.position.set(
            position.x + this.cameraToBodyPosition.x,
            position.y + this.cameraToBodyPosition.y,
            position.z + this.cameraToBodyPosition.z,
        );
    }

    enableDebug() {
        if (this.rapierDebugRenderer) return;
        this.rapierDebugRenderer = new RapierDebugRenderer(this.scene, this.world);
    }

    disableDebug() {
        if (!this.rapierDebugRenderer) return;
        this.rapierDebugRenderer.destroy();
        this.rapierDebugRenderer = null;
    }

    toggleDebug() {
        if (!this.rapierDebugRenderer) {
            this.enableDebug();
        } else {
            this.disableDebug();
        }
    }

    update(delta) {
        this.world.timestep = delta;
        this.world.step();
        this.updateSceneFromPhysics();
        if (this.rapierDebugRenderer) this.rapierDebugRenderer.update();
    }
}