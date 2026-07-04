import { useEffect, useState } from 'react';
import { MetalKey, METALS, RingParams } from '../lib/ringMath';
import { fetchInsights, Insights, saveFormula, StudioFormula } from '../lib/studioApi';

interface Props {
  formula: StudioFormula | null;
  currentParams: RingParams;
  currentMetal: MetalKey;
  onApply: (params: RingParams, metal: MetalKey) => void;
  onSaved: (f: StudioFormula) => void;
}

/**
 * 디자인 공식 카드.
 * 공식 = 디자이너가 소유하는 기본 파라미터 + 태그 어휘. 저장할 때마다 버전이 쌓인다.
 * "현재 값을 공식으로" = 디자이너가 손으로 찾은 좋은 지점을 시스템의 기준으로 승격.
 */
export default function FormulaCard({ formula, currentParams, currentMetal, onApply, onSaved }: Props) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setNote(formula?.designerNote ?? '');
  }, [formula?.version]);

  useEffect(() => {
    void fetchInsights().then(setInsights);
  }, [formula?.version]);

  if (!formula) {
    return (
      <section className="panel-group formula-card">
        <h3>디자인 공식</h3>
        <p className="panel-hint">서버 미연결 - `npm run dev`로 실행하면 공식/프로젝트가 활성화됩니다.</p>
      </section>
    );
  }

  const save = async () => {
    setSaving(true);
    setMessage('');
    const saved = await saveFormula({
      name: formula.name,
      designerNote: note,
      defaults: currentParams,
      defaultMetal: currentMetal,
      tasteTags: formula.tasteTags,
    });
    setSaving(false);
    if (saved) {
      onSaved(saved);
      setMessage(`v${saved.version} 저장됨`);
    } else {
      setMessage('저장 실패');
    }
  };

  return (
    <section className="panel-group formula-card">
      <h3>
        디자인 공식 <em className="formula-ver">v{formula.version}</em>
      </h3>
      <div className="formula-actions">
        <button className="btn" onClick={() => onApply(formula.defaults, formula.defaultMetal)}>
          공식 기본값 적용
        </button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? '저장 중' : '현재 값을 공식으로'}
        </button>
      </div>
      <textarea
        className="formula-note"
        rows={2}
        placeholder="공식 메모 (의도, 원칙)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {insights && insights.totalEvents > 0 ? (
        <div className="formula-insights">
          <p>
            하트 {insights.favorites}건
            {insights.favoriteParamAverages
              ? ` · 선호 파형 높이 평균 ${insights.favoriteParamAverages.amplitude}mm · 폭 ${insights.favoriteParamAverages.bandWidth}mm`
              : ''}
          </p>
          {Object.keys(insights.byMetal).length > 0 ? (
            <p>
              재질 선호:{' '}
              {Object.entries(insights.byMetal)
                .filter(([, c]) => c > 0)
                .map(([k, c]) => `${METALS[k as MetalKey]?.label ?? k} ${c}`)
                .join(' · ')}
            </p>
          ) : null}
          {insights.tagCounts.length > 0 ? (
            <p className="formula-taglist">
              {insights.tagCounts.map((t) => `${t.tag} ×${t.count}`).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="panel-hint">시안에 하트·태그가 쌓이면 여기서 취향 통계가 보입니다.</p>
      )}
      {message ? <p className="formula-msg">{message}</p> : null}
    </section>
  );
}
