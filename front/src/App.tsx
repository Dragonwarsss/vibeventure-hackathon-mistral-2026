import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import type { NPCInfo, InventoryItem } from './game/types';
import { DialogueBox } from './components/DialogueBox';
import { InteractionHint } from './components/InteractionHint';
import { LoadingScreen } from './components/LoadingScreen';
import { Inventory } from './components/Inventory';
import './index.css';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);

  const [nearbyNPC, setNearbyNPC] = useState<NPCInfo | null>(null);
  const [dialogueNPC, setDialogueNPC] = useState<NPCInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [nearFountain, setNearFountain] = useState(false);

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
      onCoinCollected: () => {
        setInventoryItems(prev => {
          const existing = prev.find(item => item.id === 'coin-bronze');
          if (existing) {
            return prev.map(item =>
              item.id === 'coin-bronze' ? { ...item, count: item.count + 1 } : item
            );
          }
          return [...prev, { id: 'coin-bronze', label: 'Bronze Coin', count: 1 }];
        });
      },
      onFountainNearby: setNearFountain,
      onFountainInteract: () => {
        // Use functional update to access latest inventory without stale closure
        setInventoryItems(prev => {
          const coinItem = prev.find(i => i.id === 'coin-bronze');
          const count = coinItem?.count ?? 0;
          if (count === 0) return prev;
          gameRef.current?.throwCoinsIntoFountain(count);
          return prev.filter(i => i.id !== 'coin-bronze');
        });
      },
    });
    gameRef.current = game;

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const DIALOGUE_REWARDS = [0, 2, 4, 7] as const;

  const handleDialogueClose = (userMessages: number) => {
    const npcId = dialogueNPC?.id;
    setDialogueNPC(null);
    gameRef.current?.setInputPaused(false);

    if (npcId) gameRef.current?.showNPCGoodbye(npcId);

    const coinReward = DIALOGUE_REWARDS[Math.min(userMessages, 3)];
    if (coinReward > 0 && npcId) {
      setInventoryItems(prev => {
        const existing = prev.find(item => item.id === 'coin-bronze');
        if (existing) {
          return prev.map(item =>
            item.id === 'coin-bronze' ? { ...item, count: item.count + coinReward } : item
          );
        }
        return [...prev, { id: 'coin-bronze', label: 'Bronze Coin', count: coinReward }];
      });
      gameRef.current?.awardCoinsFromNPC(npcId, coinReward);
    }
  };

  const handleInventoryClose = () => {
    setInventoryOpen(false);
    gameRef.current?.setInputPaused(false);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyI') return;
      if (dialogueNPC) return; // don't open inventory during dialogue
      setInventoryOpen((prev) => {
        const next = !prev;
        gameRef.current?.setInputPaused(next);
        return next;
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialogueNPC]);

  return (
    <>
      <canvas ref={canvasRef} />
      {!dialogueNPC && <InteractionHint npc={nearbyNPC} />}
      {!dialogueNPC && !nearbyNPC && nearFountain && (() => {
        const coinCount = inventoryItems.find(i => i.id === 'coin-bronze')?.count ?? 0;
        return (
          <div className="interaction-hint">
            <span className="hint-npc-name">Wishing Fountain</span>
            <span className="hint-key">E</span>
            <span>Throw coins{coinCount > 0 ? ` (${coinCount} 🪙)` : ' — no coins'}</span>
          </div>
        );
      })()}
      {dialogueNPC && <DialogueBox npc={dialogueNPC} onClose={handleDialogueClose} />}
      {!dialogueNPC && (
        <div id="controls-hint">WASD · ZQSD to move · E to talk · F to hit · I inventory</div>
      )}
      <Inventory isOpen={inventoryOpen} onClose={handleInventoryClose} items={inventoryItems} />
      {showLoading && <LoadingScreen done={loaded} />}
    </>
  );
}
