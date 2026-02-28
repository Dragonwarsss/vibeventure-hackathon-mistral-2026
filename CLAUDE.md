# CLAUDE.md — Base de connaissance du projet vibeventure

> **Règle de mise à jour** : Si tu modifies structurellement l'architecture (ajout/suppression/renommage de fichier, changement de responsabilité d'une classe, nouvelle dépendance majeure, nouveau système de jeu), tu **dois** mettre à jour ce fichier en conséquence avant de terminer ta réponse.

---

## Vue d'ensemble

Jeu vidéo 3D de type exploration culturelle, tourné navigateur. Stack :

- **`front/`** — React 19 + Three.js 0.183 (pas de React Three Fiber). Port 5173. Tout le jeu est en TypeScript vanilla Three.js.
- **`back/`** — NestJS (port 3000). Non utilisé activement par le jeu pour l'instant.
- **`lib/`** — Interfaces TypeScript partagées (`ApiResponse`, `PaginatedResponse`). Importées par chemin relatif.
- **Package manager** : npm. Pas de monorepo/workspaces.

---

## Architecture `front/`

```
front/
├── src/
│   ├── main.tsx                  # Point d'entrée React
│   ├── App.tsx                   # Composant racine, pont React ↔ jeu
│   ├── index.css                 # Styles globaux UI (loading, hints, dialogue)
│   ├── game/                     # Moteur de jeu Three.js (pur TS, pas de JSX)
│   │   ├── Game.ts               # Orchestrateur principal
│   │   ├── Player.ts             # Personnage jouable + chargement GLB
│   │   ├── PlayerAnimator.ts     # Animations du joueur (idle/walk)
│   │   ├── World.ts              # Génération de la scène (terrain, arbres, maisons)
│   │   ├── InputManager.ts       # Clavier (WASD/ZQSD + E)
│   │   ├── ThirdPersonCamera.ts  # Caméra troisième personne
│   │   ├── CollisionSystem.ts    # Physique simplifiée (cercles + boîtes)
│   │   ├── NPC.ts                # Classe NPC + définitions des 4 personnages
│   │   ├── NPCManager.ts         # Spawn, proximité, interaction des NPCs
│   │   ├── House.ts              # Génération d'une maison procédurale
│   │   ├── Landmarks.ts          # Décors culturels (torii, pyramide, baobab…)
│   │   ├── AudioManager.ts       # Ambiance sonore synthétisée (Web Audio API)
│   │   └── types.ts              # Interfaces partagées du jeu
│   ├── components/               # Composants React UI superposés au canvas
│   │   ├── DialogueBox.tsx       # Fenêtre de dialogue avec streaming Mistral
│   │   ├── InteractionHint.tsx   # Hint "E pour parler" près d'un NPC
│   │   └── LoadingScreen.tsx     # Écran de chargement animé
│   ├── services/
│   │   └── MistralService.ts     # Appel API Mistral (streaming SSE)
│   └── assets/
│       ├── GLB/
│       │   ├── character-male-f.glb   # Modèle 3D du joueur (~244 Ko)
│       │   └── Textures/
│       │       └── colormap.png       # Texture UV du modèle joueur
│       └── sound/
│           └── music/
│               └── First Steps Field.mp3  # Musique (non intégrée actuellement)
├── public/                       # Fichiers servis statiquement (vide actuellement)
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.app.json
```

---

## Détail de chaque fichier

### `src/main.tsx`
Point d'entrée React. Monte `<App />` dans `#root`.

---

### `src/App.tsx`
Composant React racine. Fait le pont entre l'UI React et le moteur Three.js.

| Responsabilité | Détail |
|---|---|
| Initialisation du jeu | Crée `new Game(canvas, callbacks)` au mount, le détruit au unmount |
| État UI | `nearbyNPC` (NPC proche), `dialogueNPC` (NPC en dialogue), `loaded`, `showLoading` |
| Pause input | Appelle `game.setInputPaused(true/false)` à l'ouverture/fermeture du dialogue |
| Rendu UI | Canvas plein écran + `InteractionHint` + `DialogueBox` + hint contrôles + `LoadingScreen` |

**Callbacks `GameCallbacks` passés au jeu :**
- `onNPCNearby(npc | null)` → met à jour `nearbyNPC`
- `onNPCInteract(npc)` → ouvre `DialogueBox` et pause les inputs
- `onReady()` → masque l'écran de chargement (après 1200ms)

---

### `src/game/types.ts`
Interfaces TypeScript partagées entre le moteur et React.

```ts
NPCInfo      { id, name, personality }
GameCallbacks { onNPCNearby, onNPCInteract, onReady? }
```

---

### `src/game/Game.ts`
**Orchestrateur principal.** Instancie et connecte tous les systèmes.

| Méthode / Propriété | Rôle |
|---|---|
| `constructor(canvas, callbacks)` | Crée renderer, scène, caméra, clock. Instancie World, Player, ThirdPersonCamera, InputManager, NPCManager, AudioManager. Lance la boucle. Signal `onReady` après 1200ms. |
| `loop()` | Boucle `requestAnimationFrame`. Appelle `player.update`, `thirdPersonCamera.update`, `npcManager.update`, puis `renderer.render`. Delta plafonné à 0.1s. |
| `setInputPaused(paused)` | Délègue à `InputManager.setPaused()` (utilisé pendant les dialogues) |
| `destroy()` | Annule RAF, retire les event listeners, stoppe audio, dispose renderer |
| `onResize` | Adapte caméra et renderer au redimensionnement fenêtre |
| `onFirstInteraction` | Démarre `AudioManager` au premier geste utilisateur (politique autoplay) |

**Paramètres scène :** fond `0x87ceeb`, brouillard `Fog(0x87ceeb, 40, 120)`, caméra FOV 60°, near 0.1, far 500.

---

### `src/game/Player.ts`
**Personnage jouable.** Charge le modèle GLB, gère le mouvement et les animations.

| Méthode | Rôle |
|---|---|
| `constructor(scene)` | Crée un `THREE.Group` vide, l'ajoute à la scène, lance `loadCharacter()` |
| `loadCharacter()` | Charge `character-male-f.glb` + `colormap.png` via `new URL(...)`. Applique la texture à tous les meshes. Lance l'animation `idle`. En cas d'erreur, appelle `buildProceduralMesh()`. |
| `buildProceduralMesh()` | Fallback : capsule bleue + tête skin + yeux noirs, tout ajouté à `this.mesh` |
| `update(delta, input, camera, collision)` | Calcule direction relative à la caméra. Détecte changement moving/idle → `animator.play()`. Déplace et oriente le mesh. Appelle `animator.update(delta)`. |

**Constantes :** `SPEED = 5`, `PLAYER_RADIUS = 0.35`.
**URLs assets :** `new URL('../assets/GLB/character-male-f.glb', import.meta.url).href` (Vite résout au build).

---

### `src/game/PlayerAnimator.ts`
**Gestion des animations Three.js** pour le joueur.

| Méthode | Rôle |
|---|---|
| `constructor(root, clips)` | Crée `AnimationMixer` sur `root`. Indexe les clips par `clip.name.toLowerCase()`. |
| `play(name)` | Trouve l'action (matching partiel, ex : `'walk'` → `'walk_normal'`). Cross-fade depuis l'action courante en 0.2s. |
| `update(delta)` | Avance le mixer. À appeler chaque frame. |
| `findAction(name)` | Recherche exacte puis recherche par inclusion (`k.includes(name)`). |

**Noms d'animations attendus dans le GLB :** `idle`, `walk` (insensible à la casse, matching partiel).

---

### `src/game/World.ts`
**Génération de la scène.** Appelé une seule fois dans `Game`.

| Méthode | Rôle |
|---|---|
| `constructor(scene, collision)` | Appelle `createLights`, `createGround`, `createTrees`, `createHouses`, `addCulturalLandmarks`. Ajoute les colliders manuels (fontaine, baobab, pyramide). |
| `createLights(scene)` | AmbientLight (0.6) + DirectionalLight soleil (0xfff5cc, 1.5) avec shadow map 2048×2048 |
| `createGround(scene)` | Plan 140×140, vert `0x7ec850`, reçoit les ombres |
| `createTrees(scene, collision)` | 55 arbres procéduraux via PRNG Mulberry32 (seed 42). Exclut zones de spawn et maisons. |
| `addTree(scene, x, z, collision)` | Tronc cylindre + couronne sphère + collider cercle r=0.5 |
| `createHouses(scene, collision)` | 4 maisons aux positions `HOUSE_POSITIONS` |

**Positions maisons (HOUSE_POSITIONS) :**
- `(14, 8)` — Japon, rose `0xfce4ec`
- `(-14, 6)` — Mexique, terracotta `0xff8a65`
- `(10, -15)` — Sénégal, jaune `0xfff59d`
- `(-11, -15)` — Inde, lavande `0xe1bee7`

---

### `src/game/InputManager.ts`
**Lecture clavier.**

| Propriété / Méthode | Rôle |
|---|---|
| `forward` | `W` ou `Z` enfoncé (et non pausé) |
| `backward` | `S` enfoncé |
| `left` | `A` ou `Q` enfoncé |
| `right` | `D` enfoncé |
| `consumeInteract()` | Retourne `true` une seule fois par appui sur `E`, puis reset |
| `setPaused(paused)` | Bloque tous les inputs + vide les touches enfoncées |
| `destroy()` | Retire les event listeners |

---

### `src/game/ThirdPersonCamera.ts`
**Caméra troisième personne fixe.**

- Offset fixe : `(0, 6, 10)` derrière/au-dessus du joueur
- Lerp exponentiel frame-rate indépendant (`LERP_SPEED = 8`)
- `update(playerMesh, delta)` : calcule `desired = playerPos + OFFSET`, lerp vers desired, `lookAt(playerPos.y + 1)`

---

### `src/game/CollisionSystem.ts`
**Détection de collision simplifiée** (pas de physique rigide).

| Méthode | Rôle |
|---|---|
| `addCircle(x, z, radius)` | Ajoute un obstacle circulaire (arbres, fontaine, baobab, pyramide, NPCs) |
| `addBox(centerX, centerZ, halfW, halfD)` | Ajoute un obstacle AABB (maisons) |
| `resolve(position, playerRadius)` | Retourne la position corrigée après résolution de toutes les collisions. Gère le cas où le joueur est à l'intérieur d'une boîte (push out nearest edge). |

---

### `src/game/NPC.ts`
**Classe NPC + données des 4 personnages.**

| Élément | Rôle |
|---|---|
| `NPCDefinition` | Interface : `id`, `name`, `personality`, `position {x,z}`, `shirtColor` |
| `NPC_DEFINITIONS[]` | Les 4 NPCs : Yuki (Japon), Carlos (Mexique), Amara (Sénégal), Priya (Inde) |
| `NPC.constructor(scene, def)` | Construit le mesh procédural (capsule + tête + yeux + indicateur doré flottant) |
| `NPC.setHighlighted(active)` | Affiche/cache l'indicateur doré au-dessus du NPC |
| `NPC.lookToward(target, delta)` | Rotation douce vers le joueur quand il est proche |

**Rayon d'interaction :** `interactionRadius = 3.5`.

---

### `src/game/NPCManager.ts`
**Spawn et logique de proximité/interaction des NPCs.**

| Méthode | Rôle |
|---|---|
| `constructor(scene, callbacks)` | Instancie les 4 NPCs depuis `NPC_DEFINITIONS` |
| `update(playerPos, input, delta)` | Pour chaque NPC : calcule distance, highlight si proche, trouve le plus proche. Déclenche `onNPCNearby` si le NPC le plus proche change. Déclenche `onNPCInteract` si E est pressé près d'un NPC. |

---

### `src/game/House.ts`
**Génération d'une maison procédurale.**

| Élément | Détail |
|---|---|
| Corps | `BoxGeometry(5, 3, 4)`, couleur personnalisable |
| Toit | `ConeGeometry(3.9, 2.2, 4)` rouge, tourné 45° |
| Porte | `BoxGeometry(0.9, 1.8, 0.1)` brun, face +z |
| Fenêtres | 2 × `BoxGeometry(0.85, 0.85, 0.1)` bleu clair émissif |
| Collision | `addBox(x, z, 2.7, 2.1)` dans le `CollisionSystem` |

---

### `src/game/Landmarks.ts`
**Décors culturels.** Une seule fonction publique : `addCulturalLandmarks(scene)`.

| Fonction interne | Contenu |
|---|---|
| `addFountain(scene)` | Fontaine centrale : tore pierre + surface eau + pilier + globe bleu émissif |
| `addPaths(scene)` | 4 chemins en pierre de (0,±2.5) vers chaque maison |
| `addTorii(scene, x, z)` | Torii rouge japonais : 2 piliers + kasagi + nuki. Position (10, 10) |
| `addPyramid(scene, x, z)` | Pyramide aztèque 4 niveaux, beige. Position (-11, 2) |
| `addBaobab(scene, x, z)` | Baobab : tronc large + couronne aplatie. Position (7, -12) |
| `addIndianArch(scene, x, z)` | Arche indienne : 2 piliers safran + orbes or + demi-tore. Position (-8, -12) |
| `addCherryBlossomCluster(scene)` | 5 cerisiers roses autour de la maison Japon |
| `addCactusCluster(scene)` | 3 cactus autour de la maison Mexique |
| `addPonds(scene)` | 3 mares décoratives semi-transparentes |
| `addFlowerPatches(scene)` | 14 massifs de fleurs colorées émissives |

---

### `src/game/AudioManager.ts`
**Musique de fond via `HTMLAudioElement`.**

| Méthode | Rôle |
|---|---|
| `start()` | Crée un `HTMLAudioElement`, charge `First Steps Field.mp3`, `loop = true`, `volume = 0.5`, appelle `.play()`. Idempotent. |
| `stop()` | Pause et libère l'élément audio. |

**URL asset :** `new URL('../assets/sound/music/First Steps Field.mp3', import.meta.url).href` (Vite embarque le fichier au build).
**Note :** Le drone synthétique Web Audio API a été supprimé et remplacé par le MP3.

---

### `src/components/DialogueBox.tsx`
**Interface de dialogue NPC avec streaming Mistral.**

| Responsabilité | Détail |
|---|---|
| Salutation automatique | À l'ouverture, envoie un trigger spécial qui fait s'auto-présenter le NPC |
| Streaming | Utilise `streamNPCResponse()` (AsyncGenerator) pour afficher les tokens en temps réel |
| Historique | `conversationHistory` en ref, transmis à chaque appel API |
| Fermeture | Touche Escape ou bouton ×, appelle `onClose()` |
| Envoi | Touche Enter ou bouton Envoyer |

---

### `src/components/InteractionHint.tsx`
Affiche `[NOM NPC] — E — Parler` quand `npc !== null`. Masqué pendant un dialogue.

---

### `src/components/LoadingScreen.tsx`
Écran de chargement animé. Reçoit `done: boolean`. Quand `done`, déclenche un fade-out CSS de 0.6s puis `App.tsx` le retire du DOM.

---

### `src/services/MistralService.ts`
**Client API Mistral.**

| Élément | Détail |
|---|---|
| `streamNPCResponse(npc, history, apiKey)` | AsyncGenerator. POST vers `api.mistral.ai/v1/chat/completions`, model `mistral-small-latest`, stream SSE, max_tokens 160. Yield les tokens au fur et à mesure. |
| `buildSystemPrompt(npc)` | Construit le prompt système : identité NPC, mission culturelle, langue française, 2-3 phrases max, pas de mention d'IA. |
| `ConversationMessage` | `{ role: 'user' | 'assistant', content: string }` |

**Clé API :** `import.meta.env.VITE_MISTRAL_API_KEY` (fichier `.env.local`).

---

## Flux de données

```
App.tsx (React)
  └── new Game(canvas, callbacks)
        ├── World → génère scène statique + CollisionSystem
        ├── Player → charge GLB, update() chaque frame
        ├── NPCManager → 4 NPC, proximité, callbacks React
        ├── ThirdPersonCamera → suit Player.mesh
        ├── InputManager → keyboard state
        └── AudioManager → ambiance synthétique

App.tsx (React UI)
  ├── DialogueBox → streamNPCResponse() → Mistral API (SSE)
  ├── InteractionHint → affiché si nearbyNPC
  └── LoadingScreen → masqué après onReady()
```

---

## Où éditer selon l'objectif

| Objectif | Fichier(s) à modifier |
|---|---|
| Changer vitesse / physique joueur | `Player.ts` — constantes `SPEED`, `PLAYER_RADIUS` |
| Changer modèle 3D joueur | `Player.ts` — `CHARACTER_URL`, `loadCharacter()` |
| Ajouter/modifier animations joueur | `PlayerAnimator.ts` — `findAction()`, `play()` |
| Modifier les touches | `InputManager.ts` — getters `forward/backward/left/right` |
| Ajuster caméra (distance, angle) | `ThirdPersonCamera.ts` — constante `OFFSET`, `LERP_SPEED` |
| Ajouter un obstacle de collision | `CollisionSystem.ts` — `addCircle()` ou `addBox()`, puis l'appeler dans `World.ts` ou `House.ts` |
| Modifier la scène (terrain, arbres) | `World.ts` |
| Ajouter/modifier des maisons | `House.ts` + `HOUSE_POSITIONS` dans `World.ts` |
| Ajouter/modifier décors culturels | `Landmarks.ts` — ajouter une fonction et l'appeler dans `addCulturalLandmarks()` |
| Ajouter/modifier un NPC | `NPC.ts` — `NPC_DEFINITIONS` (personnalité, position, couleur) |
| Changer rayon interaction NPC | `NPC.ts` — `interactionRadius` |
| Modifier la logique de dialogue | `DialogueBox.tsx` |
| Modifier le prompt NPC / comportement IA | `MistralService.ts` — `buildSystemPrompt()` |
| Changer modèle Mistral / max_tokens | `MistralService.ts` — constantes `MODEL`, `max_tokens` |
| Modifier la musique (volume, fichier) | `AudioManager.ts` — `MUSIC_URL`, `volume` |
| Modifier l'UI de chargement | `LoadingScreen.tsx` + `index.css` |
| Modifier le pont React ↔ Three.js | `App.tsx` + `types.ts` (callbacks) |
| Modifier le renderer (ombres, antialiasing) | `Game.ts` — `constructor` |
| Modifier le fog / ciel | `Game.ts` — `this.scene.background`, `this.scene.fog` |
