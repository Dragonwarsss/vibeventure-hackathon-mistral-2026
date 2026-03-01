import * as THREE from 'three';

const PICKUP_SFX     = new URL('../assets/sound/sound_effect/item_pickup.mp3', import.meta.url).href;
const THROW_INTERVAL = 0.08;   // seconds between successive coin arcs
const ARC_DURATION   = 0.65;   // seconds for one coin to travel NPC → player
const COIN_SPIN      = 7;      // rad/s rotation while in flight

interface ArcCoin {
  mesh:    THREE.Object3D;
  t:       number;
  start:   THREE.Vector3;
  control: THREE.Vector3;
  end:     THREE.Vector3;
}

export class NPCRewardManager {
  private readonly scene: THREE.Scene;
  private coinTemplate: THREE.Object3D | null = null;
  private readonly arcCoins: ArcCoin[] = [];

  private throwQueue = 0;
  private throwTimer = 0;
  private readonly sourcePos = new THREE.Vector3();
  private readonly targetPos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  setCoinTemplate(template: THREE.Object3D): void {
    this.coinTemplate = template;
  }

  /**
   * Animate `count` coins flying from `npcPos` to `playerPos`.
   * Safe to call with count = 0.
   */
  startReward(npcPos: THREE.Vector3, playerPos: THREE.Vector3, count: number): void {
    if (count === 0 || !this.coinTemplate) return;
    this.sourcePos.copy(npcPos);
    this.targetPos.copy(playerPos);
    this.throwQueue = count;
    this.throwTimer = THROW_INTERVAL; // first coin spawns on next update tick
  }

  update(delta: number): void {
    // Spawn queue
    if (this.throwQueue > 0) {
      this.throwTimer += delta;
      if (this.throwTimer >= THROW_INTERVAL) {
        this.throwTimer = 0;
        this.spawnArc();
        this.throwQueue--;
      }
    }

    // Arc animation
    for (let i = this.arcCoins.length - 1; i >= 0; i--) {
      const ac = this.arcCoins[i];
      ac.t = Math.min(ac.t + delta / ARC_DURATION, 1);

      const u = 1 - ac.t;
      ac.mesh.position.set(
        u*u*ac.start.x + 2*u*ac.t*ac.control.x + ac.t*ac.t*ac.end.x,
        u*u*ac.start.y + 2*u*ac.t*ac.control.y + ac.t*ac.t*ac.end.y,
        u*u*ac.start.z + 2*u*ac.t*ac.control.z + ac.t*ac.t*ac.end.z,
      );
      ac.mesh.rotation.y += COIN_SPIN * delta;

      if (ac.t >= 1) {
        this.scene.remove(ac.mesh);
        this.arcCoins.splice(i, 1);
        this.playPickupSfx();
      }
    }
  }

  private spawnArc(): void {
    if (!this.coinTemplate) return;

    const mesh = this.coinTemplate.clone(true);
    mesh.traverse(child => { (child as THREE.Mesh).castShadow = true; });

    const from = this.sourcePos.clone();
    from.y += 1.5;   // NPC chest height

    const to = this.targetPos.clone();
    to.y += 1.0;     // player chest height

    const control = new THREE.Vector3(
      (from.x + to.x) / 2,
      Math.max(from.y, to.y) + 2.5,  // arc peak
      (from.z + to.z) / 2,
    );

    mesh.position.copy(from);
    this.scene.add(mesh);
    this.arcCoins.push({ mesh, t: 0, start: from, control, end: to });
  }

  private playPickupSfx(): void {
    const audio = new Audio(PICKUP_SFX);
    audio.volume = 0.5;
    audio.play().catch(() => { /* autoplay policy — silently ignore */ });
  }
}
