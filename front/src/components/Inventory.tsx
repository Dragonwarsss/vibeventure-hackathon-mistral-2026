import { useEffect } from 'react';
import type { InventoryItem } from '../game/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
}

const COLS = 4;
const ROWS = 6;
const TOTAL_SLOTS = COLS * ROWS;

const ITEM_ICONS: Record<string, string> = {
  'coin-bronze': '🪙',
};

export function Inventory({ isOpen, onClose, items }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <div className={`inventory-panel${isOpen ? ' inventory-panel--open' : ''}`}>
      <div className="inventory-header">
        <button className="inventory-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <span className="inventory-title">Inventory</span>
      </div>

      <div className="inventory-grid">
        {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
          const item = items[i] as InventoryItem | undefined;
          return (
            <div key={i} className={`inventory-slot${item ? ' inventory-slot--filled' : ''}`}>
              {item && (
                <>
                  <span className="inventory-item-icon">
                    {ITEM_ICONS[item.id] ?? '?'}
                  </span>
                  {item.count > 1 && (
                    <span className="inventory-item-count">{item.count}</span>
                  )}
                  <span className="inventory-item-label">{item.label}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
