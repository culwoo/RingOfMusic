import * as THREE from 'three';
import { RingParams, engraveWindow, lerp } from './ringMath';

/** 둘레 방향으로 감기는 파라메트릭 표면 한 장의 정의 */
interface SurfaceSpec {
  rows: number; // 폭/두께 방향 분할 수 (>= 2)
  /** (각도 인덱스 i, 행 비율 t 0..1) → [x, y, z] */
  pos: (i: number, theta: number, t: number) => [number, number, number];
}

const cyl = (r: number, theta: number, z: number): [number, number, number] => [
  r * Math.cos(theta),
  r * Math.sin(theta),
  z,
];

/** 여러 표면을 하나의 BufferGeometry로 합침 (둘레는 모듈로 인덱스로 이음새 없이 연결) */
function buildSurfaces(segs: number, specs: SurfaceSpec[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (const { rows, pos } of specs) {
    const base = positions.length / 3;
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1);
      for (let i = 0; i < segs; i++) {
        const theta = (i / segs) * Math.PI * 2;
        const [x, y, z] = pos(i, theta, t);
        positions.push(x, y, z);
      }
    }
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < segs; i++) {
        const i2 = (i + 1) % segs;
        const a = base + j * segs + i;
        const b = base + j * segs + i2;
        const c = base + (j + 1) * segs + i2;
        const d = base + (j + 1) * segs + i;
        indices.push(a, b, c, a, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 파형 → 반지 BufferGeometry (mm 단위, 링 구멍 축 = z)
 * - silhouette: 외곽 반경 자체가 파형 (단면은 직사각형, 반경 높이가 변함)
 * - engrave: 일정한 밴드의 바깥 면 가운데 띠에 파형을 음각/양각
 */
export function buildRingGeometry(amps: Float32Array, p: RingParams): THREE.BufferGeometry {
  const segs = Math.max(8, amps.length);
  const innerR = p.innerDiameter / 2;
  const w = p.bandWidth;
  const a = (i: number) => amps[i % segs] ?? 0;

  if (p.mode === 'silhouette') {
    const outerR = (i: number) => innerR + p.baseThickness + a(i) * p.amplitude;
    return buildSurfaces(segs, [
      // 안쪽 원통
      { rows: 2, pos: (_i, th, t) => cyl(innerR, th, -w / 2 + t * w) },
      // 바깥 파형 면
      { rows: 2, pos: (i, th, t) => cyl(outerR(i), th, -w / 2 + t * w) },
      // 측면 벽 (뒤/앞)
      { rows: 2, pos: (i, th, t) => cyl(lerp(innerR, outerR(i), t), th, -w / 2) },
      { rows: 2, pos: (i, th, t) => cyl(lerp(innerR, outerR(i), t), th, w / 2) },
    ]);
  }

  // engrave 모드
  const outerR = innerR + p.bandThickness;
  const reliefRows = 36;
  return buildSurfaces(segs, [
    { rows: 2, pos: (_i, th, t) => cyl(innerR, th, -w / 2 + t * w) },
    {
      rows: reliefRows,
      pos: (i, th, t) => cyl(outerR + a(i) * p.engraveDepth * engraveWindow(t), th, -w / 2 + t * w),
    },
    { rows: 2, pos: (_i, th, t) => cyl(lerp(innerR, outerR, t), th, -w / 2) },
    { rows: 2, pos: (_i, th, t) => cyl(lerp(innerR, outerR, t), th, w / 2) },
  ]);
}
