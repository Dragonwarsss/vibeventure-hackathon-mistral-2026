import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const COIN_URL      = new URL('../assets/GLB/items/coin-bronze.glb',              import.meta.url).href;
const COLORMAP_URL  = new URL('../assets/GLB/items/colormap.png',                 import.meta.url).href;
const PICKUP_SFX    = new URL('../assets/sound/sound_effect/item_pickup.mp3',     import.meta.url).href;

const DROP_CHANCE    = 0.2;
const GRAVITY        = -14;
const BOUNCE_DAMPING = 0.48;
const MAX_BOUNCES    = 3;
const COLLECT_RADIUS = 0.9;
const SPIN_SPEED     = 4.5; // rad/s
const COIN_SCALE     = 0.4;

interface Coin {
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  bounces: number;
  landed: boolean;
}

export class CoinManager {
  /** Called whenever the player picks up a coin. */
  onCollect?: () => void;
  /** Called once the coin GLB template is ready (or fallback built). */
  onTemplateReady?: (template: THREE.Object3D) => void;

  private readonly scene: THREE.Scene;
  private readonly coins: Coin[] = [];
  private coinTemplate: THREE.Object3D | null = null;
  private templateReady = false;
  /** Coins whose spawn was requested before the template finished loading. */
  private pendingSpawns: Array<{ x: number; z: number }> = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.loadTemplate();
  }

  private async loadTemplate(): Promise<void> {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(COIN_URL);
      const root = gltf.scene;

      // Apply colormap texture
      const texture = new THREE.TextureLoader().load(COLORMAP_URL);
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      root.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial) {
            m.map = texture;
            m.needsUpdate = true;
          }
        }
      });

      // Auto-scale: fit the longest axis to COIN_SCALE
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxAxis = Math.max(size.x, size.y, size.z);
      if (maxAxis > 0) root.scale.setScalar(COIN_SCALE / maxAxis);

      this.coinTemplate = root;
    } catch {
      // Fallback: gold torus (coin edge-on, spinning on Y)
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.055, 8, 20),
        new THREE.MeshStandardMaterial({ color: 0xcd7f32, metalness: 0.8, roughness: 0.2 })
      );
      torus.rotation.x = Math.PI / 2; // flat (face up)
      const group = new THREE.Group();
      group.add(torus);
      this.coinTemplate = group;
    }

    this.templateReady = true;
    this.onTemplateReady?.(this.coinTemplate!);

    // Flush any spawns that arrived while loading
    for (const { x, z } of this.pendingSpawns) {
      this.spawnCoin(x, z);
    }
    this.pendingSpawns = [];
  }

  /** 20 % chance to drop a coin at the given tree position. */
  trySpawnCoin(treeX: number, treeZ: number): void {
    if (Math.random() > DROP_CHANCE) return;
    if (!this.templateReady) {
      this.pendingSpawns.push({ x: treeX, z: treeZ });
      return;
    }
    this.spawnCoin(treeX, treeZ);
  }

  private playPickupSfx(): void {
    const audio = new Audio(PICKUP_SFX);
    audio.volume = 0.6;
    audio.play().catch(() => { /* autoplay policy — silently ignore */ });
  }

  private spawnCoin(treeX: number, treeZ: number): void {
    const mesh = this.coinTemplate!.clone(true);
    mesh.traverse(child => {
      if ((child as THREE.Mesh).isMesh) child.castShadow = true;
    });

    const angle = Math.random() * Math.PI * 2;
    const hSpeed = 1.5 + Math.random() * 2.0;
    const pos = new THREE.Vector3(treeX, 1.4, treeZ);
    const vel = new THREE.Vector3(
      Math.sin(angle) * hSpeed,
      3.5 + Math.random() * 2.0,
      Math.cos(angle) * hSpeed
    );

    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.coins.push({ mesh, pos, vel, bounces: 0, landed: false });
  }

  update(delta: number, playerPos: THREE.Vector3): void {
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];

      // ── Physics ──────────────────────────────────────────────────────────
      if (!coin.landed) {
        coin.vel.y += GRAVITY * delta;
        coin.pos.addScaledVector(coin.vel, delta);

        if (coin.pos.y <= 0) {
          coin.pos.y = 0;
          coin.bounces++;
          if (coin.bounces >= MAX_BOUNCES) {
            coin.landed = true;
            coin.vel.set(0, 0, 0);
          } else {
            coin.vel.y  = -coin.vel.y * BOUNCE_DAMPING;
            coin.vel.x *= 0.65;
            coin.vel.z *= 0.65;
          }
        }

        coin.mesh.position.copy(coin.pos);
      }

      // ── Spin ─────────────────────────────────────────────────────────────
      coin.mesh.rotation.y += SPIN_SPEED * delta;

      // ── Collection (only once the coin has fully landed) ─────────────────
      if (!coin.landed) continue;
      const dx = playerPos.x - coin.pos.x;
      const dz = playerPos.z - coin.pos.z;
      if (dx * dx + dz * dz < COLLECT_RADIUS * COLLECT_RADIUS) {
        this.scene.remove(coin.mesh);
        this.coins.splice(i, 1);
        this.playPickupSfx();
        this.onCollect?.();
      }
    }
  }
}
