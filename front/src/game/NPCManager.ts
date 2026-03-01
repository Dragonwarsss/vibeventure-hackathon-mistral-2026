import * as THREE from 'three';
import { NPC, NPC_DEFINITIONS } from './NPC';
import { InputManager } from './InputManager';
import type { GameCallbacks } from './types';

export class NPCManager {
  private readonly npcs: NPC[];
  private readonly callbacks: GameCallbacks;
  private nearbyNPC: NPC | null = null;

  constructor(scene: THREE.Scene, callbacks: GameCallbacks) {
    this.callbacks = callbacks;
    this.npcs = NPC_DEFINITIONS.map((def) => new NPC(scene, def));
  }

  update(playerPos: THREE.Vector3, input: InputManager, delta: number): void {
    let closest: NPC | null = null;
    let closestDist = Infinity;

    for (const npc of this.npcs) {
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

    if (this.nearbyNPC && input.consumeInteract()) {
      this.callbacks.onNPCInteract(this.nearbyNPC.info);
    }
  }
}
