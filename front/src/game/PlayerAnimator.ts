import * as THREE from 'three';

export class PlayerAnimator {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private currentAction: THREE.AnimationAction | null = null;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) {
      this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    }
  }

  play(name: string): void {
    const action = this.findAction(name);
    if (!action || action === this.currentAction) return;

    if (this.currentAction) {
      action.reset().crossFadeFrom(this.currentAction, 0.2, false);
    } else {
      action.reset();
    }
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.play();
    this.currentAction = action;
  }

  /** Joue une animation une seule fois puis appelle onFinish. */
  playOnce(name: string, onFinish: () => void): void {
    const action = this.findAction(name);
    if (!action) { onFinish(); return; }

    const listener = (e: { action: THREE.AnimationAction }) => {
      if (e.action !== action) return;
      this.mixer.removeEventListener('finished', listener);
      onFinish();
    };
    this.mixer.addEventListener('finished', listener);

    if (this.currentAction) {
      action.reset().crossFadeFrom(this.currentAction, 0.1, false);
    } else {
      action.reset();
    }
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    this.currentAction = action;
  }

  update(delta: number): void {
    this.mixer.update(delta);
  }

  /** Matches 'walk' → 'walk', 'walking', 'walk_normal', etc. */
  private findAction(name: string): THREE.AnimationAction | undefined {
    return (
      this.actions.get(name) ??
      [...this.actions.entries()].find(([k]) => k.includes(name))?.[1]
    );
  }
}
