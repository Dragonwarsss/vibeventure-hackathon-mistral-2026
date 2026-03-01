import * as THREE from 'three';
import { InputManager } from './InputManager';

const FOUNTAIN_POS    = new THREE.Vector3(0, 0, 0);
const INTERACT_RADIUS    = 4.0;
/** Total coins in fountain needed to reach levels 2 and 3. */
const LEVEL_THRESHOLDS   = [20, 50] as const;
const THROW_INTERVAL  = 0.035;  // seconds between successive coin throws
const ARC_DURATION    = 0.09;   // seconds for one coin to arc from player to fountain
const COIN_SPIN       = 8;     // rad/s rotation while in flight

// Counter display layout (world units)
const COUNTER_COIN_POS   = new THREE.Vector3(-1.6, 3.25, 0.2);
const COUNTER_SPRITE_POS = new THREE.Vector3(0.7,  3.25, 0);
const COUNTER_COIN_SCALE = 1.6; // multiplier on top of the template's own scale

interface ThrownCoin {
  mesh:    THREE.Object3D;
  t:       number;             // arc progress 0 → 1
  start:   THREE.Vector3;
  control: THREE.Vector3;
  end:     THREE.Vector3;
}

export class FountainManager {
  /** Fired when proximity to the fountain changes. */
  onNearby?:    (near: boolean) => void;
  /** Fired when E is pressed near the fountain (not already throwing). */
  onInteract?:  () => void;
  /** Fired each time a thrown coin lands in the fountain. */
  onCoinLanded?: () => void;
  /** Fired when the fountain reaches a new level (2 or 3). */
  onLevelUp?: (level: number) => void;

  private readonly scene: THREE.Scene;
  private coinTemplate: THREE.Object3D | null = null;

  // The small spinning coin that sits next to the counter pill
  private counterCoin: THREE.Object3D | null = null;

  private coinsInFountain = 0;
  private currentLevel    = 1;
  private isNear          = false;
  private isThrowing      = false;
  private throwQueue      = 0;
  private throwTimer      = 0;
  private readonly lastPlayerPos = new THREE.Vector3();

  private readonly thrownCoins: ThrownCoin[] = [];

  private counterSprite!:  THREE.Sprite;
  private counterTexture!: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx:    CanvasRenderingContext2D;

  constructor(scene: THREE.Scene) {
    this.scene  = scene;
    this.canvas = document.createElement('canvas');
    this.canvas.width  = 200;
    this.canvas.height = 80;
    this.ctx    = this.canvas.getContext('2d')!;
    this.buildSprite();
    this.redraw();
  }

  /** Provide the coin 3D template once CoinManager has loaded it. */
  setCoinTemplate(template: THREE.Object3D): void {
    this.coinTemplate = template;
    this.buildCounterCoin();
  }

  /** Returns true while the player is inside the fountain interaction radius. */
  get isPlayerNear(): boolean { return this.isNear; }

  /**
   * Begin throwing `count` coins one by one from the last known player position.
   * Safe to call with count=0 (no-op).
   */
  startThrow(count: number): void {
    if (count === 0 || this.isThrowing) return;
    this.throwQueue = count;
    this.throwTimer = THROW_INTERVAL; // spawn first coin immediately on next update
    this.isThrowing = true;
  }

  update(delta: number, playerPos: THREE.Vector3, input: InputManager): void {
    this.lastPlayerPos.copy(playerPos);

    // ── Proximity ──────────────────────────────────────────────────────────────
    const near = playerPos.distanceTo(FOUNTAIN_POS) < INTERACT_RADIUS;
    if (near !== this.isNear) {
      this.isNear = near;
      this.onNearby?.(near);
    }

    // ── E-key interaction ──────────────────────────────────────────────────────
    // consumeInteract() is called unconditionally every frame so stale E presses
    // (pressed while not near anything) are always drained within one tick and
    // cannot accidentally trigger the throw when the player later enters range.
    const interacted = input.consumeInteract();
    if (this.isNear && !this.isThrowing && interacted) {
      this.onInteract?.();
    }

    // ── Coin spawn queue ───────────────────────────────────────────────────────
    if (this.isThrowing) {
      this.throwTimer += delta;
      if (this.throwTimer >= THROW_INTERVAL) {
        this.throwTimer = 0;
        this.spawnArc();
        this.throwQueue--;
        if (this.throwQueue === 0) this.isThrowing = false;
      }
    }

    // ── Spin counter coin ──────────────────────────────────────────────────────
    if (this.counterCoin) {
      this.counterCoin.rotation.y += 1.8 * delta;
    }

    // ── Arc animation ──────────────────────────────────────────────────────────
    for (let i = this.thrownCoins.length - 1; i >= 0; i--) {
      const tc = this.thrownCoins[i];
      tc.t = Math.min(tc.t + delta / ARC_DURATION, 1);

      const u = 1 - tc.t;
      tc.mesh.position.set(
        u*u*tc.start.x + 2*u*tc.t*tc.control.x + tc.t*tc.t*tc.end.x,
        u*u*tc.start.y + 2*u*tc.t*tc.control.y + tc.t*tc.t*tc.end.y,
        u*u*tc.start.z + 2*u*tc.t*tc.control.z + tc.t*tc.t*tc.end.z,
      );
      tc.mesh.rotation.y += COIN_SPIN * delta;

      if (tc.t >= 1) {
        this.scene.remove(tc.mesh);
        this.thrownCoins.splice(i, 1);
        this.coinsInFountain++;
        this.checkLevelUp();
        this.redraw();
        this.onCoinLanded?.();
      }
    }
  }

  get fountainLevel(): number { return this.currentLevel; }

  private checkLevelUp(): void {
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      if (this.coinsInFountain === LEVEL_THRESHOLDS[i]) {
        this.currentLevel = i + 2; // threshold[0] → level 2, threshold[1] → level 3
        this.onLevelUp?.(this.currentLevel);
        break;
      }
    }
  }

  private buildCounterCoin(): void {
    if (!this.coinTemplate) return;
    const mesh = this.coinTemplate.clone(true);
    mesh.scale.multiplyScalar(COUNTER_COIN_SCALE);
    mesh.position.copy(COUNTER_COIN_POS);
    mesh.traverse(child => { (child as THREE.Mesh).castShadow = false; });
    this.scene.add(mesh);
    this.counterCoin = mesh;
  }

  private spawnArc(): void {
    if (!this.coinTemplate) return;

    const mesh = this.coinTemplate.clone(true);
    mesh.traverse(child => { (child as THREE.Mesh).castShadow = true; });

    // Spawn at player chest height, arc into the fountain basin
    const from    = this.lastPlayerPos.clone();
    from.y       += 1.2;
    const to      = new THREE.Vector3(0, 0.8, 0);
    const control = new THREE.Vector3(
      (from.x + to.x) / 2,
      Math.max(from.y, 1.5) + 3.5,  // arc peak
      (from.z + to.z) / 2,
    );

    mesh.position.copy(from);
    this.scene.add(mesh);
    this.thrownCoins.push({ mesh, t: 0, start: from, control, end: to });
  }

  private buildSprite(): void {
    this.counterTexture = new THREE.CanvasTexture(this.canvas);
    const mat = new THREE.SpriteMaterial({
      map:             this.counterTexture,
      transparent:     true,
      depthTest:       false,
      sizeAttenuation: true,
    });
    this.counterSprite = new THREE.Sprite(mat);
    this.counterSprite.position.copy(COUNTER_SPRITE_POS);
    this.counterSprite.scale.set(3, 1.2, 1);
    this.scene.add(this.counterSprite);
  }

  private redraw(): void {
    const ctx = this.ctx;
    const w   = this.canvas.width;
    const h   = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Pill background
    ctx.fillStyle = 'rgba(10,10,30,0.80)';
    ctx.beginPath();
    pillRect(ctx, 4, 4, w - 8, h - 8, 18);
    ctx.fill();

    // Measure both strings first, each with their own font
    const isMax    = this.currentLevel > LEVEL_THRESHOLDS.length;
    const countStr = isMax ? '★' : String(this.coinsInFountain);
    const capStr   = isMax ? ' MAX' : `/${LEVEL_THRESHOLDS[this.currentLevel - 1]}`;

    ctx.font = 'bold 46px Arial';
    const countWidth = ctx.measureText(countStr).width;  // ← measured at 46px

    ctx.font = '30px Arial';
    const capWidth = ctx.measureText(capStr).width;      // ← measured at 30px

    // Center the pair in the canvas
    const startX = Math.round((w - countWidth - capWidth) / 2);

    // Draw count
    ctx.font         = 'bold 46px Arial';
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(countStr, startX, h / 2);

    // Draw capacity (same baseline, smaller grey)
    ctx.font      = '30px Arial';
    ctx.fillStyle = '#888888';
    ctx.fillText(capStr, startX + countWidth, h / 2 + 3);

    this.counterTexture.needsUpdate = true;
  }
}

/** Cross-browser rounded-rectangle path helper. */
function pillRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}
