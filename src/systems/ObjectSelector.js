import * as THREE from 'three';

export default class ObjectSelector {
    enabled
    selected
    raycaster
    pickedUp
    pickedRotating
    verticalRotationOn
    horizontalRotationOn
    scene
    physics


    // Константы
    objectMoveSpeed = 8.0
    objectHoldMinDistance = 0.5
    objectHoldMaxDistance = 5
    objectHoldDefaultDistance = 2
    objectRotateSpeed = 8.0

    // Переменные
    objectHoldDistance
    objectRotation

  constructor(scene, physics) {
    this.enabled = false;
    this.selected = undefined;
    this.raycaster = new THREE.Raycaster();
    this.pickedUp = undefined;
    this.pickedRotating = undefined;
    this.verticalRotationOn = true;
    this.horizontalRotationOn = true;

    
    // Константы
    this.objectMoveSpeed = 8.0;
    this.objectHoldMinDistance = 0.5;
    this.objectHoldMaxDistance = 5;
    this.objectHoldDefaultDistance = 2;
    this.objectRotateSpeed = 8.0;
    
    // Переменные
    this.objectHoldDistance = this.objectHoldDefaultDistance;
    this.objectRotation = undefined;

    this.scene = scene;
    this.physics = null;
    physics.atInit((physics) => {
        this.physics = physics
    })
  }

  getLookedAtObject(normalizedPosition = {x: 0, y: 0}) {
    this.scene.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(normalizedPosition, this.scene.camera);
    const intersectedObjects = this.raycaster.intersectObjects(this.scene.scene.children);
    // Возвращаем пустое значение, если не было объектов
    if (!intersectedObjects.length) return undefined;
    // Первый ближайший объект, если есть пересечения
    let i = 0;
    let intersectedObject = undefined
    while (i < intersectedObjects.length) {
        if (intersectedObjects[i].object?.intersectable ?? true) {
            intersectedObject = intersectedObjects[i].object;
            break;
        }
        i += 1;
    }
    if (!intersectedObject) return undefined;
    // Взаимодействие не всегда с тем, с которым произошло пересечение, поэтому проходим по interactionObject атрибуту пока он указан до родителя
    // Необходимо для правильного выбора объекта в случае загруженных из gltf файлов (при загрузке для каждого указать это свойство правильно)
    let interactionObject = intersectedObject;
    while (Object.hasOwn(interactionObject, 'interactionObject')) interactionObject = interactionObject.interactionObject;
    // Проверка, что объект интерактивный, закомментировать, чтобы можно было выбирать любые объекты
    if (!(interactionObject.interactable ?? false)) return undefined;

    return interactionObject;
  }
  update_outlined_object() {
    if (this.selected) this.scene.outlinePass.selectedObjects = [this.selected];
    else this.scene.outlinePass.selectedObjects = []
  }
  select(normalizedPosition = {x: 0, y: 0}) {
    const lookedAtObject = this.getLookedAtObject(normalizedPosition);
    if (lookedAtObject === this.selected) return;
    this.selected = lookedAtObject;
    this.pickedUp = false;
    this.pickedRotating = false;
    this.update_outlined_object();
  }
  deselect() {
    if (this.pickedUp) this.putDown();
    this.selected = undefined;
    this.pickedUp = undefined;
    this.pickedRotating = undefined;
    this.objectRotation = undefined;
    this.update_outlined_object();
  }
  pickUp() {
    if (!this.selected) return;
    this.pickedUp = true;
    this.objectHoldDistance = this.objectHoldDefaultDistance;

    // console.log('picked up', this.selected.uuid);
    // === Отключаем физику при подборе ===
    const physicsBody = this.selected.userData?.physicsBody;
    if (physicsBody) {
        // Переключаем в кинематический режим для управления вручную
        physicsBody.setBodyType(this.physics.RAPIER.RigidBodyType.KinematicPositionBased, true);
        physicsBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        physicsBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
        // console.log('disabled physics', this.selected.uuid);
    }

    this.scene.camera.updateMatrixWorld();
    this.selected.updateMatrixWorld();
    // Получаем кватернион камеры
    const cameraQuaternion = new THREE.Quaternion();
    this.scene.camera.getWorldQuaternion(cameraQuaternion);

    // R = C⁻¹ × O  — смещение относительно камеры как кватернион
    // Для того, чтобы объект поворачивался вверх/вниз при взгляде камеры выше/ниже
    // Для работы требуется, чтобы был согласованный исходный квартенион в moveSelectedObjectToCamera
    // this.objectRotation = cameraQuaternion.clone().invert().multiply(this.selected.quaternion.clone());

    // Вектор "вперёд" в локальных координатах камеры (negative Z)
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(cameraQuaternion);
    
    // Проецируем на горизонтальную плоскость XZ
    forward.y = 0;
    forward.normalize();
    
    // Вычисляем Y-угол: atan2(x, z) работает корректно во всех квадрантах
    const yAngle = Math.atan2(forward.x, forward.z);
    const cameraYQuaternion = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        yAngle
    );
    
    // R = (C_y)⁻¹ × O — смещение относительно Y-вращения камеры
    this.objectRotation = cameraYQuaternion.clone().invert().multiply(this.selected.quaternion.clone());
  }
  changeObjectHoldDistance(delta) {
    if (!this.pickedUp) return;
    this.objectHoldDistance += 0.001*delta;
    if (this.objectHoldDistance < this.objectHoldMinDistance) this.objectHoldDistance = this.objectHoldMinDistance;
    if (this.objectHoldDistance > this.objectHoldMaxDistance) this.objectHoldDistance = this.objectHoldMaxDistance;
  }
  putDown() {
    if (!this.selected) return;
    this.pickedUp = false;
    // === Включаем физику при отпускании ===
    const physicsBody = this.selected.userData?.physicsBody;
    if (physicsBody) {
      if (this.selected.userData?.isDynamic) {
        physicsBody.setBodyType(this.physics.RAPIER.RigidBodyType.Dynamic, true);
      } else {
        physicsBody.setBodyType(this.physics.RAPIER.RigidBodyType.Fixed, true);
      }
    }

  }
  pickUpToggle() {
    if (!this.pickedUp) this.pickUp();
    else this.putDown();
  }
  rotationStart() {
    this.pickedRotating = true;
  }
  rotationStop() {
    this.pickedRotating = false;
  }
  toggleVerticalRotation() {
    if (!this.enabled) return;
    this.verticalRotationOn = !this.verticalRotationOn;
  }
  toggleHorizontalRotation() {
    if (!this.enabled) return;
    this.horizontalRotationOn = !this.horizontalRotationOn;
  }
  rotate(movementX, movementY, sensitivity) {
    if (!this.objectRotation) return;
    if (movementX == 0 && movementY == 0) return;

    // Создаём кватернионы приращения вокруг локальных осей камеры
    const deltaY = new THREE.Quaternion()
    if (this.horizontalRotationOn) {
        deltaY.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), 
            movementX * sensitivity
        );
    }
    const deltaX = new THREE.Quaternion()
    if (this.verticalRotationOn) {
        deltaX.setFromAxisAngle(
            new THREE.Vector3(1, 0, 0), 
            -movementY * sensitivity
        );
    }
    
    // Объединяем (Y → X для естественного порядка: yaw, затем pitch)
    const deltaRotation = new THREE.Quaternion().copy(deltaY).multiply(deltaX);
    
    // Вращаем в пространстве камеры: R' = δ × R (умножение слева = premultiply)
    this.objectRotation.premultiply(deltaRotation);
  }
  enable() {
    this.enabled = true;
    this.select();
  }
  disable() {
    this.deselect();
    this.enabled = false;
  }
  toggle() {
    if (this.enabled) this.disable();
    else this.enable();
  }
  delete() {
    if (!this.enabled || !this.selected) return;
    this.selected.parent.remove(this.selected);
    this.deselect();
  }
  moveSelectedObjectToCamera(delta) {
    if (!this.selected) return;

    this.scene.camera.updateMatrixWorld();
    // Получаем позицию камеры и направление взгляда
    const cameraPosition = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    const cameraQuaternion = new THREE.Quaternion();
    // Получаем мировую позицию камеры
    this.scene.camera.getWorldPosition(cameraPosition);
    // Получаем направление взгляда камеры
    this.scene.camera.getWorldDirection(cameraDirection);
    this.scene.camera.getWorldQuaternion(cameraQuaternion);

    // Сразу перемащаем в позицию камеры
    const targetPosition = cameraPosition.add(cameraDirection.multiplyScalar(this.objectHoldDistance));

    // Для того, чтобы объект поворачивался вверх/вниз при взгляде камеры выше/ниже
    // Для работы требуется, чтобы был согласованный исходный квартенион в pickUp
    // Перемещаем запрошенный поворот объекта в позицию камеры
    // const targetQuaternion = cameraQuaternion.clone().multiply(this.objectRotation);

    // Извлекаем Y-вращение камеры через вектор направления
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(cameraQuaternion);
    forward.y = 0;
    forward.normalize();
    
    const yAngle = Math.atan2(forward.x, forward.z);
    const cameraYQuaternion = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        yAngle
    );
    
    // targetQuaternion = C_y × R
    const targetQuaternion = cameraYQuaternion.clone().multiply(this.objectRotation);

    this.selected.updateMatrixWorld();
    
    // Плавное перемещение
    if (this.selected.position.distanceTo(targetPosition) < 0.01) {
        this.selected.position.copy(targetPosition);
    } else {
        this.selected.position.lerp(targetPosition, this.objectMoveSpeed*delta);
    }
    // Плавное перемещение
    if (this.selected.quaternion.angleTo(targetQuaternion) < 0.01) {
        this.selected.quaternion.copy(targetQuaternion);
    } else {
        this.selected.quaternion.slerp(targetQuaternion, this.objectRotateSpeed*delta);
    }
  }
  log_object_parameters() {
    if (!this.enabled || !this.selected) return;
    console.log(this.selected);
    console.log('Position: ', this.selected.getWorldPosition(new THREE.Vector3()));
    console.log('Rotation: ', this.selected.getWorldDirection(new THREE.Vector3()));
    console.log('Quaternion: ', this.selected.getWorldQuaternion(new THREE.Quaternion()));
    const bbox = new THREE.Box3().setFromObject(this.selected)
    console.log('Bounding box: ', bbox.min, bbox.max, new THREE.Vector3().copy(bbox.max).sub(bbox.min));
  }
  update(delta) {
    if (!this.enabled) return;
    if (this.pickedUp) {
        this.moveSelectedObjectToCamera(delta);
        this.physics.updateBodyFromThree(this.selected)
        return;
    }
    this.select();
  }
}