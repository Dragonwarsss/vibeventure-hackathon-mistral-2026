import * as THREE from 'three';
import { World } from './World';
import { Player } from './Player';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import { InputManager } from './InputManager';
import { CollisionSystem } from './CollisionSystem';
import { NPCManager } from './NPCManager';
import { AudioManager } from './AudioManager';
import { CoinManager } from './CoinManager';
import { FountainManager } from './FountainManager';
import { NPCRewardManager } from './NPCRewardManager';
import type { GameCallbacks } from './types';

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock: THREE.Clock;

  private readonly collision: CollisionSystem;
  private readonly world: World;
  private readonly input: InputManager;
  private readonly player: Player;
  private readonly thirdPersonCamera: ThirdPersonCamera;
  private readonly npcManager: NPCManager;
  private readonly coinManager: CoinManager;
  private readonly fountainManager: FountainManager;
  private readonly npcRewardManager: NPCRewardManager;
  private readonly audio = new AudioManager();

  private rafId = 0;

  // Start audio on first user gesture (browser autoplay policy)
  private readonly onFirstInteraction = () => {
    this.audio.start();
  };

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 40, 120);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    this.clock = new THREE.Clock();

    this.collision = new CollisionSystem();
    this.input = new InputManager();
    this.world = new World(this.scene, this.collision);
    this.player = new Player(this.scene);
    this.player.onAttack = (px, pz, facing) => this.world.checkAttackHit(px, pz, facing);
    this.thirdPersonCamera = new ThirdPersonCamera(this.camera);
    this.npcManager = new NPCManager(this.scene, {
      ...callbacks,
      onNPCInteract: (npc) => {
        this.player.triggerInteract();
        callbacks.onNPCInteract(npc);
      },
    });
    this.coinManager = new CoinManager(this.scene);
    this.coinManager.onCollect = () => callbacks.onCoinCollected?.();
    this.world.onTreeHit = (x, z) => this.coinManager.trySpawnCoin(x, z);

    this.fountainManager = new FountainManager(this.scene);
    this.npcRewardManager = new NPCRewardManager(this.scene);
    this.coinManager.onTemplateReady = (tpl) => {
      this.fountainManager.setCoinTemplate(tpl);
      this.npcRewardManager.setCoinTemplate(tpl);
    };
    this.fountainManager.onNearby   = (near) => callbacks.onFountainNearby?.(near);
    this.fountainManager.onInteract = () => callbacks.onFountainInteract?.();
    this.fountainManager.onLevelUp  = (level) => {
      this.npcManager.setFountainLevel(level);
      this.world.setFountainLevel(level);
    };

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onFirstInteraction, { once: true });
    window.addEventListener('pointerdown', this.onFirstInteraction, { once: true });

    this.loop();

    // Signal ready after first render (gives loading screen time to display)
    setTimeout(() => callbacks.onReady?.(), 1200);
  }

  setInputPaused(paused: boolean): void {
    this.input.setPaused(paused);
  }

  /** Throw `count` coins from the player's current position into the fountain. */
  throwCoinsIntoFountain(count: number): void {
    this.fountainManager.startThrow(count);
  }

  /** Show a farewell speech bubble above the NPC for 3 seconds. */
  showNPCGoodbye(npcId: string): void {
    this.npcManager.showGoodbye(npcId);
  }

  /**
   * Animate `count` reward coins flying from the NPC's position to the player.
   * Called after a dialogue ends with at least one user message.
   */
  awardCoinsFromNPC(npcId: string, count: number): void {
    const npcPos = this.npcManager.getNPCPosition(npcId);
    if (!npcPos) return;
    this.npcRewardManager.startReward(npcPos, this.player.mesh.position.clone(), count);
  }

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const delta = Math.min(this.clock.getDelta(), 0.1);

    this.world.update(delta);
    this.player.update(delta, this.input, this.camera, this.collision);
    this.thirdPersonCamera.update(this.player.mesh, delta);
    this.npcManager.update(this.player.mesh.position, this.input, delta);
    this.coinManager.update(delta, this.player.mesh.position);
    this.fountainManager.update(delta, this.player.mesh.position, this.input);
    this.npcRewardManager.update(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onFirstInteraction);
    window.removeEventListener('pointerdown', this.onFirstInteraction);
    this.input.destroy();
    this.player.destroy();
    this.audio.stop();
    this.renderer.dispose();
  }
}
