import * as THREE from 'three';

import Sauna from '../locations/Sauna.js';

export default class PlayerController {
    scene
    physics
    objectSelector
    gameLoop
    movementHandlers
    touchActivity
    isLocked = false
    moveForward = false
    moveBackward = false
    moveLeft = false
    moveRight = false
    maxPlayerSpeed = 3
    speedChangeInterpolationFactor = 0.15
    mouseSensitivity = 0.002
    touchSensitivity = 0.003

    constructor(scene, physics, objectSelector, gameLoop) {
        this.scene = scene;
        this.physics = physics;
        this.objectSelector = objectSelector;
        this.gameLoop = gameLoop;
        this.movementHandlers = [];
        this.touchActivity = {
            inProgress: false,
            touchId: undefined,
            x: undefined,
            y: undefined,
        };
        this.objectSelectorLastState = true;

        this.setupPointerLockControls();
    }

    onPointerLockEnable() {
        document.getElementById('click-to-start').classList.add('hidden');
        document.getElementById('instructions').classList.add('hidden');
        document.getElementById('crosshair').classList.remove('hidden');
        document.getElementById('temp-indicator').classList.remove('hidden');
        if (this.objectSelectorLastState) this.objectSelector.enable();

        this.setupMovementControls();
    }

    onPointerLockDisable() {
        document.getElementById('click-to-start').classList.remove('hidden');
        document.getElementById('instructions').classList.remove('hidden');
        document.getElementById('crosshair').classList.add('hidden');
        document.getElementById('temp-indicator').classList.add('hidden');
        this.objectSelector.disable();

        this.removeMovementControls();
    }

    setupPointerLockControls() {
        // Клик для активации управления от первого лица
        document.getElementById('click-to-start').addEventListener('click', () => {
            document.body.requestPointerLock();
        });

        // Блокировка указателя
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === document.body;
            
            if (this.isLocked) this.onPointerLockEnable()
            else this.onPointerLockDisable();
        });
    }

    onMouseMove(event) {
        if (this.objectSelector.pickedRotating) {
            this.objectSelector.rotate(event.movementX || 0, event.movementY || 0, this.mouseSensitivity);
            return;
        } else {
            this.scene.rotateCamera(event.movementX || 0, event.movementY || 0, this.mouseSensitivity);
        }
    }

    onTouchStart(event) {
        if (this.touchActivity.inProgress) return;
        this.touchActivity.inProgress = true;
        this.touchActivity.touchId = event.changedTouches[0].identifier;
        this.touchActivity.x = event.changedTouches[0].screenX;
        this.touchActivity.y = event.changedTouches[0].screenY;
    }

    onTouchMove(event) {
        if (!this.touchActivity.inProgress) return;
        for (const touch of event.changedTouches) {
            if (touch.identifier != this.touchActivity.touchId) continue;
            const dx = touch.screenX - this.touchActivity.x;
            const dy = touch.screenY - this.touchActivity.y;
            this.touchActivity.x = touch.screenX;
            this.touchActivity.y = touch.screenY;
            // Для касаний - обратное направление поворота, чтобы совпадало с направлением движения пальца
            this.scene.rotateCamera(-dx, -dy, this.touchSensitivity);
        }
    }

    onTouchEnd(event) {
        if (!this.touchActivity.inProgress) return;
        for (const touch of event.changedTouches) {
            if (touch.identifier != this.touchActivity.touchId) continue;
            this.touchActivity.inProgress = false;
            this.touchActivity.touchId = undefined;
            this.touchActivity.x = undefined;
            this.touchActivity.y = undefined;
        }
    }

    onMouseDown(event) {
        if (!this.objectSelector.enabled) return;
        if (event.button == 0) {
            this.objectSelector.pickUpToggle();
        } else if (event.button == 1) {
            this.objectSelector.delete();
        } else if (event.button == 2) {
            this.objectSelector.rotationStart();
        }
    }

    onMouseUp(event) {
        if (!this.objectSelector.enabled) return;
        if (event.button == 2) {
            this.objectSelector.rotationStop();
        }
    }

    onWheel(event) {
        if (!this.objectSelector.enabled) return;
        // Передаем обратное значение
        // Колесо вниз - event.deltaY положительное - сдивинуть к себе, т.е. уменьшить, поэтому значение обратное
        this.objectSelector.changeObjectHoldDistance(-event.deltaY);
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveForward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.moveBackward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.moveLeft = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.moveRight = true;
                break;
            case 'KeyC':
                this.objectSelector.toggle();
                this.objectSelectorLastState = !this.objectSelectorLastState;
                break;
            case 'KeyX':
                this.objectSelector.toggleHorizontalRotation();
                break;
            case 'KeyZ':
                this.objectSelector.toggleVerticalRotation();
                break;
            case 'KeyB':
                this.objectSelector.log_object_parameters();
                break;
            case 'KeyN':
                if (this.physics.initialized) this.physics.toggleDebug();
                break;
            case 'KeyM':
                console.log(this.scene.camera.rotation);
                console.log(this.scene.camera.quaternion);
                break;
            case 'KeyJ':
                this.gameLoop.loadLocation(Sauna);
                break;
            // case 'KeyK':
            //     this.gameLoop.unloadLocation()
            //     break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.moveForward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.moveBackward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.moveLeft = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.moveRight = false;
                break;
        }
    }

    addMovementEventListener(eventType, handler) {
        const boundHandlerReference = handler.bind(this);
        document.addEventListener(eventType, boundHandlerReference);
        this.movementHandlers.push({ eventType, handler: boundHandlerReference });
    }

    setupMovementControls() {
        this.addMovementEventListener('mousemove', this.onMouseMove);

        this.touchActivity = {
            inProgress: false,
            touchId: undefined,
            x: undefined,
            y: undefined,
        }
        this.addMovementEventListener('touchstart', this.onTouchStart);
        this.addMovementEventListener('touchmove', this.onTouchMove);
        this.addMovementEventListener('touchend', this.onTouchEnd);
        this.addMovementEventListener('touchcancel', this.onTouchEnd);

        this.addMovementEventListener('mousedown', this.onMouseDown);
        this.addMovementEventListener('mouseup', this.onMouseUp);
        this.addMovementEventListener('wheel', this.onWheel);

        // Клавиатура
        this.addMovementEventListener('keydown', this.onKeyDown);
        this.addMovementEventListener('keyup', this.onKeyUp);
    }

    removeMovementControls() {
        while (this.movementHandlers.length > 0) {
            const movementHandler = this.movementHandlers.pop();
            document.removeEventListener(movementHandler.eventType, movementHandler.handler);
        }
    }

    updatePlayerVelocity() {
        if (!this.physics.player) return;

        // Вычисляем направление движения на основе ввода
        const direction = new THREE.Vector3(
            Number(this.moveLeft) - Number(this.moveRight),
            0,
            Number(this.moveForward) - Number(this.moveBackward),
        ).normalize().multiplyScalar(this.maxPlayerSpeed);

        this.scene.camera.updateMatrixWorld();
        const cameraQuaternion = this.scene.camera.getWorldQuaternion(new THREE.Quaternion());
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternion);
        forward.y = 0;
        forward.normalize();
        const yAngle = Math.atan2(forward.x, forward.z);
        const cameraYQuaternion = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yAngle
        );

        const currentLinvel = this.physics.player.linvel();
        const targetVelocity = new THREE.Vector3(0, currentLinvel.y, 0).add(direction).applyQuaternion(cameraYQuaternion);
        const newVelocity = new THREE.Vector3(currentLinvel.x, currentLinvel.y, currentLinvel.z).lerp(targetVelocity, this.speedChangeInterpolationFactor);

        this.physics.player.setLinvel(newVelocity, true);
    }

    update(delta) {
        this.updatePlayerVelocity();
    }

}