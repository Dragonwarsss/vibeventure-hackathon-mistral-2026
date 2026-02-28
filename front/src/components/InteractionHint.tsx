import type { NPCInfo } from '../game/types';

interface Props {
  npc: NPCInfo | null;
}

export function InteractionHint({ npc }: Props) {
  if (!npc) return null;

  return (
    <div className="interaction-hint">
      <span className="hint-npc-name">{npc.name}</span>
      <span className="hint-key">E</span>
      <span>Parler</span>
    </div>
  );
}
