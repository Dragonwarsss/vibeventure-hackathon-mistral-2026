import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CollisionSystem, convexHull } from './CollisionSystem';

const CACTUS_URL = new URL('../assets/GLB/cactus_tall.glb', import.meta.url).href;
const CACTUS_SCALE = 5;

const FOUNTAIN_GLB_URL = new URL('../assets/GLB/structures/fountain-round-detail.glb', import.meta.url).href;
const FOUNTAIN_SCALE = 3;

const RIVER_TILE_URL = new URL('../assets/GLB/river/ground_riverTile.glb', import.meta.url).href;

const PATH_STRAIGHT_URL = new URL('../assets/GLB/paths/ground_pathStraight.glb', import.meta.url).href;
const PATH_END_URL     = new URL('../assets/GLB/paths/ground_pathEnd.glb',      import.meta.url).href;

const ROUTES: [number, number, number, number][] = [
  [0,  2.5,  12,   9],   // → Japan
  [0,  2.5, -12,   7],   // → Mexico
  [0, -2.5,   8, -13],   // → Senegal
  [0, -2.5,  -9, -13],   // → India
];

// Ponds: [x, z, radius] — exported so World.ts can cut matching holes in the ground
export const POND_POSITIONS: [number, number, number][] = [
  [8,  -6, 1.8],
  [-15, -8, 1.8],
  [3,   9, 1.8],
];

/** Adds all cultural decorations to the scene. */
export function addCulturalLandmarks(scene: THREE.Scene, collision: CollisionSystem): void {
  addFountain(scene, collision);
  addPaths(scene);
  // addTorii(scene, 10, 10);
  // addPyramid(scene, -11, 2);
  // addBaobab(scene, 7, -12);
  // addIndianArch(scene, -8, -12);
  addCherryBlossomCluster(scene);
  addCactusCluster(scene);
  addPonds(scene, collision);
  addFlowerPatches(scene);
}

// ─── Central Fountain ────────────────────────────────────────────────────────

function addFountain(scene: THREE.Scene, collision: CollisionSystem): void {
  loadFountainModel(scene, collision);
}

async function loadFountainModel(scene: THREE.Scene, collision: CollisionSystem): Promise<void> {
  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(FOUNTAIN_GLB_URL);
    const model = gltf.scene;
    model.scale.setScalar(FOUNTAIN_SCALE);

    // Align the base of the model exactly with y=0 (ground plane)
    const box = new THREE.Box3().setFromObject(model);
    model.position.y = -box.min.y + 0.01;

    model.traverse(child => {
      if (!(child as THREE.Mesh).isMesh) return;
      child.castShadow    = true;
      child.receiveShadow = true;
    });

    scene.add(model);

    model.updateMatrixWorld(true);
    const footprint = extractFountainFootprint(model);
    const hull = convexHull(footprint);
    if (hull.length >= 3) {
      collision.addPolygon(hull);
    } else {
      collision.addCircle(0, 0, 2.2);
    }
  } catch (err) {
    console.warn('⚠️ Failed to load fountain-round-detail.glb — using procedural fallback', err);
    buildProceduralFountain(scene);
    collision.addCircle(0, 0, 2.2);
  }
}

/** Extracts XZ footprint of the fountain near ground level for collision. */
function extractFountainFootprint(root: THREE.Object3D): { x: number; z: number }[] {
  const points: { x: number; z: number }[] = [];
  const v = new THREE.Vector3();

  root.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.applyMatrix4(mesh.matrixWorld);
      if (v.y >= -0.1 && v.y <= 1.5) {
        points.push({ x: v.x, z: v.z });
      }
    }
  });

  return points;
}

function buildProceduralFountain(scene: THREE.Scene): void {
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.85 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x29b6f6, transparent: true, opacity: 0.75 });

  const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.32, 8, 32), stoneMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.22;
  ring.castShadow = true;
  scene.add(ring);

  const water = new THREE.Mesh(new THREE.CircleGeometry(1.75, 24), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.14;
  scene.add(water);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.8, 8), stoneMat);
  pillar.position.y = 1.0;
  pillar.castShadow = true;
  scene.add(pillar);

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0x1565c0, emissive: 0x0d47a1, emissiveIntensity: 0.4 })
  );
  globe.position.y = 2.1;
  scene.add(globe);
}

// ─── Stone Paths ─────────────────────────────────────────────────────────────

function addPaths(scene: THREE.Scene): void {
  loadPathModels(scene);
}

async function loadPathModels(scene: THREE.Scene): Promise<void> {
  const loader = new GLTFLoader();
  try {
    const [straightGltf, endGltf] = await Promise.all([
      loader.loadAsync(PATH_STRAIGHT_URL),
      loader.loadAsync(PATH_END_URL),
    ]);

    const straightRoot = straightGltf.scene;
    const endRoot      = endGltf.scene;

    const straightBox  = new THREE.Box3().setFromObject(straightRoot);
    const straightSize = new THREE.Vector3();
    straightBox.getSize(straightSize);

    const endBox  = new THREE.Box3().setFromObject(endRoot);
    const endSize = new THREE.Vector3();
    endBox.getSize(endSize);

    // Raise path tiles slightly above ground to layer cleanly over grass tiles
    const straightYOffset = -straightBox.max.y + 0.06;
    const endYOffset      = -endBox.max.y      + 0.06;

    // Tile lengths along the model's Z axis
    const tileLength = straightSize.z;
    const capLength  = endSize.z;

    for (const [x1, z1, x2, z2] of ROUTES) {
      const dx = x2 - x1, dz = z2 - z1;
      const routeLength = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz);
      const ux = dx / routeLength, uz = dz / routeLength;

      // Straight tiles start this many units *inside* the cap to close any
      // model-edge gap (the GLB geometry rarely reaches the exact bounding-box edge).
      const CAP_OVERLAP = 0.2;
      const innerStart  = capLength - CAP_OVERLAP;
      const innerLength = Math.max(0, routeLength - innerStart * 2);
      const tileCount   = Math.max(1, Math.round(innerLength / tileLength));
      const tileScaleZ  = innerLength > 0 ? innerLength / (tileCount * tileLength) : 1;

      // Start cap — rotated 180° so its closed end faces outward
      placePathTile(scene, endRoot, endBox, x1 + ux * capLength / 2, z1 + uz * capLength / 2, angle + Math.PI, endYOffset);

      // Straight tiles — start CAP_OVERLAP units into the cap region
      if (innerLength > 0) {
        const step = innerLength / tileCount;
        for (let i = 0; i < tileCount; i++) {
          const dist = innerStart + (i + 0.5) * step;
          placePathTile(scene, straightRoot, straightBox, x1 + ux * dist, z1 + uz * dist, angle, straightYOffset, tileScaleZ);
        }
      }

      // End cap — aligned with the route direction
      placePathTile(scene, endRoot, endBox, x2 - ux * capLength / 2, z2 - uz * capLength / 2, angle, endYOffset);
    }
  } catch (err) {
    console.warn('⚠️ Failed to load path GLBs — using procedural paths', err);
    const mat = new THREE.MeshStandardMaterial({ color: 0xb5a590, roughness: 0.92 });
    for (const [x1, z1, x2, z2] of ROUTES) {
      addStonePath(scene, x1, z1, x2, z2, mat);
    }
  }
}

/**
 * Places one path tile (straight or end cap) at the given world XZ centre.
 * A THREE.Group handles the rotation so the pivot-offset compensation is
 * straightforward: centre the clone inside the group, then rotate the group.
 */
function placePathTile(
  scene: THREE.Scene,
  root: THREE.Object3D,
  box: THREE.Box3,
  worldX: number,
  worldZ: number,
  angle: number,
  yOffset: number,
  scaleZ = 1,
): void {
  // Geometric centre of the model in its local XZ plane
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;

  const group = new THREE.Group();
  group.position.set(worldX, 0, worldZ);
  group.rotation.y = angle;

  const clone = root.clone(true);
  clone.scale.z = scaleZ;
  // Compensate pivot offset; the Z centre shifts with the Z scale
  clone.position.set(-cx, yOffset, -cz * scaleZ);

  clone.traverse(child => {
    if (!(child as THREE.Mesh).isMesh) return;
    child.castShadow    = true;
    child.receiveShadow = true;
  });

  group.add(clone);
  scene.add(group);
}

/** Procedural fallback: a single flat box for the whole route. */
function addStonePath(
  scene: THREE.Scene,
  x1: number, z1: number,
  x2: number, z2: number,
  mat: THREE.Material,
): void {
  const dx = x2 - x1, dz = z2 - z1;
  const length = Math.sqrt(dx * dx + dz * dz);
  const path = new THREE.Mesh(new THREE.BoxGeometry(2, 0.015, length), mat);
  path.position.set((x1 + x2) / 2, 0.008, (z1 + z2) / 2);
  path.rotation.y = Math.atan2(dx, dz);
  path.receiveShadow = true;
  scene.add(path);
}

// ─── Torii Gate (Japan) ──────────────────────────────────────────────────────

function addTorii(scene: THREE.Scene, x: number, z: number): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.6 });
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  for (const xOff of [-1.3, 1.3]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 4.2, 8), mat);
    pillar.position.set(xOff, 2.1, 0);
    pillar.castShadow = true;
    group.add(pillar);
  }
  // Kasagi (top beam)
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.28, 0.45), mat);
  top.position.y = 4.35;
  group.add(top);
  // Nuki (lower crossbeam)
  const mid = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.3), mat);
  mid.position.y = 3.55;
  group.add(mid);

  scene.add(group);
}

// ─── Stepped Pyramid (Mexico) ────────────────────────────────────────────────

function addPyramid(scene: THREE.Scene, x: number, z: number): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc8a96e, roughness: 0.85 });
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const layers = 4;
  const baseSize = 3.8;
  const layerH = 0.68;
  for (let i = 0; i < layers; i++) {
    const size = baseSize - i * 0.75;
    const block = new THREE.Mesh(new THREE.BoxGeometry(size, layerH, size), mat);
    block.position.y = i * layerH + layerH / 2;
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);
  }
  scene.add(group);
}

// ─── Baobab Tree (Senegal) ───────────────────────────────────────────────────

function addBaobab(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.78, 3, 10),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63 })
  );
  trunk.position.y = 1.5;
  trunk.castShadow = true;
  group.add(trunk);

  // Wide, flat crown
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x558b2f })
  );
  crown.scale.set(1, 0.52, 1);
  crown.position.y = 4.0;
  crown.castShadow = true;
  group.add(crown);

  scene.add(group);
}

// ─── Decorated Arch (India) ──────────────────────────────────────────────────

function addIndianArch(scene: THREE.Scene, x: number, z: number): void {
  const safMat = new THREE.MeshStandardMaterial({ color: 0xe65100, roughness: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffd54f, emissiveIntensity: 0.3 });
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  for (const xOff of [-1.7, 1.7]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 4.8, 10), safMat);
    pillar.position.set(xOff, 2.4, 0);
    pillar.castShadow = true;
    group.add(pillar);

    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), goldMat);
    orb.position.set(xOff, 5.1, 0);
    group.add(orb);
  }
  // Half-torus arch
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.22, 8, 24, Math.PI), safMat);
  arch.rotation.z = Math.PI;
  arch.position.y = 4.8;
  group.add(arch);

  scene.add(group);
}

// ─── Cherry Blossom Trees (Japan area) ──────────────────────────────────────

function addCherryBlossomCluster(scene: THREE.Scene): void {
  // Placed outside Japan house AABB: x [11.3,16.7], z [5.9,10.1]
  const positions: [number, number][] = [
    [17, 7], [17.5, 10], [14, 13.5], [12, 13], [12.5, 5.5],
  ];
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7d5940 });
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0xf8bbd0, emissive: 0xf06292, emissiveIntensity: 0.07,
  });

  for (const [px, pz] of positions) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 1.9, 7), trunkMat);
    trunk.position.set(px, 0.95, pz);
    trunk.castShadow = true;
    scene.add(trunk);

    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.25, 8, 8), crownMat);
    crown.position.set(px, 2.9, pz);
    crown.castShadow = true;
    scene.add(crown);
  }
}

// ─── Cactus Cluster (Mexico area) ────────────────────────────────────────────

function addCactusCluster(scene: THREE.Scene): void {
  // +1 south vs original positions
  const positions: [number, number][] = [[-17.5, 6], [-17, 10.5], [-12, 4.8]];
  loadCactusModels(scene, positions);
}

async function loadCactusModels(scene: THREE.Scene, positions: [number, number][]): Promise<void> {
  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(CACTUS_URL);
    const root = gltf.scene;

    for (const [cx, cz] of positions) {
      const clone = root.clone(true);
      clone.position.set(cx, 0, cz);
      clone.scale.setScalar(CACTUS_SCALE);
      clone.traverse(child => {
        if (!(child as THREE.Mesh).isMesh) return;
        child.castShadow    = true;
        child.receiveShadow = true;
      });
      scene.add(clone);
    }
  } catch (err) {
    console.warn('⚠️ Failed to load cactus_tall.glb', err);
  }
}

// ─── Decorative Ponds (GLB river tile) ───────────────────────────────────────

function addPonds(scene: THREE.Scene, collision: CollisionSystem): void {
  loadPondModels(scene, collision);
}

async function loadPondModels(scene: THREE.Scene, collision: CollisionSystem): Promise<void> {
  const loader = new GLTFLoader();

  // Visible "pond floor" shown through the hole cut in the ground plane
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a3040, roughness: 0.95 });

  try {
    const gltf = await loader.loadAsync(RIVER_TILE_URL);
    const root = gltf.scene;

    const box = new THREE.Box3().setFromObject(root);
    const modelSize = new THREE.Vector3();
    box.getSize(modelSize);
    const modelFootprint = Math.max(modelSize.x, modelSize.z);

    // Offset needed to centre the model on its geometric centre, not its pivot
    const pivotOffsetX = (box.min.x + box.max.x) / 2;
    const pivotOffsetZ = (box.min.z + box.max.z) / 2;

    for (const [px, pz, radius] of POND_POSITIONS) {
      const scale = (radius * 2) / modelFootprint;

      // Dark floor disc below ground — visible through the hole in the ground plane
      const floor = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(px, -0.4, pz);
      scene.add(floor);

      // River tile: top rim sits 2 cm above y=0 so its square corners seal
      // any sub-tile gap left by the AABB skip in the grass tile grid.
      // Subtract the scaled pivot offset so the geometric centre aligns with (px, pz).
      const clone = root.clone(true);
      clone.scale.setScalar(scale);
      clone.position.set(
        px - pivotOffsetX * scale,
        -box.max.y * scale + 0.02,
        pz - pivotOffsetZ * scale,
      );
      clone.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      });
      scene.add(clone);

      // Extract rim polygon from the actual GLB geometry and register as a
      // polygon collider — far more precise than a simple circle approximation.
      clone.updateMatrixWorld(true);
      const rimPoints = extractRimPoints(clone);
      const hull = convexHull(rimPoints);
      if (hull.length >= 3) {
        collision.addPolygon(hull);
      } else {
        collision.addCircle(px, pz, radius); // fallback
      }
    }
  } catch (err) {
    console.warn('⚠️ Failed to load ground_riverTile.glb — using procedural ponds', err);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1976d2, transparent: true, opacity: 0.78 });
    for (const [px, pz, r] of POND_POSITIONS) {
      const pond = new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat);
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(px, 0.02, pz);
      scene.add(pond);
      collision.addCircle(px, pz, r);
    }
  }
}

/**
 * Extracts the INNER depression edge from the GLB — the actual drop-off ring
 * that the player should not cross.
 *
 * At world Y ≈ 0, two rings of vertices coexist:
 *   - Outer ring: the tile's walkable flat rim (max XZ extent → drives the hull outward)
 *   - Inner ring: the top of the depression walls (closer to center)
 *
 * We keep only the inner ring by discarding points whose distance from the
 * centroid is in the upper half of the observed range.
 */
function extractRimPoints(root: THREE.Group): { x: number; z: number }[] {
  const all: { x: number; z: number }[] = [];
  const v = new THREE.Vector3();

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.applyMatrix4(mesh.matrixWorld);
      if (v.y > -0.2 && v.y < 0.1) {
        all.push({ x: v.x, z: v.z });
      }
    }
  });

  if (all.length < 3) return all;

  // Centroid of all rim vertices
  const cx = all.reduce((s, p) => s + p.x, 0) / all.length;
  const cz = all.reduce((s, p) => s + p.z, 0) / all.length;

  // Sort by distance from centroid
  const sorted = all
    .map(p => ({ ...p, d: Math.sqrt((p.x - cx) ** 2 + (p.z - cz) ** 2) }))
    .sort((a, b) => a.d - b.d);

  // Find the largest gap between consecutive distances — this is the boundary
  // between the inner depression ring and the outer flat rim of the tile.
  let splitIdx = Math.floor(sorted.length * 0.45); // default: inner 45%
  let maxGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].d - sorted[i - 1].d;
    if (gap > maxGap) { maxGap = gap; splitIdx = i; }
  }

  // Only trust the gap if it's significant (> 5 cm world units)
  const inner = sorted.slice(0, splitIdx).map(p => ({ x: p.x, z: p.z }));
  return inner.length >= 3 ? inner : all;
}

// ─── Flower Patches ──────────────────────────────────────────────────────────

function addFlowerPatches(scene: THREE.Scene): void {
  const patches: [number, number, number][] = [
    [4, 4, 0xff5252],   [-4, 3, 0xffd600],  [6, -4, 0xe040fb],
    [-6, -5, 0x69f0ae], [2, -8, 0x40c4ff],  [8, 3, 0xff6d00],
    [-8, 2, 0xea80fc],  [5, -10, 0xff5252], [-5, -10, 0xffd600],
    [0, 8, 0x69f0ae],   [9, -5, 0x40c4ff],  [-9, -3, 0xffd600],
    [3, -5, 0xe040fb],  [-3, 5, 0xff6d00],
  ];

  for (const [px, pz, color] of patches) {
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12 });
    const count = 7;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + i * 0.4;
      const dist = 0.25 + (i % 3) * 0.28;
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), mat);
      flower.position.set(
        px + Math.cos(angle) * dist,
        0.11,
        pz + Math.sin(angle) * dist
      );
      scene.add(flower);
    }
  }
}
