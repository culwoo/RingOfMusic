/** 파형 → 반지 매핑 공통 정의 */

export type RingMode = 'silhouette' | 'engrave';
export type MetalKey = 'gold' | 'silver' | 'rose';

export interface RingParams {
  mode: RingMode;
  /** 내경 (mm) — 반지 호수 */
  innerDiameter: number;
  /** 밴드 폭 (mm) — 손가락 축 방향 */
  bandWidth: number;
  /** [실루엣] 최소 두께 (mm) */
  baseThickness: number;
  /** [실루엣] 파형 최대 높이 (mm) */
  amplitude: number;
  /** [각인] 밴드 두께 (mm) */
  bandThickness: number;
  /** [각인] 깊이 (mm). 음수=음각, 양수=양각 */
  engraveDepth: number;
  /** 파형 스무딩 강도 */
  smoothing: number;
  /** 링 둘레 샘플 수 */
  samples: number;
}

export const DEFAULT_PARAMS: RingParams = {
  mode: 'silhouette',
  innerDiameter: 17,
  bandWidth: 6,
  baseThickness: 1.6,
  amplitude: 2.4,
  bandThickness: 2.0,
  engraveDepth: -0.6,
  smoothing: 4,
  samples: 540,
};

export const METALS: Record<MetalKey, { label: string; color: number; css: string }> = {
  gold: { label: '골드', color: 0xffc763, css: '#e9c46a' },
  silver: { label: '실버', color: 0xf2f4f5, css: '#cfd4d8' },
  rose: { label: '로즈골드', color: 0xeaa886, css: '#e0a184' },
};

/** 최대 외반경 (mm) — 뷰 스케일 계산용 */
export function maxOuterRadius(p: RingParams): number {
  const innerR = p.innerDiameter / 2;
  if (p.mode === 'silhouette') return innerR + p.baseThickness + p.amplitude;
  return innerR + p.bandThickness + Math.max(0, p.engraveDepth);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** 각인 모드: 밴드 폭 방향 창 함수 (가운데 띠에만 파형 적용) */
export function engraveWindow(t: number): number {
  return smoothstep(0.16, 0.4, t) * (1 - smoothstep(0.6, 0.84, t));
}
