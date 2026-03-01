import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CollisionSystem } from './CollisionSystem';
import { House } from './House';
import { addCulturalLandmarks, POND_POSITIONS } from './Landmarks';

const WOOD_CHOP_SFX = new URL('../assets/sound/sound_effect/wood_chop.mp3', import.meta.url).href;

const TREE_URLS = [
  new URL('../assets/GLB/tree_blocks.glb', import.meta.url).href,
  new URL('../assets/GLB/tree_blocks_dark.glb', import.meta.url).href,
  new URL('../assets/GLB/tree_default.glb', import.meta.url).href,
  new URL('../assets/GLB/tree_default_dark.glb', import.meta.url).href,
] as const;

const TREE_SCALE = 3;

const GRASS_URLS = [
  new URL('../assets/GLB/grass/grass.glb', import.meta.url).href,
  new URL('../assets/GLB/grass/grass_large.glb', import.meta.url).href,
  new URL('../assets/GLB/grass/grass_leafs.glb', import.meta.url).href,
  new URL('../assets/GLB/grass/grass_leafsLarge.glb', import.meta.url).href,
] as const;

const GRASS_COUNT  = 150;
const GRASS_SCALE_MIN = 0.8;
const GRASS_SCALE_MAX = 1.6;

const CROP_CORN_URLS = [
  new URL('../assets/GLB/crops/crops_cornStageA.glb', import.meta.url).href,
  new URL('../assets/GLB/crops/crops_cornStageB.glb', import.meta.url).href,
  new URL('../assets/GLB/crops/crops_cornStageC.glb', import.meta.url).href,
  new URL('../assets/GLB/crops/crops_cornStageD.glb', import.meta.url).href,
] as const;

const CROP_WHEAT_URLS = [
  new URL('../assets/GLB/crops/crops_wheatStageA.glb', import.meta.url).href,
  new URL('../assets/GLB/crops/crops_wheatStageB.glb', import.meta.url).href,
] as const;

const CROP_CARROT_URL   = new URL('../assets/GLB/crops/crop_carrot.glb', import.meta.url).href;
const FENCE_PLANKS_URL  = new URL('../assets/GLB/fences/fence_planks.glb', import.meta.url).href;
const FENCE_CORNER_URL  = new URL('../assets/GLB/fences/fence_corner.glb', import.meta.url).href;
const FENCE_GATE_URL    = new URL('../assets/GLB/fences/fence_gate.glb', import.meta.url).href;

const GROUND_GRASS_URL = new URL('../assets/GLB/ground_grass.glb', import.meta.url).href;

const BUILDING_URLS = [
  new URL('../assets/GLB/buildings/building-type-g.glb', import.meta.url).href, // Japon
  new URL('../assets/GLB/buildings/building-type-h.glb', import.meta.url).href, // Mexique
  new URL('../assets/GLB/buildings/building-type-i.glb', import.meta.url).href, // Sénégal
  new URL('../assets/GLB/buildings/building-type-j.glb', import.meta.url).href, // Inde
  new URL('../assets/GLB/buildings/building-type-g.glb', import.meta.url).href, // France (réutilise le modèle g)
] as const;

const HOUSE_POSITIONS = [
  { x: 14,  z: 8,   glbUrl: BUILDING_URLS[0], fountainLevel: 1 }, // Japon   — débloqué dès le début
  { x: -14, z: 6,   glbUrl: BUILDING_URLS[1], fountainLevel: 2 }, // Mexique  — niveau 2
  { x: 10,  z: -15, glbUrl: BUILDING_URLS[2], fountainLevel: 2 }, // Sénégal  — niveau 2
  { x: -11, z: -15, glbUrl: BUILDING_URLS[3], fountainLevel: 1 }, // Inde     — débloqué dès le début
  { x: 0,   z: -30, glbUrl: BUILDING_URLS[4], fountainLevel: 3 }, // France   — niveau 3
] as const;

interface TreeEntry {
  x: number;
  z: number;
  shakePhase: { value: number }; // SHAKE_DURATION → 0 quand l'arbre est touché
}

interface PendingHouse {
  x: number;
  z: number;
  glbUrl: string;
  delay: number; // seconds remaining before the house spawns
}

const SHAKE_DURATION = 0.8;
const ATTACK_REACH   = 2.5;

export class World {
  /** Called for each tree that takes a hit. Coordinates are the tree's XZ position. */
  onTreeHit?: (x: number, z: number) => void;

  private readonly scene: THREE.Scene;
  private readonly collision: CollisionSystem;
  private grassTime = 0;
  private readonly grassTimeUniforms: { value: number }[] = [];
  private readonly cropTimeUniforms:  { value: number }[] = [];
  private readonly treeEntries: TreeEntry[] = [];
  private readonly animatedHouses: House[] = [];
  private readonly pendingHouses: PendingHouse[] = [];

  constructor(scene: THREE.Scene, collision: CollisionSystem) {
    this.scene = scene;
    this.collision = collision;
    this.createLights(scene);
    this.createGround(scene);
    this.createTrees(scene, collision);
    this.createGrass(scene);
    this.createGarden(scene, collision);
    this.createHouses();
    addCulturalLandmarks(scene, collision); // pond colliders added inside (polygon)
    // collision.addCircle(0, 0, 2.4);   // fountain
    // collision.addCircle(7, -12, 0.9); // baobab
    // collision.addCircle(-11, 2, 2.1); // pyramid base
  }

  private createLights(scene: THREE.Scene): void {
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const sun = new THREE.DirectionalLight(0xfff5cc, 1.5);
    sun.position.set(20, 30, 20);
    sun.castShadow = true;
    sun.shadow.intensity = 0.45;
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
    this.loadGroundTiles(scene); // async, fire-and-forget
  }

  private async loadGroundTiles(scene: THREE.Scene): Promise<void> {
    const loader = new GLTFLoader();
    const rng = mulberry32(99);
    try {
      const gltf = await loader.loadAsync(GROUND_GRASS_URL);
      const root = gltf.scene;
      root.updateMatrixWorld(true);

      // Tile dimensions from bounding box
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const tileW = size.x;
      const tileD = size.z;
      const yOffset = -box.min.y;

      const WORLD_HALF = 70;
      const rangeX = Math.ceil(WORLD_HALF / tileW);
      const rangeZ = Math.ceil(WORLD_HALF / tileD);
      const ROTATIONS = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

      // Collect tile positions (skip pond-center tiles)
      const tiles: { tx: number; tz: number; rotY: number }[] = [];
      for (let ix = -rangeX; ix <= rangeX; ix++) {
        for (let iz = -rangeZ; iz <= rangeZ; iz++) {
          const tx = ix * tileW;
          const tz = iz * tileD;
          if (tileOverlapsPond(tx, tz)) continue;
          tiles.push({ tx, tz, rotY: ROTATIONS[Math.floor(rng() * 4)] });
        }
      }

      // Collect template meshes and their local matrices relative to root
      const rootInvMatrix = root.matrixWorld.clone().invert();
      const templateMeshes: { mesh: THREE.Mesh; localMatrix: THREE.Matrix4 }[] = [];
      root.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const localMatrix = mesh.matrixWorld.clone().premultiply(rootInvMatrix);
        templateMeshes.push({ mesh, localMatrix });
      });

      // One InstancedMesh per unique mesh in the GLB — single draw call each
      const dummy = new THREE.Object3D();
      const finalMatrix = new THREE.Matrix4();

      for (const { mesh: tpl, localMatrix } of templateMeshes) {
        const instanced = new THREE.InstancedMesh(tpl.geometry, tpl.material, tiles.length);
        instanced.receiveShadow = true;

        tiles.forEach(({ tx, tz, rotY }, i) => {
          dummy.position.set(tx, yOffset, tz);
          dummy.rotation.set(0, rotY, 0);
          dummy.updateMatrix();
          finalMatrix.multiplyMatrices(dummy.matrix, localMatrix);
          instanced.setMatrixAt(i, finalMatrix);
        });

        instanced.instanceMatrix.needsUpdate = true;
        scene.add(instanced);
      }
    } catch (err) {
      console.warn('⚠️ Failed to load ground_grass.glb — using procedural ground', err);
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(140, 140),
        new THREE.MeshStandardMaterial({ color: 0x7ec850 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
    }
  }

  private createTrees(scene: THREE.Scene, collision: CollisionSystem): void {
    const rng = mulberry32(42);    // positions — seed identique, layout inchangé
    const rngType = mulberry32(43); // sélection du modèle, seed séparé

    const positions: { x: number; z: number; typeIdx: number; rotation: number }[] = [];

    for (let i = 0; i < 55; i++) {
      const angle = rng() * Math.PI * 2;
      const dist  = 8 + rng() * 52;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      if (isNearHouseOrSpawn(x, z)) continue;

      const typeIdx  = Math.floor(rngType() * TREE_URLS.length);
      const rotation = rngType() * Math.PI * 2;
      positions.push({ x, z, typeIdx, rotation });
      collision.addCircle(x, z, 0.5);
      this.treeEntries.push({ x, z, shakePhase: { value: 0 } });
    }

    this.loadTreeModels(scene, positions);
  }

  private async loadTreeModels(
    scene: THREE.Scene,
    positions: { x: number; z: number; typeIdx: number; rotation: number }[]
  ): Promise<void> {
    const loader = new GLTFLoader();
    try {
      const gltfs = await Promise.all(TREE_URLS.map(url => loader.loadAsync(url)));
      const roots  = gltfs.map(g => g.scene);

      for (let i = 0; i < positions.length; i++) {
        const { x, z, typeIdx, rotation } = positions[i];
        const entry = this.treeEntries[i];
        const clone = roots[typeIdx].clone(true);
        clone.position.set(x, 0, z);
        clone.rotation.y = rotation;
        clone.scale.setScalar(TREE_SCALE);
        clone.traverse(child => {
          if (!(child as THREE.Mesh).isMesh) return;
          child.castShadow    = true;
          child.receiveShadow = true;
          this.applyTreeShake(child as THREE.Mesh, entry.shakePhase);
        });
        scene.add(clone);
      }
    } catch (err) {
      console.warn('⚠️ Failed to load tree GLBs — falling back to procedural trees', err);
      for (const { x, z } of positions) {
        this.addProceduralTree(scene, x, z);
      }
    }
  }

  private createGrass(scene: THREE.Scene): void {
    const rng     = mulberry32(77);
    const rngType = mulberry32(78);

    const positions: { x: number; z: number; typeIdx: number; rotation: number; scale: number }[] = [];

    for (let i = 0; i < GRASS_COUNT; i++) {
      const angle = rng() * Math.PI * 2;
      const dist  = 2 + rng() * 60;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      const typeIdx  = Math.floor(rngType() * GRASS_URLS.length);
      const rotation = rngType() * Math.PI * 2;
      const scale    = GRASS_SCALE_MIN + rngType() * (GRASS_SCALE_MAX - GRASS_SCALE_MIN);
      positions.push({ x, z, typeIdx, rotation, scale });
    }

    this.loadGrassModels(scene, positions);
  }

  update(delta: number): void {
    this.grassTime += delta;
    for (const u of this.grassTimeUniforms) u.value = this.grassTime;
    for (const u of this.cropTimeUniforms)  u.value = this.grassTime;
    for (const entry of this.treeEntries) {
      if (entry.shakePhase.value > 0) {
        entry.shakePhase.value = Math.max(0, entry.shakePhase.value - delta);
      }
    }

    // Spawn pending houses one by one with staggered delays
    for (let i = this.pendingHouses.length - 1; i >= 0; i--) {
      this.pendingHouses[i].delay -= delta;
      if (this.pendingHouses[i].delay <= 0) {
        const { x, z, glbUrl } = this.pendingHouses.splice(i, 1)[0];
        this.animatedHouses.push(new House(this.scene, this.collision, x, z, glbUrl, true));
      }
    }

    // Advance intro animations and remove completed ones
    for (let i = this.animatedHouses.length - 1; i >= 0; i--) {
      if (!this.animatedHouses[i].update(delta)) {
        this.animatedHouses.splice(i, 1);
      }
    }
  }

  /**
   * Vérifie si l'attaque (demi-cercle devant le joueur) touche des arbres,
   * et déclenche leur shake si c'est le cas.
   * @param px  position X du joueur
   * @param pz  position Z du joueur
   * @param facing  rotation Y du joueur (mesh.rotation.y)
   */
  private playWoodChop(): void {
    const audio = new Audio(WOOD_CHOP_SFX);
    audio.volume = 0.7;
    audio.play().catch(() => { /* autoplay policy — silently ignore */ });
  }

  checkAttackHit(px: number, pz: number, facing: number): void {
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    for (const entry of this.treeEntries) {
      const dx = entry.x - px;
      const dz = entry.z - pz;
      const distSq = dx * dx + dz * dz;
      if (distSq > ATTACK_REACH * ATTACK_REACH || distSq < 0.001) continue;
      const dist = Math.sqrt(distSq);
      // Demi-cercle : l'arbre doit être devant le joueur (dot > 0 = angle < 90°)
      if ((dx * fx + dz * fz) / dist > 0) {
        entry.shakePhase.value = SHAKE_DURATION;
        this.playWoodChop();
        this.onTreeHit?.(entry.x, entry.z);
      }
    }
  }

  private async loadGrassModels(
    scene: THREE.Scene,
    positions: { x: number; z: number; typeIdx: number; rotation: number; scale: number }[]
  ): Promise<void> {
    const loader = new GLTFLoader();
    try {
      const gltfs = await Promise.all(GRASS_URLS.map(url => loader.loadAsync(url)));
      const roots  = gltfs.map(g => g.scene);

      // Calcule l'offset Y pour chaque type : pose la base du modèle à y=0
      const yOffsets = roots.map(root => {
        const box = new THREE.Box3().setFromObject(root);
        return -box.min.y;
      });

      for (const { x, z, typeIdx, rotation, scale } of positions) {
        const clone = roots[typeIdx].clone(true);
        clone.scale.setScalar(scale);
        clone.rotation.y = rotation;
        clone.position.set(x, yOffsets[typeIdx] * scale, z);
        clone.traverse(child => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.receiveShadow = true;
          this.applyGrassSway(mesh);
        });
        scene.add(clone);
      }
    } catch (err) {
      console.warn('⚠️ Failed to load grass GLBs', err);
    }
  }

  // ─── Garden ──────────────────────────────────────────────────────────────

  private createGarden(scene: THREE.Scene, collision: CollisionSystem): void {
    const cx = 0, cz = 22;   // centre du jardin
    const hw = 3.5, hd = 2.5; // demi-largeur / demi-profondeur (bord extérieur)

    const NS = Math.PI;             // rotation murs Nord/Sud  (planches le long de X)
    const EW = Math.PI * 1.5;       // rotation murs Est/Ouest (planches le long de Z)

    type Piece = { url: string; x: number; z: number; ry: number };

    const fences: Piece[] = [
      // Mur nord (z=19.5) — portail au centre
      { url: FENCE_PLANKS_URL, x: cx-3, z: cz-hd, ry: NS },
      { url: FENCE_PLANKS_URL, x: cx-2, z: cz-hd, ry: NS },
      { url: FENCE_PLANKS_URL, x: cx-1, z: cz-hd, ry: NS },
      { url: FENCE_GATE_URL,   x: cx,   z: cz-hd, ry: NS }, // portail (panel pivoté open)
      { url: FENCE_PLANKS_URL, x: cx+1, z: cz-hd, ry: NS },
      { url: FENCE_PLANKS_URL, x: cx+2, z: cz-hd, ry: NS },
      { url: FENCE_PLANKS_URL, x: cx+3, z: cz-hd, ry: NS },
      { url: FENCE_CORNER_URL, x: cx-hw, z: cz-hd, ry: Math.PI * 0.5 }, // coin NO
      { url: FENCE_CORNER_URL, x: cx+hw, z: cz-hd, ry: Math.PI * 1.5 }, // coin NE
      // Mur sud (z=24.5) — entièrement fermé
      { url: FENCE_PLANKS_URL, x: cx-3, z: cz+hd, ry: NS },
      { url: FENCE_PLANKS_URL, x: cx-2, z: cz+hd, ry: NS },
      { url: FENCE_PLANKS_URL, x: cx-1, z: cz+hd, ry: NS },
      { url: FENCE_PLANKS_URL, x: cx,   z: cz+hd, ry: NS },
      { url: FENCE_PLANKS_URL, x: cx+1, z: cz+hd, ry: NS },
      { url: FENCE_PLANKS_URL, x: cx+2, z: cz+hd, ry: NS },
      { url: FENCE_PLANKS_URL, x: cx+3, z: cz+hd, ry: NS },
      { url: FENCE_CORNER_URL, x: cx-hw, z: cz+hd, ry: 0 },             // coin SO
      { url: FENCE_CORNER_URL, x: cx+hw, z: cz+hd, ry: Math.PI },      // coin SE
      // Mur ouest (x=-3.5)
      { url: FENCE_PLANKS_URL, x: cx-hw, z: cz-2, ry: EW },
      { url: FENCE_PLANKS_URL, x: cx-hw, z: cz-1, ry: EW },
      { url: FENCE_PLANKS_URL, x: cx-hw, z: cz,   ry: EW },
      { url: FENCE_PLANKS_URL, x: cx-hw, z: cz+1, ry: EW },
      { url: FENCE_PLANKS_URL, x: cx-hw, z: cz+2, ry: EW },
      // Mur est (x=3.5)
      { url: FENCE_PLANKS_URL, x: cx+hw, z: cz-2, ry: EW },
      { url: FENCE_PLANKS_URL, x: cx+hw, z: cz-1, ry: EW },
      { url: FENCE_PLANKS_URL, x: cx+hw, z: cz,   ry: EW },
      { url: FENCE_PLANKS_URL, x: cx+hw, z: cz+1, ry: EW },
      { url: FENCE_PLANKS_URL, x: cx+hw, z: cz+2, ry: EW },
    ];

    // Collision — portail au centre du mur nord (x: -0.5 → 0.5) = passage libre
    collision.addBox(cx - 2.25, cz - hd, 1.75, 0.3); // nord-gauche  (+ coin NO)
    collision.addBox(cx + 2.25, cz - hd, 1.75, 0.3); // nord-droite  (+ coin NE)
    collision.addBox(cx,        cz + hd, 4.0,  0.3); // mur sud complet
    collision.addBox(cx - hw,   cz,      0.3,  3.0); // mur ouest (+ coins)
    collision.addBox(cx + hw,   cz,      0.3,  3.0); // mur est  (+ coins)

    const C = CROP_CORN_URLS, W = CROP_WHEAT_URLS, K = CROP_CARROT_URL;
    const crops: Piece[] = [
      // Rang 1 — maïs mûr (z = 20.5)
      { url: C[3], x: cx-2.5, z: cz-1.5, ry: 0.0 },
      { url: C[2], x: cx-1.5, z: cz-1.5, ry: 1.2 },
      { url: C[3], x: cx-0.5, z: cz-1.5, ry: 2.4 },
      { url: C[3], x: cx+0.5, z: cz-1.5, ry: 0.8 },
      { url: C[2], x: cx+1.5, z: cz-1.5, ry: 1.9 },
      { url: C[3], x: cx+2.5, z: cz-1.5, ry: 3.1 },
      // Rang 2 — blé (z = 22)
      { url: W[1], x: cx-2.5, z: cz, ry: 0.0 },
      { url: W[0], x: cx-1.5, z: cz, ry: 0.7 },
      { url: W[1], x: cx-0.5, z: cz, ry: 1.5 },
      { url: W[1], x: cx+0.5, z: cz, ry: 2.2 },
      { url: W[0], x: cx+1.5, z: cz, ry: 3.0 },
      { url: W[1], x: cx+2.5, z: cz, ry: 0.4 },
      // Rang 3 — carottes (z = 23.5)
      { url: K, x: cx-2.5, z: cz+1.5, ry: 0.0 },
      { url: K, x: cx-1.5, z: cz+1.5, ry: 1.1 },
      { url: K, x: cx-0.5, z: cz+1.5, ry: 2.3 },
      { url: K, x: cx+0.5, z: cz+1.5, ry: 0.6 },
      { url: K, x: cx+1.5, z: cz+1.5, ry: 1.8 },
      { url: K, x: cx+2.5, z: cz+1.5, ry: 3.0 },
    ];

    this.loadGardenAssets(scene, fences, crops);
  }

  private async loadGardenAssets(
    scene: THREE.Scene,
    fences: { url: string; x: number; z: number; ry: number }[],
    crops:  { url: string; x: number; z: number; ry: number }[]
  ): Promise<void> {
    const loader = new GLTFLoader();
    const allUrls = [...new Set([...fences.map(f => f.url), ...crops.map(c => c.url)])];
    try {
      const gltfs = await Promise.all(allUrls.map(url => loader.loadAsync(url)));
      const cache = new Map<string, THREE.Group>(allUrls.map((url, i) => [url, gltfs[i].scene]));

      const yOffsets = new Map<string, number>();
      for (const [url, root] of cache) {
        const box = new THREE.Box3().setFromObject(root);
        yOffsets.set(url, Math.max(0, -box.min.y));
      }

      for (const { url, x, z, ry } of fences) {
        const clone = cache.get(url)!.clone(true);
        clone.position.set(x, yOffsets.get(url)!, z);
        clone.rotation.y = ry;
        // Ouvre le panel du portail en le pivotant à 90°
        if (url === FENCE_GATE_URL) {
          const panel = clone.getObjectByName('gate');
          if (panel) panel.rotation.y = Math.PI / 2;
        }
        clone.traverse(child => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });
        scene.add(clone);
      }

      for (const { url, x, z, ry } of crops) {
        const clone = cache.get(url)!.clone(true);
        clone.position.set(x, yOffsets.get(url)!, z);
        clone.rotation.y = ry;
        clone.traverse(child => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.applyCropSway(mesh);
        });
        scene.add(clone);
      }
    } catch (err) {
      console.warn('⚠️ Failed to load garden assets', err);
    }
  }

  private applyCropSway(mesh: THREE.Mesh): void {
    const timeUniform = { value: 0 };
    this.cropTimeUniforms.push(timeUniform);

    const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.time = timeUniform;
      shader.vertexShader = 'uniform float time;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float sway = sin(time * 1.2 + position.x * 0.8 + position.z * 0.5) * 0.05 * position.y;
        transformed.x += sway;
        transformed.z += sin(time * 0.9 + position.z * 0.6) * 0.03 * position.y;`
      );
    };
    mesh.material = mat;
  }

  private applyGrassSway(mesh: THREE.Mesh): void {
    const timeUniform = { value: 0 };
    this.grassTimeUniforms.push(timeUniform);

    const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.time = timeUniform;
      shader.vertexShader = 'uniform float time;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float sway = sin(time * 1.8 + position.x * 0.6 + position.z * 0.4) * 0.06 * position.y;
        transformed.x += sway;
        transformed.z += sin(time * 1.4 + position.z * 0.5) * 0.04 * position.y;`
      );
    };
    mesh.material = mat;
  }

  /**
   * Shader de shake abrupt pour les arbres frappés.
   * Inspiré du sway herbe, mais avec décroissance (shakePhase 0.8 → 0)
   * et amplitude ~5x plus forte.
   */
  private applyTreeShake(mesh: THREE.Mesh, shakePhase: { value: number }): void {
    const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.shakePhase = shakePhase;
      shader.vertexShader = 'uniform float shakePhase;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float shake = sin(shakePhase * 20.0) * shakePhase * 0.15 * position.y;
        transformed.x += shake;
        transformed.z += shake * 0.4;`
      );
    };
    mesh.material = mat;
  }

  /** Fallback procédural (tronc + couronne) si les GLB ne chargent pas */
  private addProceduralTree(scene: THREE.Scene, x: number, z: number): void {
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
  }

  private createHouses(): void {
    for (const pos of HOUSE_POSITIONS) {
      if (pos.fountainLevel === 1) {
        new House(this.scene, this.collision, pos.x, pos.z, pos.glbUrl);
      }
    }
  }

  /** Queue houses unlocked at the given fountain level for staggered animated spawn. */
  setFountainLevel(level: number): void {
    let i = 0;
    for (const pos of HOUSE_POSITIONS) {
      if (pos.fountainLevel === level) {
        this.pendingHouses.push({ x: pos.x, z: pos.z, glbUrl: pos.glbUrl, delay: i * 0.7 });
        i++;
      }
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

/** Returns true if a tile centre falls within any pond circle. */
function tileOverlapsPond(tx: number, tz: number): boolean {
  for (const [px, pz, radius] of POND_POSITIONS) {
    const dx = px - tx;
    const dz = pz - tz;
    if (dx * dx + dz * dz <= radius * radius) return true;
  }
  return false;
}

