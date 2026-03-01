import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InputManager } from './InputManager';
import { CollisionSystem } from './CollisionSystem';
import { PlayerAnimator } from './PlayerAnimator';

const SPEED = 5;
const SPRINT_SPEED = 10;
const PLAYER_RADIUS = 0.35;
const TURN_SPEED = 10;
const JUMP_FORCE = 8;
const GRAVITY = -20;

const CHARACTER_URL = new URL('../assets/GLB/character-male-f.glb', import.meta.url).href;
const COLORMAP_URL = new URL('../assets/GLB/Textures/colormap.png', import.meta.url).href;

export class Player {
  readonly mesh: THREE.Group;

  private animator: PlayerAnimator | null = null;
  private animState: 'idle' | 'walk' | 'sprint' | 'jump' = 'idle';
  private verticalVelocity = 0;
  private isGrounded = true;

  private readonly moveDir = new THREE.Vector3();
  private readonly camForward = new THREE.Vector3();
  private readonly camRight = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly nextPos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Group();
    this.mesh.position.set(0, 0, 5); // spawn au sud de la fontaine
    scene.add(this.mesh);
    this.loadCharacter();
  }

  private async loadCharacter(): Promise<void> {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(CHARACTER_URL);

      const model = gltf.scene;
      model.scale.setScalar(1); // Ajuster si le modèle apparaît trop grand/petit
      this.mesh.add(model);

      const texture = new THREE.TextureLoader().load(COLORMAP_URL);
      texture.flipY = false; // GLTF requiert flipY = false
      texture.colorSpace = THREE.SRGBColorSpace;

      model.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial) {
            m.map = texture;
            m.needsUpdate = true;
          }
        }
      });

      if (gltf.animations.length > 0) {
        this.animator = new PlayerAnimator(model, gltf.animations);
        this.animator.play('idle');
      }

      console.log('✅ character-male-f.glb loaded —', gltf.animations.length, 'animations:', gltf.animations.map(a => a.name));
    } catch (err) {
      console.warn('⚠️ Failed to load GLB — using procedural character', err);
      this.buildProceduralMesh();
    }
  }

  private buildProceduralMesh(): void {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.6, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x5ba8e5 })
    );
    body.position.y = 0.72;
    body.castShadow = true;
    this.mesh.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf5c6a0 })
    );
    head.position.y = 1.5;
    head.castShadow = true;
    this.mesh.add(head);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const xOff of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat);
      eye.position.set(xOff, 1.53, 0.25);
      this.mesh.add(eye);
    }
  }

  update(
    delta: number,
    input: InputManager,
    camera: THREE.Camera,
    collision: CollisionSystem
  ): void {
    this.moveDir.set(0, 0, 0);

    camera.getWorldDirection(this.camForward);
    this.camForward.y = 0;
    this.camForward.normalize();

    this.camRight.crossVectors(this.camForward, this.up);

    if (input.forward) this.moveDir.add(this.camForward);
    if (input.backward) this.moveDir.sub(this.camForward);
    if (input.left) this.moveDir.sub(this.camRight);
    if (input.right) this.moveDir.add(this.camRight);

    // --- Saut & gravité ---
    if (input.consumeJump() && this.isGrounded) {
      this.verticalVelocity = JUMP_FORCE;
      this.isGrounded = false;
    }
    this.verticalVelocity += GRAVITY * delta;
    this.mesh.position.y += this.verticalVelocity * delta;
    if (this.mesh.position.y <= 0) {
      this.mesh.position.y = 0;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    }

    // --- Mouvement horizontal ---
    const moving = this.moveDir.lengthSq() > 0;
    const sprinting = moving && input.sprint;

    // Jump prioritaire sur les autres états tant qu'en l'air
    const newState = !this.isGrounded ? 'jump' : moving ? (sprinting ? 'sprint' : 'walk') : 'idle';

    if (newState !== this.animState) {
      this.animState = newState;
      this.animator?.play(newState);
    }

    if (moving) {
      this.moveDir.normalize();
      const speed = sprinting ? SPRINT_SPEED : SPEED;
      this.nextPos.copy(this.mesh.position).addScaledVector(this.moveDir, speed * delta);
      const resolved = collision.resolve(this.nextPos, PLAYER_RADIUS);
      resolved.y = this.mesh.position.y; // préserver la hauteur du saut
      this.mesh.position.copy(resolved);

      const targetAngle = Math.atan2(this.moveDir.x, this.moveDir.z);
      const diff = Math.atan2(Math.sin(targetAngle - this.mesh.rotation.y), Math.cos(targetAngle - this.mesh.rotation.y));
      this.mesh.rotation.y += diff * (1 - Math.exp(-TURN_SPEED * delta));
    }

    this.animator?.update(delta);
  }
}
