export class InputManager {
  private readonly keys = new Set<string>();
  private interactPressed = false;
  private jumpPressed = false;
  private paused = false;

  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.onKeyDown = (e) => {
      if (e.code === 'Space' && !this.paused) e.preventDefault(); // évite le scroll de page
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.interactPressed = true;
      if (e.code === 'Space') this.jumpPressed = true;
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  get forward(): boolean { return !this.paused && (this.keys.has('KeyW') || this.keys.has('KeyZ')); }
  get backward(): boolean { return !this.paused && this.keys.has('KeyS'); }
  get left(): boolean { return !this.paused && (this.keys.has('KeyA') || this.keys.has('KeyQ')); }
  get right(): boolean { return !this.paused && this.keys.has('KeyD'); }
  get sprint(): boolean { return !this.paused && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')); }

  /** Returns true once per E keypress, then resets */
  consumeInteract(): boolean {
    if (this.paused) return false;
    const was = this.interactPressed;
    this.interactPressed = false;
    return was;
  }

  /** Returns true once per Space keypress, then resets */
  consumeJump(): boolean {
    if (this.paused) return false;
    const was = this.jumpPressed;
    this.jumpPressed = false;
    return was;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.keys.clear();
    this.interactPressed = false;
    this.jumpPressed = false;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
