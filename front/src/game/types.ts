export interface NPCInfo {
  id: string;
  name: string;
  personality: string;
}

export interface GameCallbacks {
  onNPCNearby: (npc: NPCInfo | null) => void;
  onNPCInteract: (npc: NPCInfo) => void;
  onReady?: () => void;
}
