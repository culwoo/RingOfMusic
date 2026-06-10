import { MetalKey, METALS, RingParams } from '../lib/ringMath';

interface Props {
  params: RingParams;
  onParams: (patch: Partial<RingParams>) => void;
  metal: MetalKey;
  onMetal: (m: MetalKey) => void;
  autoRotate: boolean;
  onAutoRotate: (v: boolean) => void;
}

function Slider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <span className="slider-head">
        <span>{label}</span>
        <span className="slider-value">
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit ?? ''}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function ControlPanel({
  params: p, onParams, metal, onMetal, autoRotate, onAutoRotate,
}: Props) {
  const silhouette = p.mode === 'silhouette';

  return (
    <aside className="panel">
      <section className="panel-group">
        <h3>매핑 모드</h3>
        <div className="segmented">
          <button
            className={silhouette ? 'on' : ''}
            onClick={() => onParams({ mode: 'silhouette' })}
          >
            실루엣
          </button>
          <button
            className={!silhouette ? 'on' : ''}
            onClick={() => onParams({ mode: 'engrave' })}
          >
            표면 각인
          </button>
        </div>
        <p className="panel-hint">
          {silhouette
            ? '반지 외곽 자체가 파형으로 출렁이는 형태'
            : '일정한 밴드 표면에 파형을 음각/양각'}
        </p>
      </section>

      <section className="panel-group">
        <h3>재질</h3>
        <div className="metal-row">
          {(Object.keys(METALS) as MetalKey[]).map((k) => (
            <button
              key={k}
              className={`metal ${metal === k ? 'on' : ''}`}
              onClick={() => onMetal(k)}
            >
              <i style={{ background: METALS[k].css }} />
              {METALS[k].label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel-group">
        <h3>치수</h3>
        <Slider label="내경" value={p.innerDiameter} min={13} max={23} step={0.5} unit=" mm"
          onChange={(v) => onParams({ innerDiameter: v })} />
        <Slider label="밴드 폭" value={p.bandWidth} min={3} max={12} step={0.5} unit=" mm"
          onChange={(v) => onParams({ bandWidth: v })} />
        {silhouette ? (
          <>
            <Slider label="기본 두께" value={p.baseThickness} min={1} max={3} step={0.1} unit=" mm"
              onChange={(v) => onParams({ baseThickness: v })} />
            <Slider label="파형 높이" value={p.amplitude} min={0.5} max={5} step={0.1} unit=" mm"
              onChange={(v) => onParams({ amplitude: v })} />
          </>
        ) : (
          <>
            <Slider label="밴드 두께" value={p.bandThickness} min={1.2} max={3.5} step={0.1} unit=" mm"
              onChange={(v) => onParams({ bandThickness: v })} />
            <Slider label="각인 깊이 (−음각/+양각)" value={p.engraveDepth} min={-1.2} max={1.2} step={0.05} unit=" mm"
              onChange={(v) => onParams({ engraveDepth: v })} />
          </>
        )}
      </section>

      <section className="panel-group">
        <h3>파형</h3>
        <Slider label="스무딩" value={p.smoothing} min={0} max={15} step={1}
          onChange={(v) => onParams({ smoothing: v })} />
        <Slider label="디테일 (샘플 수)" value={p.samples} min={180} max={1080} step={60}
          onChange={(v) => onParams({ samples: v })} />
      </section>

      <section className="panel-group">
        <label className="check">
          <input
            type="checkbox"
            checked={autoRotate}
            onChange={(e) => onAutoRotate(e.target.checked)}
          />
          3D 자동 회전
        </label>
      </section>
    </aside>
  );
}
