import * as THREE from 'three';

interface CircleObstacle {
  type: 'circle';
  x: number;
  z: number;
  radius: number;
}

interface BoxObstacle {
  type: 'box';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface PolygonObstacle {
  type: 'polygon';
  points: readonly { x: number; z: number }[];
  // Precomputed AABB for early rejection
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

type Obstacle = CircleObstacle | BoxObstacle | PolygonObstacle;

export class CollisionSystem {
  private readonly obstacles: Obstacle[] = [];

  addCircle(x: number, z: number, radius: number): void {
    this.obstacles.push({ type: 'circle', x, z, radius });
  }

  addBox(centerX: number, centerZ: number, halfW: number, halfD: number): void {
    this.obstacles.push({
      type: 'box',
      minX: centerX - halfW,
      maxX: centerX + halfW,
      minZ: centerZ - halfD,
      maxZ: centerZ + halfD,
    });
  }

  /**
   * Add a closed polygon obstacle (e.g. pond rim extracted from a GLB mesh).
   * The player cannot enter the interior of this polygon.
   */
  addPolygon(points: { x: number; z: number }[]): void {
    if (points.length < 3) return;
    this.obstacles.push({
      type: 'polygon',
      points,
      minX: Math.min(...points.map(p => p.x)),
      maxX: Math.max(...points.map(p => p.x)),
      minZ: Math.min(...points.map(p => p.z)),
      maxZ: Math.max(...points.map(p => p.z)),
    });
  }

  resolve(position: THREE.Vector3, playerRadius: number): THREE.Vector3 {
    const pos = position.clone();

    for (const obs of this.obstacles) {
      if (obs.type === 'circle') {
        resolveCircle(pos, obs, playerRadius);
      } else if (obs.type === 'box') {
        resolveBox(pos, obs, playerRadius);
      } else {
        resolvePolygon(pos, obs, playerRadius);
      }
    }

    return pos;
  }
}

// ─── Circle ──────────────────────────────────────────────────────────────────

function resolveCircle(pos: THREE.Vector3, obs: CircleObstacle, playerRadius: number): void {
  const dx = pos.x - obs.x;
  const dz = pos.z - obs.z;
  const distSq = dx * dx + dz * dz;
  const minDist = obs.radius + playerRadius;
  if (distSq < minDist * minDist && distSq > 0) {
    const dist = Math.sqrt(distSq);
    pos.x = obs.x + (dx / dist) * minDist;
    pos.z = obs.z + (dz / dist) * minDist;
  }
}

// ─── Box ─────────────────────────────────────────────────────────────────────

function resolveBox(pos: THREE.Vector3, obs: BoxObstacle, playerRadius: number): void {
  const cx = Math.max(obs.minX, Math.min(pos.x, obs.maxX));
  const cz = Math.max(obs.minZ, Math.min(pos.z, obs.maxZ));
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const distSq = dx * dx + dz * dz;

  if (distSq === 0) {
    // Player center inside box — push out nearest edge
    const dLeft   = pos.x - obs.minX;
    const dRight  = obs.maxX - pos.x;
    const dTop    = pos.z - obs.minZ;
    const dBottom = obs.maxZ - pos.z;
    const min = Math.min(dLeft, dRight, dTop, dBottom);
    if      (min === dLeft)   pos.x = obs.minX - playerRadius;
    else if (min === dRight)  pos.x = obs.maxX + playerRadius;
    else if (min === dTop)    pos.z = obs.minZ - playerRadius;
    else                      pos.z = obs.maxZ + playerRadius;
  } else if (distSq < playerRadius * playerRadius) {
    const dist = Math.sqrt(distSq);
    pos.x = cx + (dx / dist) * playerRadius;
    pos.z = cz + (dz / dist) * playerRadius;
  }
}

// ─── Polygon ─────────────────────────────────────────────────────────────────

function resolvePolygon(pos: THREE.Vector3, obs: PolygonObstacle, playerRadius: number): void {
  // Early AABB rejection (expanded by playerRadius)
  if (
    pos.x < obs.minX - playerRadius || pos.x > obs.maxX + playerRadius ||
    pos.z < obs.minZ - playerRadius || pos.z > obs.maxZ + playerRadius
  ) return;

  const { nearestPoint, nearestDist } = nearestPointOnPolygon(pos.x, pos.z, obs.points);
  const inside = pointInPolygon(pos.x, pos.z, obs.points);

  if (!inside && nearestDist >= playerRadius) return; // no collision

  // Push player away from the nearest boundary point
  const dx = pos.x - nearestPoint.x;
  const dz = pos.z - nearestPoint.z;
  const len = Math.sqrt(dx * dx + dz * dz);

  if (len > 0.0001) {
    // Push out to playerRadius distance from the nearest edge point
    pos.x = nearestPoint.x + (dx / len) * playerRadius;
    pos.z = nearestPoint.z + (dz / len) * playerRadius;
  } else {
    // Player exactly on an edge — push along world +X as fallback
    pos.x = nearestPoint.x + playerRadius;
  }
}

/** Returns the nearest point on the polygon boundary and its distance. */
function nearestPointOnPolygon(
  px: number,
  pz: number,
  poly: readonly { x: number; z: number }[]
): { nearestPoint: { x: number; z: number }; nearestDist: number } {
  let nearestDist = Infinity;
  let nearestPoint = poly[0];
  const n = poly.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pt = nearestPointOnSegment(px, pz, poly[j].x, poly[j].z, poly[i].x, poly[i].z);
    if (pt.dist < nearestDist) {
      nearestDist = pt.dist;
      nearestPoint = { x: pt.x, z: pt.z };
    }
  }
  return { nearestPoint, nearestDist };
}

/** Nearest point on segment AB to point P, plus distance. */
function nearestPointOnSegment(
  px: number, pz: number,
  ax: number, az: number,
  bx: number, bz: number
): { x: number; z: number; dist: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) {
    const d = Math.sqrt((px - ax) ** 2 + (pz - az) ** 2);
    return { x: ax, z: az, dist: d };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  const nx = ax + t * dx;
  const nz = az + t * dz;
  const dist = Math.sqrt((px - nx) ** 2 + (pz - nz) ** 2);
  return { x: nx, z: nz, dist };
}

/** Ray casting point-in-polygon test (XZ plane). */
function pointInPolygon(
  px: number,
  pz: number,
  poly: readonly { x: number; z: number }[]
): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, zi = poly[i].z;
    const xj = poly[j].x, zj = poly[j].z;
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── Convex Hull (Jarvis march / gift wrapping) ───────────────────────────────

/** Computes the convex hull of a set of 2D points in XZ. */
export function convexHull(points: { x: number; z: number }[]): { x: number; z: number }[] {
  if (points.length < 3) return points;

  // Remove duplicates with a grid snap to avoid degenerate cases
  const snap = (v: number) => Math.round(v * 100) / 100;
  const seen = new Set<string>();
  const pts = points.filter(p => {
    const key = `${snap(p.x)},${snap(p.z)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (pts.length < 3) return pts;

  // Find the leftmost point
  let start = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x < pts[start].x || (pts[i].x === pts[start].x && pts[i].z < pts[start].z)) {
      start = i;
    }
  }

  const hull: { x: number; z: number }[] = [];
  let current = start;

  do {
    hull.push(pts[current]);
    let next = (current + 1) % pts.length;
    for (let i = 0; i < pts.length; i++) {
      // Cross product: negative = pts[i] is more counterclockwise than pts[next]
      const cross =
        (pts[next].x - pts[current].x) * (pts[i].z - pts[current].z) -
        (pts[next].z - pts[current].z) * (pts[i].x - pts[current].x);
      if (cross < 0) next = i;
    }
    current = next;
  } while (current !== start && hull.length <= pts.length);

  return hull;
}
