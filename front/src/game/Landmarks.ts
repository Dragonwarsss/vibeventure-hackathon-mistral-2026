import * as THREE from 'three';

/** Adds all cultural decorations to the scene. */
export function addCulturalLandmarks(scene: THREE.Scene): void {
  addFountain(scene);
  addPaths(scene);
  addTorii(scene, 10, 10);
  addPyramid(scene, -11, 2);
  addBaobab(scene, 7, -12);
  addIndianArch(scene, -8, -12);
  addCherryBlossomCluster(scene);
  addCactusCluster(scene);
  addPonds(scene);
  addFlowerPatches(scene);
}

// ─── Central Fountain ────────────────────────────────────────────────────────

function addFountain(scene: THREE.Scene): void {
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.85 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x29b6f6, transparent: true, opacity: 0.75 });

  // Basin ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.32, 8, 32), stoneMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.22;
  ring.castShadow = true;
  scene.add(ring);

  // Water surface
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.75, 24), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.14;
  scene.add(water);

  // Center pillar
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.8, 8), stoneMat);
  pillar.position.y = 1.0;
  pillar.castShadow = true;
  scene.add(pillar);

  // Globe on top (world symbol)
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0x1565c0, emissive: 0x0d47a1, emissiveIntensity: 0.4 })
  );
  globe.position.y = 2.1;
  scene.add(globe);
}

// ─── Stone Paths ─────────────────────────────────────────────────────────────

function addPaths(scene: THREE.Scene): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0xb5a590, roughness: 0.92 });
  const routes: [number, number, number, number][] = [
    [0, 2.5, 12, 9],     // → Japon
    [0, 2.5, -12, 7],    // → Mexique
    [0, -2.5, 8, -13],   // → Sénégal
    [0, -2.5, -9, -13],  // → Inde
  ];
  for (const [x1, z1, x2, z2] of routes) {
    addStonePath(scene, x1, z1, x2, z2, mat);
  }
}

function addStonePath(
  scene: THREE.Scene,
  x1: number, z1: number,
  x2: number, z2: number,
  mat: THREE.Material
): void {
  const dx = x2 - x1, dz = z2 - z1;
  const length = Math.sqrt(dx * dx + dz * dz);
  const path = new THREE.Mesh(new THREE.BoxGeometry(2, 0.015, length), mat);
  path.position.set((x1 + x2) / 2, 0.008, (z1 + z2) / 2);
  path.rotation.y = Math.atan2(dx, dz);
  path.receiveShadow = true;
  scene.add(path);
}

// ─── Torii Gate (Japan) ──────────────────────────────────────────────────────

function addTorii(scene: THREE.Scene, x: number, z: number): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.6 });
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  for (const xOff of [-1.3, 1.3]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 4.2, 8), mat);
    pillar.position.set(xOff, 2.1, 0);
    pillar.castShadow = true;
    group.add(pillar);
  }
  // Kasagi (top beam)
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.28, 0.45), mat);
  top.position.y = 4.35;
  group.add(top);
  // Nuki (lower crossbeam)
  const mid = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.3), mat);
  mid.position.y = 3.55;
  group.add(mid);

  scene.add(group);
}

// ─── Stepped Pyramid (Mexico) ────────────────────────────────────────────────

function addPyramid(scene: THREE.Scene, x: number, z: number): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc8a96e, roughness: 0.85 });
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const layers = 4;
  const baseSize = 3.8;
  const layerH = 0.68;
  for (let i = 0; i < layers; i++) {
    const size = baseSize - i * 0.75;
    const block = new THREE.Mesh(new THREE.BoxGeometry(size, layerH, size), mat);
    block.position.y = i * layerH + layerH / 2;
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);
  }
  scene.add(group);
}

// ─── Baobab Tree (Senegal) ───────────────────────────────────────────────────

function addBaobab(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.78, 3, 10),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63 })
  );
  trunk.position.y = 1.5;
  trunk.castShadow = true;
  group.add(trunk);

  // Wide, flat crown
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x558b2f })
  );
  crown.scale.set(1, 0.52, 1);
  crown.position.y = 4.0;
  crown.castShadow = true;
  group.add(crown);

  scene.add(group);
}

// ─── Decorated Arch (India) ──────────────────────────────────────────────────

function addIndianArch(scene: THREE.Scene, x: number, z: number): void {
  const safMat = new THREE.MeshStandardMaterial({ color: 0xe65100, roughness: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffd54f, emissiveIntensity: 0.3 });
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  for (const xOff of [-1.7, 1.7]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 4.8, 10), safMat);
    pillar.position.set(xOff, 2.4, 0);
    pillar.castShadow = true;
    group.add(pillar);

    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), goldMat);
    orb.position.set(xOff, 5.1, 0);
    group.add(orb);
  }
  // Half-torus arch
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.22, 8, 24, Math.PI), safMat);
  arch.rotation.z = Math.PI;
  arch.position.y = 4.8;
  group.add(arch);

  scene.add(group);
}

// ─── Cherry Blossom Trees (Japan area) ──────────────────────────────────────

function addCherryBlossomCluster(scene: THREE.Scene): void {
  // Placed outside Japan house AABB: x [11.3,16.7], z [5.9,10.1]
  const positions: [number, number][] = [
    [17, 7], [17.5, 10], [14, 13.5], [12, 13], [12.5, 5.5],
  ];
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7d5940 });
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0xf8bbd0, emissive: 0xf06292, emissiveIntensity: 0.07,
  });

  for (const [px, pz] of positions) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 1.9, 7), trunkMat);
    trunk.position.set(px, 0.95, pz);
    trunk.castShadow = true;
    scene.add(trunk);

    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.25, 8, 8), crownMat);
    crown.position.set(px, 2.9, pz);
    crown.castShadow = true;
    scene.add(crown);
  }
}

// ─── Cactus Cluster (Mexico area) ────────────────────────────────────────────

function addCactusCluster(scene: THREE.Scene): void {
  // Placed outside Mexico house AABB: x [-16.7,-11.3], z [3.9,8.1]
  const positions: [number, number][] = [[-17.5, 4], [-17, 8.5], [-12, 2.8]];
  const mat = new THREE.MeshStandardMaterial({ color: 0x388e3c });
  for (const [cx, cz] of positions) addCactus(scene, cx, cz, mat);
}

function addCactus(scene: THREE.Scene, x: number, z: number, mat: THREE.Material): void {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 2.6, 8), mat);
  trunk.position.y = 1.3;
  trunk.castShadow = true;
  group.add(trunk);

  // Left arm
  const lH = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.1, 7), mat);
  lH.rotation.z = -Math.PI / 2.2;
  lH.position.set(-0.75, 1.4, 0);
  group.add(lH);
  const lV = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.9, 7), mat);
  lV.position.set(-1.35, 2.0, 0);
  group.add(lV);

  // Right arm
  const rH = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.9, 7), mat);
  rH.rotation.z = Math.PI / 2.5;
  rH.position.set(0.65, 1.1, 0);
  group.add(rH);
  const rV = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.8, 7), mat);
  rV.position.set(1.2, 1.65, 0);
  group.add(rV);

  scene.add(group);
}

// ─── Decorative Ponds ────────────────────────────────────────────────────────

function addPonds(scene: THREE.Scene): void {
  const mat = new THREE.MeshStandardMaterial({ color: 0x1976d2, transparent: true, opacity: 0.78 });
  const ponds: [number, number, number][] = [
    [5, -6, 2.2],
    [-5, -8, 1.8],
    [3, 6, 2.5],
  ];
  for (const [px, pz, r] of ponds) {
    const pond = new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(px, 0.02, pz);
    scene.add(pond);
  }
}

// ─── Flower Patches ──────────────────────────────────────────────────────────

function addFlowerPatches(scene: THREE.Scene): void {
  const patches: [number, number, number][] = [
    [4, 4, 0xff5252],   [-4, 3, 0xffd600],  [6, -4, 0xe040fb],
    [-6, -5, 0x69f0ae], [2, -8, 0x40c4ff],  [8, 3, 0xff6d00],
    [-8, 2, 0xea80fc],  [5, -10, 0xff5252], [-5, -10, 0xffd600],
    [0, 8, 0x69f0ae],   [9, -5, 0x40c4ff],  [-9, -3, 0xffd600],
    [3, -5, 0xe040fb],  [-3, 5, 0xff6d00],
  ];

  for (const [px, pz, color] of patches) {
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12 });
    const count = 7;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + i * 0.4;
      const dist = 0.25 + (i % 3) * 0.28;
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), mat);
      flower.position.set(
        px + Math.cos(angle) * dist,
        0.11,
        pz + Math.sin(angle) * dist
      );
      scene.add(flower);
    }
  }
}
