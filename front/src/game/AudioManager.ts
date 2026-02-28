const MUSIC_URL = new URL('../assets/sound/music/First Steps Field.mp3', import.meta.url).href;

export class AudioManager {
  private audio: HTMLAudioElement | null = null;

  /** Call after a user gesture (browser autoplay policy). */
  start(): void {
    if (this.audio) return;
    this.audio = new Audio(MUSIC_URL);
    this.audio.loop = true;
    this.audio.volume = 0.5;
    this.audio.play().catch(() => {
      // Autoplay bloqué — silent fail
    });
  }

  stop(): void {
    this.audio?.pause();
    this.audio = null;
  }
}
