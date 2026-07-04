import { useEffect, useState } from 'react';
import { METALS } from '../lib/ringMath';
import { Snapshot } from '../lib/studioApi';

interface Props {
  snapshots: Snapshot[];
  tasteTags: string[];
  onSave: () => void;
  onRestore: (s: Snapshot) => void;
  onToggleFavorite: (s: Snapshot) => void;
  onToggleTag: (s: Snapshot, tag: string) => void;
  onDelete: (s: Snapshot) => void;
  disabled: boolean;
}

const OPEN_KEY = 'wrs-snapshots-open';

/**
 * 시안 필름스트립 (접이식).
 * 접힌 상태: 한 줄 요약 + 저장 버튼만. 펼치면 시안 카드가 나온다.
 * 시안 클릭 = 그 상태(파라미터+구간+재질)로 즉시 복원.
 */
export default function SnapshotStrip({
  snapshots, tasteTags, onSave, onRestore, onToggleFavorite, onToggleTag, onDelete, disabled,
}: Props) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? '1' : '0');
    } catch {
      /* 저장 실패 무시 */
    }
  }, [open]);

  const favCount = snapshots.filter((s) => s.favorite).length;

  return (
    <div className={`snapshot-strip ${open ? 'open' : ''}`}>
      <div className="snapshot-head">
        <button
          className="snapshot-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={`chev ${open ? 'up' : ''}`}>▾</span>
          시안 보관함
          <em>
            {snapshots.length > 0 ? `시안 ${snapshots.length} · ♥ ${favCount}` : '비어 있음'}
          </em>
        </button>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={disabled}>
          + 현재 상태를 시안으로
        </button>
      </div>

      {open ? (
        snapshots.length === 0 ? (
          <p className="snapshot-empty">
            마음에 드는 순간마다 시안으로 저장하세요. 하트와 태그가 쌓이면 디자이너 공식의
            근거가 됩니다.
          </p>
        ) : (
          <div className="snapshot-row">
            {snapshots.map((s) => (
              <div key={s.id} className={`snapshot-card ${s.favorite ? 'fav' : ''}`}>
                <button
                  className="snapshot-main"
                  onClick={() => onRestore(s)}
                  title="클릭하면 이 시안으로 복원"
                >
                  <strong>{s.label}</strong>
                  <span>
                    {s.params.mode === 'silhouette' ? '실루엣' : '표면 각인'} ·{' '}
                    {METALS[s.metal]?.label ?? s.metal}
                  </span>
                  <span>
                    내경 {s.params.innerDiameter}mm · 폭 {s.params.bandWidth}mm
                  </span>
                </button>
                <div className="snapshot-actions">
                  <button
                    className={`heart ${s.favorite ? 'on' : ''}`}
                    aria-pressed={s.favorite}
                    onClick={() => onToggleFavorite(s)}
                  >
                    {s.favorite ? '♥' : '♡'}
                  </button>
                  <button className="snapshot-del" onClick={() => onDelete(s)} title="시안 삭제">
                    ×
                  </button>
                </div>
                {s.favorite ? (
                  <div className="snapshot-tags">
                    {tasteTags.map((tag) => (
                      <button
                        key={tag}
                        className={`taste-tag ${s.tags.includes(tag) ? 'on' : ''}`}
                        onClick={() => onToggleTag(s, tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
