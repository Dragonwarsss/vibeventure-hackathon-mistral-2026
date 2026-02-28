import * as THREE from 'three';
import { CollisionSystem } from './CollisionSystem';

export class House {
  readonly group: THREE.Group;

  constructor(
    scene: THREE.Scene,
    collision: CollisionSystem,
    x: number,
    z: number,
    wallColor: number = 0xe8d5a3
  ) {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);

    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xc0392b });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x7a4f2e });
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xadd8e6,
      emissive: 0x87ceeb,
      emissiveIntensity: 0.2,
    });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), wallMat);
    body.position.y = 1.5;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // Roof (cone rotated 45° for a square base)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.9, 2.2, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 4.1;
    roof.castShadow = true;
    this.group.add(roof);

    // Door
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.1), doorMat);
    door.position.set(0, 0.9, 2.05);
    this.group.add(door);

    // Windows
    for (const xOff of [-1.5, 1.5]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.1), windowMat);
      win.position.set(xOff, 1.9, 2.05);
      this.group.add(win);
    }

    scene.add(this.group);

    // AABB collision (slightly inset from visual edges)
    collision.addBox(x, z, 2.7, 2.1);
  }
}
