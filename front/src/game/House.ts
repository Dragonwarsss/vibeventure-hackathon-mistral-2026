import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CollisionSystem, convexHull } from './CollisionSystem';

const HOUSE_SCALE = 7;
// Fallback box dimensions used only when the GLB fails to load
const COLLISION_HALF_W = 4.5;
const COLLISION_HALF_D = 4.5;

export class House {
  readonly group: THREE.Group;
  private readonly collision: CollisionSystem;

  constructor(
    scene: THREE.Scene,
    collision: CollisionSystem,
    x: number,
    z: number,
    glbUrl: string
  ) {
    this.collision = collision;
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    scene.add(this.group);

    this.loadModel(glbUrl);
  }

  private async loadModel(url: string): Promise<void> {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync(url);
      const model = gltf.scene;
      model.scale.setScalar(HOUSE_SCALE);
      model.traverse(child => {
        if (!(child as THREE.Mesh).isMesh) return;
        child.castShadow    = true;
        child.receiveShadow = true;
      });
      this.group.add(model);

      // Force world matrix update so vertex positions are correct in world space
      this.group.updateMatrixWorld(true);

      // Extract the building footprint from the actual mesh geometry
      const footprint = extractFootprint(this.group);
      const hull = convexHull(footprint);
      if (hull.length >= 3) {
        this.collision.addPolygon(hull);
      } else {
        // Not enough vertices found — fall back to box
        const { x, z } = this.group.position;
        this.collision.addBox(x, z, COLLISION_HALF_W, COLLISION_HALF_D);
      }
    } catch (err) {
      console.warn('⚠️ Failed to load building GLB — using procedural fallback', err);
      this.buildProceduralFallback();
    }
  }

  /** Fallback procédural si le GLB ne charge pas */
  private buildProceduralFallback(): void {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8d5a3 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xc0392b });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x7a4f2e });
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xadd8e6,
      emissive: 0x87ceeb,
      emissiveIntensity: 0.2,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), wallMat);
    body.position.y = 1.5;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.9, 2.2, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 4.1;
    roof.castShadow = true;
    this.group.add(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.1), doorMat);
    door.position.set(0, 0.9, 2.05);
    this.group.add(door);

    for (const xOff of [-1.5, 1.5]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.1), windowMat);
      win.position.set(xOff, 1.9, 2.05);
      this.group.add(win);
    }

    // Use hardcoded box collision for the procedural geometry
    const { x, z } = this.group.position;
    this.collision.addBox(x, z, COLLISION_HALF_W, COLLISION_HALF_D);
  }
}

/**
 * Extracts XZ positions of vertices near ground level (y ≈ 0) from the
 * placed building group. These form the building's actual footprint.
 * The convex hull of these points gives a precise collision polygon.
 */
function extractFootprint(root: THREE.Group): { x: number; z: number }[] {
  const points: { x: number; z: number }[] = [];
  const v = new THREE.Vector3();

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.applyMatrix4(mesh.matrixWorld);
      // Keep vertices near ground level — these define the building footprint
      if (v.y >= -0.1 && v.y <= 1.5) {
        points.push({ x: v.x, z: v.z });
      }
    }
  });

  return points;
}
