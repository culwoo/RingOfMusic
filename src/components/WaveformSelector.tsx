import { useCallback, useEffect, useRef, useState } from 'react';
import { formatTime } from '../lib/audio';

export interface Selection {
  start: number; // 0..1
  end: number; // 0..1
}

interface Props {
  buffer: AudioBuffer;
  peaks: Float32Array; // 전체 트랙 표시용 피크
  selection: Selection;
  onChange: (sel: Selection) => void;
}

type DragState =
  | { type: 'new'; anchor: number; prev: Selection }
  | { type: 'start' }
  | { type: 'end' }
  | null;

const MIN_SEL = 0.005;

/** 파형 표시 + 드래그 구간 선택 + 선택 구간 미리듣기 */
export default function WaveformSelector({ buffer, peaks, selection, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);

  const duration = buffer.duration;

  /* ---------- 그리기 ---------- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);

    const mid = h / 2;
    const selX0 = selection.start * w;
    const selX1 = selection.end * w;

    // 선택 영역 배경
    g.fillStyle = 'rgba(233, 196, 106, 0.07)';
    g.fillRect(selX0, 0, selX1 - selX0, h);

    // 파형 바
    const n = peaks.length;
    for (let x = 0; x < w; x++) {
      const idx = Math.min(n - 1, Math.floor((x / w) * n));
      const a = peaks[idx];
      const half = Math.max(0.6, a * mid * 0.92);
      const inSel = x >= selX0 && x <= selX1;
      g.fillStyle = inSel ? '#e9c46a' : '#3d3d49';
      g.fillRect(x, mid - half, 1, half * 2);
    }

    // 선택 경계선 + 핸들
    g.fillStyle = '#f4e7c3';
    for (const x of [selX0, selX1]) {
      g.fillRect(x - 1, 0, 2, h);
      g.fillRect(x - 4, mid - 11, 8, 22);
    }

    // 시간 라벨
    g.font = '10px ui-monospace, monospace';
    g.fillStyle = '#9a9aa4';
    const t0 = formatTime(selection.start * duration);
    const t1 = formatTime(selection.end * duration);
    g.textAlign = 'left';
    g.fillText(t0, Math.min(Math.max(2, selX0 + 6), w - 70), 12);
    g.textAlign = 'right';
    g.fillText(t1, Math.max(Math.min(w - 2, selX1 - 6), 70), h - 5);
  }, [peaks, selection, duration]);

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  /* ---------- 드래그 선택 ---------- */
  const fracFromEvent = (e: React.PointerEvent): number => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.setPointerCapture(e.pointerId);
    const f = fracFromEvent(e);
    const rect = wrap.getBoundingClientRect();
    const px = (x: number) => Math.abs((f - x) * rect.width);
    if (px(selection.start) < 7) dragRef.current = { type: 'start' };
    else if (px(selection.end) < 7) dragRef.current = { type: 'end' };
    else {
      dragRef.current = { type: 'new', anchor: f, prev: selection };
      onChange({ start: f, end: f });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const f = fracFromEvent(e);
    if (d.type === 'new') {
      onChange({ start: Math.min(d.anchor, f), end: Math.max(d.anchor, f) });
    } else if (d.type === 'start') {
      onChange({ start: Math.min(f, selection.end - MIN_SEL), end: selection.end });
    } else {
      onChange({ start: selection.start, end: Math.max(f, selection.start + MIN_SEL) });
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.type === 'new' && selection.end - selection.start < MIN_SEL) {
      onChange(d.prev); // 클릭만 한 경우 이전 선택 유지
    }
  };

  /* ---------- 미리듣기 ---------- */
  const stop = useCallback(() => {
    try {
      srcRef.current?.stop();
    } catch {
      /* already stopped */
    }
    srcRef.current = null;
    setPlaying(false);
  }, []);

  useEffect(() => () => stop(), [buffer, stop]);

  const togglePlay = async () => {
    if (playing) {
      stop();
      return;
    }
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    await ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const startSec = selection.start * duration;
    const durSec = Math.max(0.05, (selection.end - selection.start) * duration);
    src.onended = () => setPlaying(false);
    src.start(0, startSec, durSec);
    srcRef.current = src;
    setPlaying(true);
  };

  return (
    <div className="waveform-bar">
      <div
        ref={wrapRef}
        className="waveform-canvas-wrap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => onChange({ start: 0, end: 1 })}
        title="드래그: 구간 선택 · 더블클릭: 전체 선택"
      >
        <canvas ref={canvasRef} />
      </div>
      <div className="waveform-side">
        <button className="btn btn-ghost" onClick={togglePlay}>
          {playing ? '■ 정지' : '▶ 미리듣기'}
        </button>
        <button className="btn btn-ghost" onClick={() => onChange({ start: 0, end: 1 })}>
          전체 선택
        </button>
        <span className="waveform-hint">
          {formatTime((selection.end - selection.start) * duration)} 선택됨
        </span>
      </div>
    </div>
  );
}
