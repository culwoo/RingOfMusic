import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { RingParams } from '../lib/ringMath';
import { downloadSVGElement } from '../lib/exporters';
import { formatTime } from '../lib/audio';

export interface SketchHandle {
  exportSVG: (fileName: string) => void;
}

interface Props {
  amps: Float32Array;
  params: RingParams;
  fileName: string;
  selStartSec: number;
  selEndSec: number;
}

const W = 760;
const H = 1060;
const S = 9; // px per mm
const INK = '#1c1c1e';
const DIM = '#a16207';
const REF = '#9a9aa4';

function decimate(amps: Float32Array, maxPts: number): number[] {
  const step = Math.max(1, Math.floor(amps.length / maxPts));
  const out: number[] = [];
  for (let i = 0; i < amps.length; i += step) out.push(amps[i]);
  return out;
}

function polarPath(cx: number, cy: number, radii: number[]): string {
  const n = radii.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const x = cx + radii[i] * Math.cos(th);
    const y = cy + radii[i] * Math.sin(th);
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d + 'Z';
}

const fmt = (n: number) => n.toFixed(1);

/** 제작용 2D 도면: 정면도 + 전개도 + 치수 + 타이틀 블록 */
const RingSketch2D = forwardRef<SketchHandle, Props>(function RingSketch2D(
  { amps, params: p, fileName, selStartSec, selEndSec },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null);

  useImperativeHandle(ref, () => ({
    exportSVG: (name: string) => {
      if (svgRef.current) downloadSVGElement(svgRef.current, name);
    },
  }));

  const view = useMemo(() => {
    const pts = decimate(amps, 720);
    const n = pts.length;
    const innerR = p.innerDiameter / 2;
    const silhouette = p.mode === 'silhouette';

    // ----- 정면도 -----
    const cx = W / 2;
    const cy = 332;
    const innerRpx = innerR * S;
    const baseR = silhouette ? innerR + p.baseThickness : innerR + p.bandThickness;
    const baseRpx = baseR * S;
    const maxOuterMm = silhouette
      ? innerR + p.baseThickness + p.amplitude
      : innerR + p.bandThickness + Math.max(0, p.engraveDepth);
    const maxOuterPx = maxOuterMm * S;

    const contour = silhouette
      ? polarPath(cx, cy, pts.map((a) => (innerR + p.baseThickness + a * p.amplitude) * S))
      : '';
    const engraveLine = !silhouette
      ? polarPath(cx, cy, pts.map((a) => (baseR + a * p.engraveDepth) * S))
      : '';

    // ----- 치수 (내경 / 최대 외경) -----
    const dimY1 = cy + maxOuterPx + 34;
    const dimY2 = dimY1 + 26;

    // ----- 전개도 -----
    const lengthMm = Math.PI * baseR * 2; // 기준원 전개 길이
    const fitK = Math.min(1, 600 / (lengthMm * S));
    const stripW = lengthMm * S * fitK;
    const sx = (W - stripW) / 2;
    const stripTop = dimY2 + 64;
    const stripH = silhouette ? (p.baseThickness + p.amplitude) * S : p.bandWidth * S;

    let stripPath = '';
    if (silhouette) {
      // 옆 단면 프로파일 (아래 = 안쪽 기준선)
      const bottom = stripTop + stripH;
      let d = `M${sx.toFixed(2)} ${bottom.toFixed(2)}`;
      for (let i = 0; i <= n; i++) {
        const a = pts[i % n];
        const x = sx + (i / n) * stripW;
        const y = bottom - (p.baseThickness + a * p.amplitude) * S;
        d += `L${x.toFixed(2)} ${y.toFixed(2)}`;
      }
      d += `L${(sx + stripW).toFixed(2)} ${bottom.toFixed(2)}Z`;
      stripPath = d;
    } else {
      // 각인 아트워크 (좌우 미러 파형)
      const midY = stripTop + stripH / 2;
      const hh = stripH * 0.34;
      let top = '';
      let bot = '';
      for (let i = 0; i <= n; i++) {
        const a = Math.max(0.02, pts[i % n]);
        const x = sx + (i / n) * stripW;
        top += `${top === '' ? 'M' : 'L'}${x.toFixed(2)} ${(midY - a * hh).toFixed(2)}`;
      }
      for (let i = n; i >= 0; i--) {
        const a = Math.max(0.02, pts[i % n]);
        const x = sx + (i / n) * stripW;
        bot += `L${x.toFixed(2)} ${(midY + a * hh).toFixed(2)}`;
      }
      stripPath = top + bot + 'Z';
    }

    const stripBottom = stripTop + stripH;
    const stripDimY = stripBottom + 28;

    return {
      pts, n, cx, cy, innerRpx, baseRpx, maxOuterMm, maxOuterPx,
      contour, engraveLine, silhouette,
      dimY1, dimY2,
      lengthMm, fitK, stripW, sx, stripTop, stripH, stripPath, stripBottom, stripDimY,
    };
  }, [amps, p]);

  const v = view;
  const titleTop = v.stripDimY + 46;
  const today = new Date().toLocaleDateString('ko-KR');

  const infoRows: Array<[string, string]> = [
    ['파일', fileName || '—'],
    ['선택 구간', `${formatTime(selStartSec)} – ${formatTime(selEndSec)}`],
    ['모드', v.silhouette ? '실루엣 (외곽 파형)' : `표면 각인 (${p.engraveDepth < 0 ? '음각' : '양각'})`],
    ['내경 / 밴드 폭', `⌀${fmt(p.innerDiameter)} / ${fmt(p.bandWidth)} mm`],
    [
      v.silhouette ? '기본 두께 / 파형 높이' : '밴드 두께 / 각인 깊이',
      v.silhouette
        ? `${fmt(p.baseThickness)} / ${fmt(p.amplitude)} mm`
        : `${fmt(p.bandThickness)} / ${fmt(Math.abs(p.engraveDepth))} mm`,
    ],
    ['샘플 수 / 작성일', `${p.samples} pts / ${today}`],
  ];

  return (
    <div className="sketch-wrap">
      <svg
        ref={svgRef}
        className="sketch-svg"
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={DIM} />
          </marker>
        </defs>

        {/* 용지 + 프레임 */}
        <rect x="0" y="0" width={W} height={H} fill="#fdfcf8" />
        <rect x="18" y="18" width={W - 36} height={H - 36} fill="none" stroke="#c9c5b9" strokeWidth="1" />

        {/* 헤더 */}
        <text x="40" y="58" fontSize="17" fontWeight="700" fill={INK} fontFamily="sans-serif">
          SOUNDWAVE RING — 제작 도면
        </text>
        <text x="40" y="78" fontSize="11" fill="#6b6b70" fontFamily="sans-serif">
          Waveform Ring Studio · 실치수 1mm = {S}px{v.fitK < 1 ? ` · 전개도 길이 축척 ${(v.fitK * 100).toFixed(0)}%` : ''}
        </text>
        <line x1="40" y1="92" x2={W - 40} y2="92" stroke="#c9c5b9" strokeWidth="1" />

        {/* ---------- 정면도 ---------- */}
        <text x="40" y="122" fontSize="12" fontWeight="600" fill={INK} fontFamily="sans-serif">
          ① 정면도
        </text>

        {/* 십자 중심선 */}
        <line x1={v.cx - v.maxOuterPx - 18} y1={v.cy} x2={v.cx + v.maxOuterPx + 18} y2={v.cy} stroke={REF} strokeWidth="0.7" strokeDasharray="8 4 1.5 4" />
        <line x1={v.cx} y1={v.cy - v.maxOuterPx - 18} x2={v.cx} y2={v.cy + v.maxOuterPx + 18} stroke={REF} strokeWidth="0.7" strokeDasharray="8 4 1.5 4" />

        {/* 내경 원 */}
        <circle cx={v.cx} cy={v.cy} r={v.innerRpx} fill="none" stroke={INK} strokeWidth="1.4" />

        {v.silhouette ? (
          <>
            {/* 기준원 (최소 두께) */}
            <circle cx={v.cx} cy={v.cy} r={v.baseRpx} fill="none" stroke={REF} strokeWidth="0.8" strokeDasharray="4 3" />
            {/* 파형 외곽 */}
            <path d={v.contour} fill="rgba(28,28,30,0.06)" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          </>
        ) : (
          <>
            {/* 외경 원 */}
            <circle cx={v.cx} cy={v.cy} r={v.baseRpx} fill="none" stroke={INK} strokeWidth="1.6" />
            {/* 각인 파형 라인 */}
            <path d={v.engraveLine} fill="none" stroke={DIM} strokeWidth="1" strokeLinejoin="round" />
          </>
        )}

        {/* 내경 치수 */}
        <line x1={v.cx - v.innerRpx} y1={v.cy} x2={v.cx - v.innerRpx} y2={v.dimY1} stroke={DIM} strokeWidth="0.7" />
        <line x1={v.cx + v.innerRpx} y1={v.cy} x2={v.cx + v.innerRpx} y2={v.dimY1} stroke={DIM} strokeWidth="0.7" />
        <line x1={v.cx - v.innerRpx} y1={v.dimY1} x2={v.cx + v.innerRpx} y2={v.dimY1} stroke={DIM} strokeWidth="1" markerStart="url(#arr)" markerEnd="url(#arr)" />
        <text x={v.cx} y={v.dimY1 - 6} fontSize="11" fill={DIM} textAnchor="middle" fontFamily="monospace">
          ⌀ {fmt(p.innerDiameter)} (내경)
        </text>

        {/* 최대 외경 치수 */}
        <line x1={v.cx - v.maxOuterPx} y1={v.cy} x2={v.cx - v.maxOuterPx} y2={v.dimY2} stroke={DIM} strokeWidth="0.7" strokeDasharray="3 3" />
        <line x1={v.cx + v.maxOuterPx} y1={v.cy} x2={v.cx + v.maxOuterPx} y2={v.dimY2} stroke={DIM} strokeWidth="0.7" strokeDasharray="3 3" />
        <line x1={v.cx - v.maxOuterPx} y1={v.dimY2} x2={v.cx + v.maxOuterPx} y2={v.dimY2} stroke={DIM} strokeWidth="1" markerStart="url(#arr)" markerEnd="url(#arr)" />
        <text x={v.cx} y={v.dimY2 + 14} fontSize="11" fill={DIM} textAnchor="middle" fontFamily="monospace">
          ⌀ {fmt(v.maxOuterMm * 2)} (최대 외경)
        </text>

        {/* ---------- 전개도 ---------- */}
        <text x="40" y={v.stripTop - 18} fontSize="12" fontWeight="600" fill={INK} fontFamily="sans-serif">
          ② 전개도 — {v.silhouette ? '측면 프로파일 (절삭/캐스팅용)' : '각인 아트워크 (레이저/인그레이빙용)'}
        </text>

        {!v.silhouette && (
          <rect x={v.sx} y={v.stripTop} width={v.stripW} height={v.stripH} fill="none" stroke={INK} strokeWidth="1.2" />
        )}
        {v.silhouette && (
          <line x1={v.sx} y1={v.stripBottom} x2={v.sx + v.stripW} y2={v.stripBottom} stroke={REF} strokeWidth="0.8" strokeDasharray="4 3" />
        )}
        <path d={v.stripPath} fill={v.silhouette ? 'rgba(28,28,30,0.85)' : '#1c1c1e'} stroke="none" />

        {/* 전개 길이 치수 */}
        <line x1={v.sx} y1={v.stripBottom + 6} x2={v.sx} y2={v.stripDimY} stroke={DIM} strokeWidth="0.7" />
        <line x1={v.sx + v.stripW} y1={v.stripBottom + 6} x2={v.sx + v.stripW} y2={v.stripDimY} stroke={DIM} strokeWidth="0.7" />
        <line x1={v.sx} y1={v.stripDimY} x2={v.sx + v.stripW} y2={v.stripDimY} stroke={DIM} strokeWidth="1" markerStart="url(#arr)" markerEnd="url(#arr)" />
        <text x={W / 2} y={v.stripDimY + 14} fontSize="11" fill={DIM} textAnchor="middle" fontFamily="monospace">
          L = {fmt(v.lengthMm)} mm (기준 ⌀{fmt(2 * (v.baseRpx / S))} 전개)
        </text>

        {/* 폭/두께 치수 (우측) */}
        <line x1={v.sx + v.stripW + 14} y1={v.stripTop} x2={v.sx + v.stripW + 14} y2={v.stripBottom} stroke={DIM} strokeWidth="1" markerStart="url(#arr)" markerEnd="url(#arr)" />
        <text x={v.sx + v.stripW + 22} y={(v.stripTop + v.stripBottom) / 2 + 4} fontSize="11" fill={DIM} fontFamily="monospace">
          {v.silhouette ? `${fmt(p.baseThickness + p.amplitude)}` : `${fmt(p.bandWidth)}`}
        </text>

        {/* ---------- 타이틀 블록 ---------- */}
        <rect x="40" y={titleTop} width={W - 80} height={infoRows.length * 22 + 14} fill="none" stroke="#c9c5b9" strokeWidth="1" />
        {infoRows.map(([k, val], i) => (
          <g key={k}>
            <text x="54" y={titleTop + 24 + i * 22} fontSize="11" fill="#6b6b70" fontFamily="sans-serif">
              {k}
            </text>
            <text x="220" y={titleTop + 24 + i * 22} fontSize="11" fill={INK} fontFamily="monospace">
              {val}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
});

export default RingSketch2D;
