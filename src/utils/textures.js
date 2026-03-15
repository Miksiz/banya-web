import * as THREE from 'three';

// Создание текстуры дерева
function wood(baseColor = '#8B4513') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Базовый цвет
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    // Волокна дерева
    for (let i = 0; i < 50; i++) {
        ctx.strokeStyle = `rgba(${30 + Math.random() * 40}, ${15 + Math.random() * 30}, ${5}, ${0.1 + Math.random() * 0.15})`;
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        let y = Math.random() * 512;
        ctx.moveTo(0, y);
        for (let x = 0; x < 512; x += 20) {
            y += (Math.random() - 0.5) * 4;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Сучки
    for (let i = 0; i < 5; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const r = 5 + Math.random() * 10;
        ctx.fillStyle = `rgba(40, 20, 10, 0.3)`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);

    return texture;
}

// Создание текстуры диагональной сетки
function mesh(baseColor = '#302c29ff', meshSize = 10) {
    const canvas = document.createElement('canvas');
    const textureSize = meshSize*10;
    canvas.width = textureSize;
    canvas.height = textureSize;
    const ctx = canvas.getContext('2d');


    ctx.strokeStyle = baseColor;
    ctx.lineWidth = Math.max(1, meshSize/10);
    for (let y = 0; y < textureSize; y += meshSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(textureSize-y-1, textureSize-1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(textureSize-1, y);
        ctx.lineTo(y-1, textureSize-1);
        ctx.stroke();
    }
    for (let x = meshSize; x < textureSize; x += meshSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(textureSize-1, textureSize-x-1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(textureSize-x, 0);
        ctx.lineTo(0, textureSize-x-1);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 1);
    return texture;
}

export { wood, mesh };