import type { VoiceSettings } from '../game/types';

/** Sequential audio playback queue using Web Audio API */
class AudioQueue {
  private readonly ctx: AudioContext;
  private queue: ArrayBuffer[] = [];
  private playing = false;
  private currentSource: AudioBufferSourceNode | null = null;

  constructor() {
    this.ctx = new AudioContext();
  }

  enqueue(buffer: ArrayBuffer): void {
    this.queue.push(buffer);
    if (!this.playing) this.playNext();
  }

  private playNext(): void {
    if (this.queue.length === 0) {
      this.playing = false;
      return;
    }
    this.playing = true;
    const raw = this.queue.shift()!;
    this.ctx.decodeAudioData(raw).then((decoded) => {
      if (!this.playing) return; // stopped while decoding
      const source = this.ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(this.ctx.destination);
      source.onended = () => this.playNext();
      source.start();
      this.currentSource = source;
    }).catch(() => this.playNext()); // skip undecodable chunk
  }

  stop(): void {
    this.queue = [];
    try { this.currentSource?.stop(); } catch { /* already stopped */ }
    this.currentSource = null;
    this.playing = false;
  }

  dispose(): void {
    this.stop();
    this.ctx.close();
  }
}

/**
 * Streams NPC text to ElevenLabs REST TTS and plays audio sentence by sentence.
 *
 * Usage:
 *   const tts = new TTSStreamer();
 *   tts.start(voiceId, apiKey);
 *   tts.sendText(token);   // call for each Mistral token
 *   tts.flush();           // call when Mistral stream ends
 *   tts.dispose();         // call on dialogue close or new response
 */
export class TTSStreamer {
  private audioQueue: AudioQueue | null = null;
  private textBuffer = '';
  private voiceId = '';
  private apiKey = '';
  private settings: VoiceSettings = {};
  private disposed = false;

  // Only break at sentence endings for natural prosody
  private static readonly BOUNDARY = /[.!?]/;
  private static readonly MODEL = 'eleven_turbo_v2_5';

  start(voiceId: string, apiKey: string, settings: VoiceSettings = {}): void {
    this.voiceId = voiceId;
    this.apiKey = apiKey;
    this.settings = settings;
    this.disposed = false;
    this.textBuffer = '';
    this.audioQueue = new AudioQueue();
  }

  /** Call with each token from Mistral stream. */
  sendText(text: string): void {
    if (this.disposed) return;
    this.textBuffer += text;
    this.trySendBuffer();
  }

  /** Call once when Mistral stream ends. Sends remaining buffer. */
  flush(): void {
    if (this.disposed) return;
    const remaining = this.textBuffer.trim();
    this.textBuffer = '';
    if (remaining) this.fetchAndPlay(remaining);
  }

  /** Stop audio immediately and release resources. */
  dispose(): void {
    this.disposed = true;
    this.textBuffer = '';
    this.audioQueue?.dispose();
    this.audioQueue = null;
  }

  private trySendBuffer(): void {
    const match = TTSStreamer.BOUNDARY.exec(this.textBuffer);
    if (!match) return;
    const chunk = this.textBuffer.slice(0, match.index + 1);
    this.textBuffer = this.textBuffer.slice(match.index + 1);
    this.fetchAndPlay(chunk);
    this.trySendBuffer(); // handle multiple sentences in buffer
  }

  private async fetchAndPlay(text: string): Promise<void> {
    if (this.disposed || !text.trim()) return;
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: TTSStreamer.MODEL,
            language_code: this.settings.language_code,
            voice_settings: {
              stability: this.settings.stability ?? 0.5,
              similarity_boost: this.settings.similarity_boost ?? 0.75,
              style: this.settings.style ?? 0,
              use_speaker_boost: this.settings.use_speaker_boost ?? true,
            },
          }),
        }
      );
      if (!response.ok) {
        console.warn('ElevenLabs TTS error', response.status, await response.text());
        return;
      }
      const arrayBuffer = await response.arrayBuffer();
      if (!this.disposed) this.audioQueue?.enqueue(arrayBuffer);
    } catch (err) {
      console.warn('ElevenLabs TTS fetch error', err);
    }
  }
}
