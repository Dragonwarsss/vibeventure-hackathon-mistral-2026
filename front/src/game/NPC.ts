import * as THREE from 'three';
import type { NPCInfo } from './types';

export interface NPCDefinition {
  id: string;
  name: string;
  personality: string;
  position: { x: number; z: number };
  shirtColor: number;
}

// Positions are in front of each house's door (door is on the +z face of each house)
// House 1: (14, 8)   → NPC at z=12  — Japon
// House 2: (-14, 6)  → NPC at z=10  — Mexique
// House 3: (10,-15)  → NPC at z=-11 — Sénégal
// House 4: (-11,-15) → NPC at z=-11 — Inde
export const NPC_DEFINITIONS: NPCDefinition[] = [
  {
    id: 'yuki',
    name: 'Yuki',
    personality:
      "Artiste japonaise originaire de Kyoto. Tu es passionnée par les traditions japonaises : l'ikebana (art floral), la cérémonie du thé, les matsuri (festivals), le manga et la gastronomie nippone comme les ramen et les wagashi. Tu parles avec poésie et sérénité.",
    position: { x: 14, z: 12 },
    shirtColor: 0xff9bb5,
  },
  {
    id: 'carlos',
    name: 'Carlos',
    personality:
      "Chef cuisinier mexicain originaire de Oaxaca. Tu fais découvrir la culture mexicaine avec chaleur : le Día de los Muertos, les tacos al pastor, la musique de mariachi, les ruines aztèques et la lucha libre. Tu es expressif et enthousiaste.",
    position: { x: -14, z: 10 },
    shirtColor: 0xff6d00,
  },
  {
    id: 'amara',
    name: 'Amara',
    personality:
      "Griot sénégalais, gardien de la mémoire et des traditions. Tu partages la culture sénégalaise avec sagesse : la teranga (hospitalité légendaire), le djembé, les contes du baobab, le thiéboudienne et la lutte traditionnelle.",
    position: { x: 10, z: -11 },
    shirtColor: 0xf9a825,
  },
  {
    id: 'priya',
    name: 'Priya',
    personality:
      "Danseuse classique indienne originaire de Chennai. Tu partages la richesse de l'Inde avec enthousiasme : Holi, Diwali, le yoga, les épices, les saris colorés, la danse Bharatanatyam et le cinéma Bollywood.",
    position: { x: -11, z: -11 },
    shirtColor: 0x8e24aa,
  },
];

export class NPC {
  readonly group: THREE.Group;
  readonly info: NPCInfo;
  readonly interactionRadius = 3.5;

  private indicator!: THREE.Mesh;

  constructor(scene: THREE.Scene, def: NPCDefinition) {
    this.info = { id: def.id, name: def.name, personality: def.personality };
    this.group = this.buildMesh(def.shirtColor);
    this.group.position.set(def.position.x, 0, def.position.z);
    scene.add(this.group);
  }

  private buildMesh(shirtColor: number): THREE.Group {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.6, 4, 8),
      new THREE.MeshStandardMaterial({ color: shirtColor })
    );
    body.position.y = 0.72;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf5c6a0 })
    );
    head.position.y = 1.5;
    head.castShadow = true;
    group.add(head);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const xOff of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat);
      eye.position.set(xOff, 1.53, 0.25);
      group.add(eye);
    }

    // Floating "!" indicator shown when player is nearby
    this.indicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 0.6,
      })
    );
    this.indicator.position.y = 2.2;
    this.indicator.visible = false;
    group.add(this.indicator);

    return group;
  }

  setHighlighted(active: boolean): void {
    this.indicator.visible = active;
  }

  /** Smoothly rotate toward target position */
  lookToward(target: THREE.Vector3, delta: number): void {
    const dx = target.x - this.group.position.x;
    const dz = target.z - this.group.position.z;
    const targetAngle = Math.atan2(dx, dz);
    const diff = ((targetAngle - this.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.group.rotation.y += diff * Math.min(1, 4 * delta);
  }
}
