import * as THREE from 'three';

// Fixed offset behind and above the player
const OFFSET = new THREE.Vector3(0, 6, 10);
const LERP_SPEED = 8;

export class ThirdPersonCamera {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly target = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  update(playerMesh: THREE.Object3D, delta: number): void {
    playerMesh.getWorldPosition(this.target);

    this.desired.copy(this.target).add(OFFSET);
    this.lookAt.copy(this.target).setY(this.target.y + 1);

    // Frame-rate independent lerp
    this.camera.position.lerp(this.desired, 1 - Math.exp(-LERP_SPEED * delta));
    this.camera.lookAt(this.lookAt);
  }
}
