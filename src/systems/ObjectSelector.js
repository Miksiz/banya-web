import * as THREE from 'three';

export default class ObjectSelector {
    enabled
    selected
    raycaster
    pickedUp
    pickedRotating
    originalBodyType
    isDynamicPickup
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
    this.enabled = true;
    this.selected = undefined;
    this.raycaster = new THREE.Raycaster();
    this.pickedUp = undefined;
    this.pickedRotating = undefined;
    this.originalBodyType = null;
    this.isDynamicPickup = false;
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
      this.originalBodyType = physicsBody.bodyType();

      this.isDynamicPickup = this.selected.userData?.isDynamic ?? false;

      if (this.isDynamicPickup) {
        if (this.originalBodyType !== this.physics.RAPIER.RigidBodyType.Dynamic) {
          physicsBody.setBodyType(this.physics.RAPIER.RigidBodyType.Dynamic, true);
          physicsBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
          physicsBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
        // Для динамических тел: делаем их тяжелее и гасим начальную скорость
        // Это предотвращает "улетание" объекта при подборе
        // physicsBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        // physicsBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
        
        // Опционально: увеличиваем массу во время удержания для стабильности
        // const collider = physicsBody.getCollider(0);
        // if (collider) collider.setMass(100, true);
      } else {
        // Для неdynamic тел: переключаем в кинематический режим
        physicsBody.setBodyType(this.physics.RAPIER.RigidBodyType.KinematicPositionBased, true);
        physicsBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        physicsBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
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
    if (physicsBody && this.originalBodyType !== null) {
      if (this.isDynamicPickup) {
        // Для динамических тел: просто сбрасываем скорости
        // Тело остаётся динамическим и продолжает взаимодействовать с миром
        // physicsBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        // physicsBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
        
        // Опционально: восстанавливаем массу
        // const collider = physicsBody.getCollider(0);
        // if (collider) collider.setMass(originalMass, true);
      } else {
        // Для неdynamic тел: восстанавливаем исходный тип
        physicsBody.setBodyType(this.originalBodyType, true);
      }
    }
    // Сбрасываем флаги
    this.originalBodyType = null;
    this.isDynamicPickup = false;

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
      let xMovementRotationVector = new THREE.Vector3(0, 1, 0);
      if (this.selected.userData?.rotationStrategy == "overTurn") xMovementRotationVector.set(0, 0, 1);
      deltaY.setFromAxisAngle(
          xMovementRotationVector,
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
    const entity = this.selected.userData?.entity;
    if (entity) {
      entity.destroy();
      this.game
    } else {
      this.selected.parent.remove(this.selected);
    }
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
    // console.log(forward, yAngle);
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

    /**
   * Перемещает динамическое тело с помощью импульсов Rapier.
   * @param {number} delta - Время между кадрами
   */
  moveDynamicBodyToCamera(delta) {
    if (!this.selected) return;
    const physicsBody = this.selected.userData?.physicsBody;
    if (!physicsBody) return;
    this.scene.camera.updateMatrixWorld();
    // Получаем позицию камеры и направление взгляда
    const cameraPosition = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    
    this.scene.camera.getWorldPosition(cameraPosition);
    this.scene.camera.getWorldDirection(cameraDirection);
    // Вычисляем целевую позицию
    const targetPosition = cameraPosition.clone().add(
      cameraDirection.clone().multiplyScalar(this.objectHoldDistance)
    );
    // Текущая позиция из физического тела (более точная чем mesh)
    const currentPosition = new THREE.Vector3(
      physicsBody.translation().x,
      physicsBody.translation().y,
      physicsBody.translation().z
    );
    // Вектор перемещения и расстояние до цели
    const moveVector = new THREE.Vector3().subVectors(targetPosition, currentPosition);
    const distanceToTarget = moveVector.length();

    // Параметры PD-контроллера для плавного движения
    const positionStrength = 50.0;   // Сила позиционного притяжения
    const velocityDamping = 10.0;     // Коэффициент демпфирования скорости
    const maxForce = 65.0;           // Максимальная сила импульса
    const arrivalThreshold = 0.02;   // Порог для остановки
    // Прерывание, если уже близко к цели
    if (distanceToTarget < arrivalThreshold) {
      // Гасим скорость при достижении цели
      physicsBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }
    // Направление движения
    moveVector.normalize();
    // Текущая скорость тела
    const currentVelocity = physicsBody.linvel();
    const velocityVec = new THREE.Vector3(currentVelocity.x, currentVelocity.y, currentVelocity.z);

    const minActivationDistance = 0.005;
    if (distanceToTarget < minActivationDistance && velocityVec.length() < 0.5) {
        // Объект достаточно близко и медленный — полностью замораживаем
        physicsBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        return;
    }

    // Получаем массу 
    let massCorrection = Math.min(physicsBody.mass()*2, 20);

    // Вычисляем силу притяжения к целевой позиции
    // F = strength * distance * direction - damping * velocity
    let impulseX = (moveVector.x * distanceToTarget * positionStrength - velocityVec.x * velocityDamping) * massCorrection * delta;
    let impulseY = (moveVector.y * distanceToTarget * positionStrength - velocityVec.y * velocityDamping) * massCorrection * delta;
    let impulseZ = (moveVector.z * distanceToTarget * positionStrength - velocityVec.z * velocityDamping) * massCorrection * delta;
    // Ограничиваем максимальную силу импульса
    const impulseMagnitude = Math.sqrt(impulseX * impulseX + impulseY * impulseY + impulseZ * impulseZ);
    if (impulseMagnitude > maxForce * delta) {
      const scale = (maxForce * delta) / impulseMagnitude;
      impulseX *= scale;
      impulseY *= scale;
      impulseZ *= scale;
    }
  
    // Применяем линейный импульс к телу
    physicsBody.applyImpulse({ x: impulseX, y: impulseY, z: impulseZ }, true);
    
    // === Обработка вращения ===
    if (!this.objectRotation) return;
    // Вычисляем целевой кватернион (из того же кода что и для кинематических тел)
    const cameraQuaternion = new THREE.Quaternion();
    this.scene.camera.getWorldQuaternion(cameraQuaternion);
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(cameraQuaternion);
    forward.y = 0;
    forward.normalize();
    const yAngle = Math.atan2(forward.x, forward.z);
    const cameraYQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), yAngle
    );
    const targetQuaternion = cameraYQuaternion.clone().multiply(this.objectRotation);
    // Текущий кватернион тела
    const currentQuat = physicsBody.rotation();
    const currentQuaternion = new THREE.Quaternion(currentQuat.x, currentQuat.y, currentQuat.z, currentQuat.w);
    // Вычисляем разницу вращения
    let deltaQ = new THREE.Quaternion().copy(targetQuaternion).multiply(currentQuaternion.clone().invert());

    // Нормализуем для получения кратчайшего пути (через короткую сторону сферы)
    if (deltaQ.w < 0) {
      deltaQ.x = -deltaQ.x;
      deltaQ.y = -deltaQ.y;
      deltaQ.z = -deltaQ.z;
      deltaQ.w = -deltaQ.w;
    }
    
    const angleDifference = 2 * Math.acos(Math.max(Math.min(deltaQ.w, 1.0), -1.0));

    // Текущая угловая скорость
    const angVel = physicsBody.angvel();
    const currentAngVel = new THREE.Vector3(angVel.x, angVel.y, angVel.z);
    // Порог - если уже близко, останавливаем
    const angleThreshold = 0.0001;
    if (angleDifference < angleThreshold && currentAngVel.length() < 0.2) {
        physicsBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
        return;
    }
    if (angleDifference > angleThreshold) {
      // Нормализуем ось вращения из кватерниона
      const sinHalfAngle = Math.sqrt(deltaQ.x * deltaQ.x + deltaQ.y * deltaQ.y + deltaQ.z * deltaQ.z);
      if (sinHalfAngle > angleThreshold/2) {
        const axisX = deltaQ.x / sinHalfAngle;
        const axisY = deltaQ.y / sinHalfAngle;
        const axisZ = deltaQ.z / sinHalfAngle;
        
        // === PD-контроллер ===

        // Целевая угловая скорость (в rad/s)
        let rotationGain = 50.0;   // P - насколько агрессивно следуем за целью
        const dampingGain = 10.0;    // D - демпфирование
        
        const bbox = new THREE.Box3().setFromObject(this.selected)
        const objectSize = bbox.max.clone().sub(bbox.min).length()

        if (objectSize > 1 || massCorrection > 1) {
          rotationGain *= 1/massCorrection*2;
        }
        // Ограничиваем максимальную скорость
        const maxAngularSpeed = 50.0;
        
        // Target angular velocity = ось * угол * gain
        let targetAngVelX = axisX * angleDifference * rotationGain;
        let targetAngVelY = axisY * angleDifference * rotationGain;
        let targetAngVelZ = axisZ * angleDifference * rotationGain;
        
        const targetSpeed = Math.sqrt(
            targetAngVelX * targetAngVelX + 
            targetAngVelY * targetAngVelY + 
            targetAngVelZ * targetAngVelZ
        );
        
        if (targetSpeed > maxAngularSpeed) {
            const scale = maxAngularSpeed / targetSpeed;
            targetAngVelX *= scale;
            targetAngVelY *= scale;
            targetAngVelZ *= scale;
        }
        
        // PD: новая скорость = P * (target - current) - D * current
        // Или: new = current + P*(target - current)*dt - D*current*dt
        // При setAngvel после этого Rapier интегрирует
        
        const errorX = targetAngVelX - currentAngVel.x;
        const errorY = targetAngVelY - currentAngVel.y;
        const errorZ = targetAngVelZ - currentAngVel.z;
        
        // PD-контроллер: P*error - D*currentVelocity
        let newAngVelX = errorX - currentAngVel.x * dampingGain;
        let newAngVelY = errorY - currentAngVel.y * dampingGain;
        let newAngVelZ = errorZ - currentAngVel.z * dampingGain;
        
        // Умножаем на dt для плавности
        newAngVelX *= delta;
        newAngVelY *= delta;
        newAngVelZ *= delta;
        
        // Добавляем к текущей скорости
        newAngVelX += currentAngVel.x;
        newAngVelY += currentAngVel.y;
        newAngVelZ += currentAngVel.z;
        
        physicsBody.setAngvel(
            { x: newAngVelX, y: newAngVelY, z: newAngVelZ },
            true
        );
      }
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
    const physicsBody = this.selected.userData?.physicsBody;
    if (physicsBody) console.log('Mass: ', physicsBody.mass());
  }
  update(delta) {
    if (!this.enabled) return;
    if (this.pickedUp) {
      if (this.isDynamicPickup) {
        // Для динамических тел: используем импульсы Rapier
        this.moveDynamicBodyToCamera(delta);
      } else {
        // Для кинематических/fixed тел: синхронизация через mesh
        this.moveSelectedObjectToCamera(delta);
        this.physics.updateBodyFromThree(this.selected);
      }
      return;
    }
    this.select();
  }
}