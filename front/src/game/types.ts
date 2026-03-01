export interface VoiceSettings {
  stability?: number;        // 0–1, higher = more consistent
  similarity_boost?: number; // 0–1, higher = closer to original voice
  style?: number;            // 0–1, higher = more expressive
  use_speaker_boost?: boolean;
  language_code?: string;    // ISO 639-1, e.g. 'ja', 'es', 'hi' — gives a native accent
}

export interface NPCInfo {
  id: string;
  name: string;
  personality: string;
  voiceId?: string;
  voiceSettings?: VoiceSettings;
}

export interface GameCallbacks {
  onNPCNearby: (npc: NPCInfo | null) => void;
  onNPCInteract: (npc: NPCInfo) => void;
  onReady?: () => void;
}
