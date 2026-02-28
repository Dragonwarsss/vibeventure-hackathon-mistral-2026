import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import type { NPCInfo } from './game/types';
import { DialogueBox } from './components/DialogueBox';
import { InteractionHint } from './components/InteractionHint';
import { LoadingScreen } from './components/LoadingScreen';
import './index.css';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);

  const [nearbyNPC, setNearbyNPC] = useState<NPCInfo | null>(null);
  const [dialogueNPC, setDialogueNPC] = useState<NPCInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showLoading, setShowLoading] = useState(true);

  // Remove loading screen from DOM after fade-out animation
  useEffect(() => {
    if (loaded) {
      const t = setTimeout(() => setShowLoading(false), 600);
      return () => clearTimeout(t);
    }
  }, [loaded]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const game = new Game(canvasRef.current, {
      onNPCNearby: setNearbyNPC,
      onNPCInteract: (npc) => {
        setDialogueNPC(npc);
        gameRef.current?.setInputPaused(true);
      },
      onReady: () => setLoaded(true),
    });
    gameRef.current = game;

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const handleDialogueClose = () => {
    setDialogueNPC(null);
    gameRef.current?.setInputPaused(false);
  };

  return (
    <>
      <canvas ref={canvasRef} />
      {!dialogueNPC && <InteractionHint npc={nearbyNPC} />}
      {dialogueNPC && <DialogueBox npc={dialogueNPC} onClose={handleDialogueClose} />}
      {!dialogueNPC && (
        <div id="controls-hint">ZQSD · WASD pour se déplacer · E pour parler</div>
      )}
      {showLoading && <LoadingScreen done={loaded} />}
    </>
  );
}
