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

type Obstacle = CircleObstacle | BoxObstacle;

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

  resolve(position: THREE.Vector3, playerRadius: number): THREE.Vector3 {
    const pos = position.clone();

    for (const obs of this.obstacles) {
      if (obs.type === 'circle') {
        const dx = pos.x - obs.x;
        const dz = pos.z - obs.z;
        const distSq = dx * dx + dz * dz;
        const minDist = obs.radius + playerRadius;

        if (distSq < minDist * minDist && distSq > 0) {
          const dist = Math.sqrt(distSq);
          pos.x = obs.x + (dx / dist) * minDist;
          pos.z = obs.z + (dz / dist) * minDist;
        }
      } else {
        const cx = Math.max(obs.minX, Math.min(pos.x, obs.maxX));
        const cz = Math.max(obs.minZ, Math.min(pos.z, obs.maxZ));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const distSq = dx * dx + dz * dz;

        if (distSq === 0) {
          // Player center is inside box — push out from nearest edge
          const dLeft = pos.x - obs.minX;
          const dRight = obs.maxX - pos.x;
          const dTop = pos.z - obs.minZ;
          const dBottom = obs.maxZ - pos.z;
          const min = Math.min(dLeft, dRight, dTop, dBottom);
          if (min === dLeft) pos.x = obs.minX - playerRadius;
          else if (min === dRight) pos.x = obs.maxX + playerRadius;
          else if (min === dTop) pos.z = obs.minZ - playerRadius;
          else pos.z = obs.maxZ + playerRadius;
        } else if (distSq < playerRadius * playerRadius) {
          const dist = Math.sqrt(distSq);
          pos.x = cx + (dx / dist) * playerRadius;
          pos.z = cz + (dz / dist) * playerRadius;
        }
      }
    }

    return pos;
  }
}
