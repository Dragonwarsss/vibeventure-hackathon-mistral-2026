import * as THREE from 'three';
import { CollisionSystem } from './CollisionSystem';
import { House } from './House';
import { addCulturalLandmarks } from './Landmarks';

const HOUSE_POSITIONS = [
  { x: 14, z: 8, color: 0xfce4ec },   // Japon — rose cerisier
  { x: -14, z: 6, color: 0xff8a65 },  // Mexique — terracotta
  { x: 10, z: -15, color: 0xfff59d }, // Sénégal — jaune soleil
  { x: -11, z: -15, color: 0xe1bee7 }, // Inde — lavande
] as const;

export class World {
  constructor(scene: THREE.Scene, collision: CollisionSystem) {
    this.createLights(scene);
    this.createGround(scene);
    this.createTrees(scene, collision);
    this.createHouses(scene, collision);
    addCulturalLandmarks(scene);
    collision.addCircle(0, 0, 2.4);   // fountain
    collision.addCircle(7, -12, 0.9); // baobab
    collision.addCircle(-11, 2, 2.1); // pyramid base
  }

  private createLights(scene: THREE.Scene): void {
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const sun = new THREE.DirectionalLight(0xfff5cc, 1.5);
    sun.position.set(20, 30, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    scene.add(sun);
  }

  private createGround(scene: THREE.Scene): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ color: 0x7ec850 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
  }

  private createTrees(scene: THREE.Scene, collision: CollisionSystem): void {
    const rng = mulberry32(42); // deterministic seed → consistent layout every run
    for (let i = 0; i < 55; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 8 + rng() * 52;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      if (isNearHouseOrSpawn(x, z)) continue;
      this.addTree(scene, x, z, collision);
    }
  }

  private addTree(scene: THREE.Scene, x: number, z: number, collision: CollisionSystem): void {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x8b6914 })
    );
    trunk.position.set(x, 0.75, z);
    trunk.castShadow = true;
    scene.add(trunk);

    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a9e3a })
    );
    crown.position.set(x, 2.6, z);
    crown.castShadow = true;
    scene.add(crown);

    collision.addCircle(x, z, 0.5);
  }

  private createHouses(scene: THREE.Scene, collision: CollisionSystem): void {
    for (const { x, z, color } of HOUSE_POSITIONS) {
      new House(scene, collision, x, z, color);
    }
  }
}

/** Deterministic seeded PRNG (Mulberry32) */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isNearHouseOrSpawn(x: number, z: number): boolean {
  if (Math.sqrt(x * x + z * z) < 7) return true; // spawn zone
  for (const h of HOUSE_POSITIONS) {
    if (Math.abs(x - h.x) < 6 && Math.abs(z - h.z) < 6) return true;
  }
  return false;
}
