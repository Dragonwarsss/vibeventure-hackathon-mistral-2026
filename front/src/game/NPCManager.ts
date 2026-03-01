import * as THREE from 'three';
import { NPC, NPC_DEFINITIONS } from './NPC';
import { InputManager } from './InputManager';
import type { GameCallbacks } from './types';

export class NPCManager {
  private readonly npcs: NPC[];
  private readonly callbacks: GameCallbacks;
  private nearbyNPC: NPC | null = null;

  get hasNearby(): boolean { return this.nearbyNPC !== null; }

  constructor(scene: THREE.Scene, callbacks: GameCallbacks) {
    this.callbacks = callbacks;
    this.npcs = NPC_DEFINITIONS.map((def) => {
      const npc = new NPC(scene, def);
      if (def.fountainLevel > 1) npc.group.visible = false;
      return npc;
    });
  }

  /** Show a farewell bubble above the NPC with the given id. */
  showGoodbye(npcId: string): void {
    this.npcs.find(n => n.info.id === npcId)?.showGoodbye();
  }

  /** Returns the world position of the NPC with the given id, or null if not found. */
  getNPCPosition(npcId: string): THREE.Vector3 | null {
    const npc = this.npcs.find(n => n.info.id === npcId);
    return npc ? npc.group.position.clone() : null;
  }

  /** Show NPCs whose fountainLevel is now reachable. */
  setFountainLevel(level: number): void {
    for (let i = 0; i < this.npcs.length; i++) {
      if (NPC_DEFINITIONS[i].fountainLevel <= level) {
        this.npcs[i].group.visible = true;
      }
    }
    // Clear nearbyNPC in case the previously highlighted one was hidden
    if (this.nearbyNPC && !this.nearbyNPC.group.visible) {
      this.nearbyNPC = null;
      this.callbacks.onNPCNearby(null);
    }
  }

  update(playerPos: THREE.Vector3, input: InputManager, delta: number): void {
    let closest: NPC | null = null;
    let closestDist = Infinity;

    for (const npc of this.npcs) {
      if (!npc.group.visible) continue;
      npc.update(delta);

      const dist = playerPos.distanceTo(npc.group.position);
      const isNear = dist < npc.interactionRadius;

      npc.setHighlighted(isNear);
      if (isNear) npc.lookToward(playerPos, delta);

      if (isNear && dist < closestDist) {
        closestDist = dist;
        closest = npc;
      }
    }

    if (closest !== this.nearbyNPC) {
      this.nearbyNPC = closest;
      this.callbacks.onNPCNearby(closest ? closest.info : null);
    }

    // Only consume E when a NPC is nearby (leaves the key available for the fountain otherwise)
    if (this.nearbyNPC && input.consumeInteract()) {
      this.callbacks.onNPCInteract(this.nearbyNPC.info);
    }
  }
}
