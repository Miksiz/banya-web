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
    console.log('added debug mesh', this.mesh);
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
    initialized
    postInit
    rapierDebugRenderer

    constructor() {
        this.debug = false;
        this.world = null;
        this.RAPIER = null;
        this.initialized = new Promise((resolve, reject) => {
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
        this.postInit = [this.initialized];
        this.rapierDebugRenderer = null;
    }

    atInit(fn) {
        this.postInit.push(
            this.initialized.then(() => { try { fn(this) } catch (error) { console.log(error) } })
            // this.initialized.then(() => fn(this))
        );
    }

    createPlayer(height = 1.7, radius = 0.3, cameraToBodyPosition = { x: 0, y: 0.85, z: 0 }) {
        this.atInit(() => this.createPlayerInner(height, radius, cameraToBodyPosition));
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

    async init() {
        await Promise.allSettled(this.postInit);
    }

    updateBodyFromThree(mesh) {
        const body = mesh?.userData?.physicsBody;
        if (!body) return;
        body.setTranslation({...mesh.position});
        body.setRotation({w: mesh.quaternion._w, x: mesh.quaternion._x, y: mesh.quaternion._y, z: mesh.quaternion._z});
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
        this.updateSceneFromPhysics();
        this.world.timestep = delta;
        this.world.step();
        if (this.rapierDebugRenderer) this.rapierDebugRenderer.update();
    }
}