import * as THREE from 'three';
import Entity from './Entity.js';
import { wood as createWoodTexture } from '../utils/textures.js';

export default class Bench extends Entity {
    initialize() {
        this.width = 2.0
        this.depth = 0.6
        this.height = 0.6
        this.seatThickness = 0.08
        this.legThickness = 0.08
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

        const seat = new THREE.Mesh(
            new THREE.BoxGeometry(this.width, this.seatThickness, this.depth),
            benchMaterial
        );
        seat.position.set(0,0,0);
        seat.castShadow = true;
        seat.receiveShadow = true;
        seat.interactionObject = group;
        this.seatMesh = seat;
        group.add(seat);

        const legGeometry = new THREE.BoxGeometry(this.legThickness, this.height - this.seatThickness, this.legThickness);
        const legY = -this.height/2;
        const legX = this.width/2 - this.legThickness;
        const legZ = this.depth/2 - this.legThickness;
        const legPositions = [
            [-legX, legY, -legZ], [-legX, legY, legZ], 
            [legX, legY, legZ], [legX, legY, -legZ]
        ];
        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, benchMaterial);
            leg.position.set(...pos);
            leg.castShadow = true;
            leg.receiveShadow = true;
            leg.interactionObject = group;
            group.add(leg);
        });
        return group;   
    }
}