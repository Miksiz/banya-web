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
    scene.add(this.mesh);
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

    afterInitialization(fn) {
        // this.postInit.push(
        //     this.initialized.then(() => {
        //         try { fn(this) } catch (error) { console.log(error) }
        //     }
        // )
        // );
        this.postInit.push(
            this.initialized.then(() => fn(this))
        );
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
    }

    enableDebug(scene) {
        if (this.rapierDebugRenderer) return;
        this.rapierDebugRenderer = new RapierDebugRenderer(scene, this.world);
    }

    disableDebug() {
        if (!this.rapierDebugRenderer) return;
        this.rapierDebugRenderer.destroy();
        this.rapierDebugRenderer = null;
    }

    toggleDebug(scene) {
        if (!this.rapierDebugRenderer) {
            this.enableDebug(scene);
        } else {
            this.disableDebug();
        }
    }

    update(delta) {
        this.world.timestep = delta;
        this.world.step();
        if (this.rapierDebugRenderer) this.rapierDebugRenderer.update();
    }
}