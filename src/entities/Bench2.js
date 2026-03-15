import * as THREE from 'three';
import Entity from './Entity.js';
import { wood as createWoodTexture } from '../utils/textures.js';

export default class Bench extends Entity {
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
    }

    async createMesh() {
        const group = new THREE.Group();
        group.interactable = true;

        const benchTexture = createWoodTexture(this.color);
        const benchMaterial = new THREE.MeshStandardMaterial({
            map: benchTexture,
            roughness: 0.7,
            metalness: 0.05
        });

        const lowerSeat = new THREE.Mesh(
            new THREE.BoxGeometry(this.width, this.seatThickness, this.lowerDepth+2*this.seatThickness),
            benchMaterial
        );
        lowerSeat.position.set(0,-this.seatThickness/2,-this.lowerDepth/2-this.seatThickness);
        lowerSeat.castShadow = true;
        lowerSeat.receiveShadow = true;
        lowerSeat.interactionObject = group;
        group.add(lowerSeat);

        const legGeometry = new THREE.BoxGeometry(this.legThickness, this.height/2 - this.seatThickness, this.legThickness);
        const legY = -this.height/4-this.seatThickness/2;
        const legX = this.width/2 - this.legThickness;
        const legZ = this.lowerDepth/2;
        const legPositions = [
            [-legX, legY, lowerSeat.position.z-legZ], [-legX, legY, lowerSeat.position.z+legZ], 
            [legX, legY, lowerSeat.position.z+legZ], [legX, legY, lowerSeat.position.z-legZ]
        ];
        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, benchMaterial);
            leg.position.set(...pos);
            leg.castShadow = true;
            leg.receiveShadow = true;
            leg.interactionObject = group;
            group.add(leg);
        });

        const backHeight = this.height/2 - this.seatThickness;
        const backPlankAmount = Math.floor((backHeight-this.minBackPlankGap)/(this.backPlankWidth+this.minBackPlankGap));
        if (backPlankAmount > 0) {
            const backPlankGap = (backHeight - backPlankAmount*this.backPlankWidth)/(backPlankAmount+1);
            const plankGeometry = new THREE.BoxGeometry(this.width, this.backPlankWidth, this.seatThickness);
            for (let plankN = 0; plankN < backPlankAmount; plankN += 1) {
                const plankLowerY = backPlankGap + plankN*(this.backPlankWidth+backPlankGap);
                const plankY = plankLowerY + this.backPlankWidth/2
                const plank = new THREE.Mesh(plankGeometry, benchMaterial);
                plank.position.set(0,plankY, -this.seatThickness*1.5);
                plank.castShadow = true;
                plank.receiveShadow = true;
                plank.interactionObject = group;
                group.add(plank);
            }
        }

        const backSupportGeometry = new THREE.BoxGeometry(this.seatThickness, backHeight, this.seatThickness);
        const backSupportY = backHeight/2;
        const backSupportX = this.width/2 - this.legThickness;
        const backSupportZ = -this.seatThickness/2;
        const backSupportPositions = [
            [-backSupportX, backSupportY, backSupportZ], [backSupportX, backSupportY, backSupportZ],
            [0, backSupportY, backSupportZ]
        ];
        backSupportPositions.forEach(pos => {
            const backSupport = new THREE.Mesh(backSupportGeometry, benchMaterial);
            backSupport.position.set(...pos);
            backSupport.castShadow = true;
            backSupport.receiveShadow = true;
            backSupport.interactionObject = group;
            group.add(backSupport);
        });
      
        const upperSeat = new THREE.Mesh(
            new THREE.BoxGeometry(this.width, this.seatThickness, this.depth-this.lowerDepth),
            benchMaterial
        );
        upperSeat.position.set(0,(this.height - this.seatThickness)/2, (this.depth-this.lowerDepth)/2-2*this.seatThickness);
        upperSeat.castShadow = true;
        upperSeat.receiveShadow = true;
        upperSeat.interactionObject = group;
        group.add(upperSeat);

        const supportGeometry = new THREE.BoxGeometry(this.legThickness, this.height - this.seatThickness, this.legThickness);
        const supportY = -this.seatThickness/2;
        const supportX = this.width/2 - this.legThickness;
        const supportZ = this.depth - 2*this.seatThickness - this.lowerDepth - this.legThickness;
        const supportPositions = [
            [-supportX, supportY, supportZ], [supportX, supportY, supportZ]
        ];
        supportPositions.forEach(pos => {
            const support = new THREE.Mesh(supportGeometry, benchMaterial);
            support.position.set(...pos);
            support.castShadow = true;
            support.receiveShadow = true;
            support.interactionObject = group;
            group.add(support);
        });

        return group;   
    }
}