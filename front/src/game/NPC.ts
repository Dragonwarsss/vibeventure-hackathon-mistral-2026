import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { NPCInfo, VoiceSettings } from './types';
import { PlayerAnimator } from './PlayerAnimator';

export interface NPCDefinition {
  id: string;
  name: string;
  personality: string;
  position: { x: number; z: number };
  shirtColor: number;
  glbUrl?: string;
  textureUrl?: string;
  voiceId?: string;
  voiceSettings?: VoiceSettings;
}

const COLORMAP_URL = new URL('../assets/GLB/Textures/colormap.png', import.meta.url).href;

const FEMALE_E_URL = new URL('../assets/GLB/character-female-e.glb', import.meta.url).href;
const FEMALE_A_URL = new URL('../assets/GLB/character-female-a.glb', import.meta.url).href;
const MALE_B_URL = new URL('../assets/GLB/character-male-b.glb', import.meta.url).href;
const MALE_A_URL = new URL('../assets/GLB/character-male-a.glb', import.meta.url).href;

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
      "A Japanese artist from Kyoto. You are passionate about Japanese traditions: ikebana (floral art), the tea ceremony, matsuri (festivals), manga and Japanese cuisine such as ramen and wagashi. You speak with poetry and serenity.",
    position: { x: 13, z: 13 },
    shirtColor: 0xff9bb5,
    glbUrl: FEMALE_E_URL,
    textureUrl: COLORMAP_URL,
    voiceId: 'JoxtC6hnp83kJmUc4WsN', // Japanese voice — Bright & Natural
    voiceSettings: { stability: 0.6, similarity_boost: 0.8, style: 0.3, language_code: 'ja' },
  },
  {
    id: 'carlos',
    name: 'Carlos',
    personality:
      "A Mexican chef from Oaxaca. You share Mexican culture with warmth: Día de los Muertos, tacos al pastor, mariachi music, Aztec ruins and lucha libre. You are expressive and enthusiastic.",
    position: { x: -14, z: 10 },
    shirtColor: 0xff6d00,
    glbUrl: MALE_B_URL,
    textureUrl: COLORMAP_URL,
    voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam — deep male
    voiceSettings: { stability: 0.35, similarity_boost: 0.75, style: 0.65, language_code: 'es' },
  },
  {
    id: 'amara',
    name: 'Amara',
    personality:
      "A Senegalese griot, keeper of memory and traditions. You share Senegalese culture with wisdom: teranga (legendary hospitality), the djembe, tales of the baobab, thiéboudienne and traditional wrestling.",
    position: { x: 10, z: -11 },
    shirtColor: 0xf9a825,
    glbUrl: MALE_A_URL,
    textureUrl: COLORMAP_URL,
    voiceId: 'ErXwobaYiN019PkySvjV', // Antoni — warm male
    voiceSettings: { stability: 0.65, similarity_boost: 0.7, style: 0.4, language_code: 'fr' },
  },
  {
    id: 'priya',
    name: 'Priya',
    personality:
      "A classical Indian dancer from Chennai. You share the richness of India with enthusiasm: Holi, Diwali, yoga, spices, colorful saris, Bharatanatyam dance and Bollywood cinema.",
    position: { x: -11, z: -11 },
    shirtColor: 0x8e24aa,
    glbUrl: FEMALE_A_URL,
    textureUrl: COLORMAP_URL,
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella — warm female
    voiceSettings: { stability: 0.4, similarity_boost: 0.8, style: 0.6, language_code: 'hi' },
  },
];

export class NPC {
  readonly group: THREE.Group;
  readonly info: NPCInfo;
  readonly interactionRadius = 3.5;

  private indicator!: THREE.Mesh;
  private animator: PlayerAnimator | null = null;
  // Keep shirtColor for fallback when GLB loading fails
  private readonly shirtColor: number;

  constructor(scene: THREE.Scene, def: NPCDefinition) {
    this.info = { id: def.id, name: def.name, personality: def.personality, voiceId: def.voiceId, voiceSettings: def.voiceSettings };
    this.shirtColor = def.shirtColor;
    this.group = new THREE.Group();
    this.group.position.set(def.position.x, 0, def.position.z);
    this.addIndicator();

    if (def.glbUrl) {
      this.loadGLB(def.glbUrl, def.textureUrl);
    } else {
      this.buildProceduralMesh(def.shirtColor);
    }

    scene.add(this.group);
  }

  private addIndicator(): void {
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
    this.group.add(this.indicator);
  }

  private async loadGLB(glbUrl: string, textureUrl?: string): Promise<void> {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(glbUrl);
      const model = gltf.scene;
      model.scale.setScalar(1);

      if (textureUrl) {
        const texture = new THREE.TextureLoader().load(textureUrl);
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        model.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial) {
              m.map = texture;
              m.needsUpdate = true;
            }
          }
        });
      } else {
        model.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });
      }

      this.group.add(model);

      if (gltf.animations.length > 0) {
        this.animator = new PlayerAnimator(model, gltf.animations);
        this.animator.play('idle');
      }

      // Raise indicator above the loaded model
      this.indicator.position.y = 2.5;

      console.log('✅ NPC GLB loaded —', gltf.animations.length, 'animations:', gltf.animations.map(a => a.name));
    } catch (err) {
      console.warn('⚠️ Failed to load NPC GLB — using procedural mesh', err);
      this.buildProceduralMesh(this.shirtColor);
    }
  }

  private buildProceduralMesh(shirtColor: number): void {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.28, 0.6, 4, 8),
      new THREE.MeshStandardMaterial({ color: shirtColor })
    );
    body.position.y = 0.72;
    body.castShadow = true;
    this.group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf5c6a0 })
    );
    head.position.y = 1.5;
    head.castShadow = true;
    this.group.add(head);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const xOff of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat);
      eye.position.set(xOff, 1.53, 0.25);
      this.group.add(eye);
    }
  }

  update(delta: number): void {
    this.animator?.update(delta);
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
