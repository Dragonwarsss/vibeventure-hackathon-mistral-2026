export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  /** Call after a user gesture (browser autoplay policy). */
  start(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      // Fade in over 3 seconds
      this.master.gain.setValueAtTime(0, this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 3);
      this.master.connect(this.ctx.destination);

      // Pentatonic ambient drone: C2 G2 D3 A3 E4
      const freqs = [65.41, 98.0, 146.83, 220.0, 329.63];
      freqs.forEach((freq, i) => {
        if (!this.ctx || !this.master) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = i < 2 ? 'triangle' : 'sine';
        osc.frequency.value = freq;

        // Slow LFO for gentle warmth
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.07 + i * 0.04;
        lfoGain.gain.value = freq * 0.003;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        gain.gain.value = 0.2 / (i + 1);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
      });
    } catch {
      // AudioContext unavailable — silent fail
    }
  }

  stop(): void {
    this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
