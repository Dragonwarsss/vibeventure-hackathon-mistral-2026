import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { InputManager } from './InputManager';
import { CollisionSystem } from './CollisionSystem';
import { PlayerAnimator } from './PlayerAnimator';

const SPEED = 5;
const PLAYER_RADIUS = 0.35;

export class Player {
  readonly mesh: THREE.Group;

  private animator: PlayerAnimator | null = null;
  private isMoving = false;

  private readonly moveDir = new THREE.Vector3();
  private readonly camForward = new THREE.Vector3();
  private readonly camRight = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly nextPos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.mesh = this.buildProceduralMesh();
    scene.add(this.mesh);
    this.tryLoadGLTF();
  }

  private buildProceduralMesh(): THREE.Group {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.6, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x5ba8e5 })
    );
    body.position.y = 0.72;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf5c6a0 })
    );
    head.position.y = 1.5;
    head.castShadow = true;
    group.add(head);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const xOff of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat);
      eye.position.set(xOff, 1.53, 0.25);
      group.add(eye);
    }

    return group;
  }

  /**
   * Tries to load /models/character.glb
   * Place any humanoid GLB with idle + walk animations (e.g. from Mixamo)
   * in front/public/models/character.glb — falls back silently if missing.
   */
  private async tryLoadGLTF(): Promise<void> {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync('/models/character.glb');

      while (this.mesh.children.length > 0) this.mesh.remove(this.mesh.children[0]);

      const model = gltf.scene;
      model.scale.setScalar(1); // Adjust for your model (Mixamo → 0.01)
      this.mesh.add(model);

      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      if (gltf.animations.length > 0) {
        this.animator = new PlayerAnimator(model, gltf.animations);
        this.animator.play('idle');
      }

      console.log('✅ character.glb loaded —', gltf.animations.length, 'animations');
    } catch {
      console.info('ℹ️  No character.glb — using procedural character');
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

    const moving = this.moveDir.lengthSq() > 0;

    if (moving !== this.isMoving) {
      this.isMoving = moving;
      this.animator?.play(moving ? 'walk' : 'idle');
    }

    if (moving) {
      this.moveDir.normalize();
      this.nextPos.copy(this.mesh.position).addScaledVector(this.moveDir, SPEED * delta);
      this.mesh.position.copy(collision.resolve(this.nextPos, PLAYER_RADIUS));
      this.mesh.rotation.y = Math.atan2(this.moveDir.x, this.moveDir.z);
    }

    this.animator?.update(delta);
  }
}
