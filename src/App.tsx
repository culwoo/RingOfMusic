import { useEffect, useMemo, useRef, useState } from 'react';
import UploadDropzone from './components/UploadDropzone';
import WaveformSelector, { Selection } from './components/WaveformSelector';
import ControlPanel from './components/ControlPanel';
import Ring3DView, { Ring3DHandle } from './components/Ring3DView';
import RingSketch2D, { SketchHandle } from './components/RingSketch2D';
import ProjectBar from './components/ProjectBar';
import SnapshotStrip from './components/SnapshotStrip';
import FormulaCard from './components/FormulaCard';
import LoginPanel from './components/LoginPanel';
import { buildRingAmps, decodeAudioFile, extractPeaks, formatTime, generateDemoBuffer, normalize } from './lib/audio';
import { DEFAULT_PARAMS, MetalKey, RingParams } from './lib/ringMath';
import {
  createProject, fetchFormula, getMediaUrl, getSession, listProjects, onAuthChange,
  patchProject, recordFeedback, signOut, uploadMedia,
  ProjectRecord, Snapshot, StudioFormula,
} from './lib/studioApi';

type Tab = '3d' | 'sketch';

export default function App() {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState('');
  const [displayPeaks, setDisplayPeaks] = useState<Float32Array | null>(null);
  const [sel, setSel] = useState<Selection>({ start: 0, end: 1 });
  const [params, setParams] = useState<RingParams>(DEFAULT_PARAMS);
  const [metal, setMetal] = useState<MetalKey>('gold');
  const [tab, setTab] = useState<Tab>('3d');
  const [autoRotate, setAutoRotate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 사업 계층 상태
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [formula, setFormula] = useState<StudioFormula | null>(null);
  const [saveState, setSaveState] = useState('');
  const [hasSession, setHasSession] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [waveOpen, setWaveOpen] = useState(() => {
    try {
      return localStorage.getItem('wrs-wave-open') !== '0';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('wrs-wave-open', waveOpen ? '1' : '0');
    } catch {
      /* 무시 */
    }
  }, [waveOpen]);
  const lastSyncedRef = useRef('');

  const ring3dRef = useRef<Ring3DHandle>(null);
  const sketchRef = useRef<SketchHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  /* ---------- 세션 감시 + 스튜디오 로드 ---------- */
  const loadStudio = async () => {
    const [f, list] = await Promise.all([fetchFormula(), listProjects()]);
    if (f) {
      setFormula(f);
      setParams(f.defaults);
      setMetal(f.defaultMetal);
    } else {
      setFormula(null);
    }
    setProjects(list);
    if (list.length > 0) {
      await openProject(list[0], f);
    }
  };

  useEffect(() => {
    void getSession().then((session) => {
      setHasSession(Boolean(session));
      if (session) void loadStudio();
    });
    const unsubscribe = onAuthChange((session) => {
      setHasSession(Boolean(session));
      if (session) {
        void loadStudio();
      } else {
        setFormula(null);
        setProjects([]);
        setActiveProjectId(null);
        setSaveState('');
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mergeProject = (project: ProjectRecord) => {
    setProjects((cur) => {
      const exists = cur.some((p) => p.id === project.id);
      return exists ? cur.map((p) => (p.id === project.id ? project : p)) : [project, ...cur];
    });
  };

  const loadBuffer = (buf: AudioBuffer, name: string) => {
    setBuffer(buf);
    setFileName(name);
    setDisplayPeaks(normalize(extractPeaks(buf, 1600)));
    setError(null);
  };

  /** 프로젝트 열기: 저장된 원본 오디오와 디자인 상태를 복원한다 */
  const openProject = async (project: ProjectRecord, f?: StudioFormula | null) => {
    setActiveProjectId(project.id);
    const design = project.design;
    if (design) {
      setParams(design.params);
      setMetal(design.metal);
      setSel(design.selection);
      lastSyncedRef.current = JSON.stringify(design);
    } else {
      const base = f ?? formula;
      if (base) {
        setParams(base.defaults);
        setMetal(base.defaultMetal);
      }
      setSel({ start: 0, end: 1 });
      lastSyncedRef.current = '';
    }

    if (project.media?.path) {
      try {
        setLoading(true);
        const url = await getMediaUrl(project.media.path);
        if (!url) throw new Error('signed url failed');
        const res = await fetch(url);
        if (!res.ok) throw new Error('media fetch failed');
        const data = await res.arrayBuffer();
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctor();
        try {
          const buf = await ctx.decodeAudioData(data);
          loadBuffer(buf, project.media.fileName);
          if (design) setSel(design.selection);
        } finally {
          void ctx.close();
        }
        setSaveState('프로젝트 복원됨');
      } catch {
        setBuffer(null);
        setDisplayPeaks(null);
        setSaveState('원본을 불러오지 못함 - 파일을 다시 업로드하세요');
      } finally {
        setLoading(false);
      }
    } else {
      setBuffer(null);
      setDisplayPeaks(null);
      setFileName('');
    }
  };

  const handleSelectProject = (idToOpen: string) => {
    const project = projects.find((p) => p.id === idToOpen);
    if (project) void openProject(project);
  };

  const handleCreateProject = async (input: { name: string; client: string; story: string }) => {
    const project = await createProject(input);
    if (!project) {
      setSaveState('프로젝트 생성 실패 - 서버 확인');
      return;
    }
    mergeProject(project);
    setActiveProjectId(project.id);
    setBuffer(null);
    setDisplayPeaks(null);
    setFileName('');
    if (formula) {
      setParams(formula.defaults);
      setMetal(formula.defaultMetal);
    }
    setSel({ start: 0, end: 1 });
    lastSyncedRef.current = '';
    setSaveState('새 프로젝트');
  };

  /* ---------- 파일 업로드: 로컬 디코딩 + 서버 원본 영구 보존 ---------- */
  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const buf = await decodeAudioFile(file);
      loadBuffer(buf, file.name);
      setSel({ start: 0, end: 1 });
      if (activeProjectId) {
        setSaveState('원본 보존 중');
        const result = await uploadMedia(file, activeProjectId);
        if (result?.project) {
          mergeProject(result.project);
          setSaveState('원본 보존됨');
        } else {
          setSaveState('원본 보존 실패 - 서버 확인');
        }
      }
    } catch {
      setError('오디오 디코딩에 실패했습니다. 다른 파일을 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    loadBuffer(generateDemoBuffer(), '데모 사운드');
    setSel({ start: 0, end: 1 });
  };

  /* ---------- 디자인 상태 자동 저장 ---------- */
  useEffect(() => {
    if (!activeProjectId || !buffer) return;
    const design = { selection: sel, params, metal };
    const serialized = JSON.stringify(design);
    if (serialized === lastSyncedRef.current) return;
    const timeout = window.setTimeout(() => {
      setSaveState('저장 중');
      void patchProject(activeProjectId, { design }).then((project) => {
        if (project) {
          lastSyncedRef.current = serialized;
          mergeProject(project);
          setSaveState('저장됨');
        } else {
          setSaveState('저장 실패');
        }
      });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [activeProjectId, buffer, sel, params, metal]);

  /* ---------- 시안(스냅샷) ---------- */
  const syncSnapshots = (snapshots: Snapshot[]) => {
    if (!activeProject) return;
    mergeProject({ ...activeProject, snapshots });
    void patchProject(activeProject.id, { snapshots }).then((p) => p && mergeProject(p));
  };

  const handleSaveSnapshot = () => {
    if (!activeProject) return;
    const snapshot: Snapshot = {
      id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
      label: `시안 ${activeProject.snapshots.length + 1}`,
      createdAt: new Date().toISOString(),
      params: { ...params },
      metal,
      selection: { ...sel },
      favorite: false,
      tags: [],
    };
    syncSnapshots([...activeProject.snapshots, snapshot]);
    recordFeedback({
      action: 'snapshot', projectId: activeProject.id, snapshotId: snapshot.id,
      metal, mode: params.mode, params, formulaVersion: formula?.version,
    });
  };

  const handleRestoreSnapshot = (s: Snapshot) => {
    setParams({ ...s.params });
    setMetal(s.metal);
    setSel({ ...s.selection });
    recordFeedback({
      action: 'restore', projectId: activeProject?.id, snapshotId: s.id,
      metal: s.metal, mode: s.params.mode, formulaVersion: formula?.version,
    });
  };

  const handleToggleFavorite = (s: Snapshot) => {
    if (!activeProject) return;
    const next = !s.favorite;
    syncSnapshots(
      activeProject.snapshots.map((it) => (it.id === s.id ? { ...it, favorite: next } : it))
    );
    recordFeedback({
      action: next ? 'favorite' : 'unfavorite', projectId: activeProject.id, snapshotId: s.id,
      metal: s.metal, mode: s.params.mode, params: s.params, formulaVersion: formula?.version,
    });
  };

  const handleToggleTag = (s: Snapshot, tag: string) => {
    if (!activeProject) return;
    const has = s.tags.includes(tag);
    const tags = has ? s.tags.filter((t) => t !== tag) : [...s.tags, tag];
    syncSnapshots(activeProject.snapshots.map((it) => (it.id === s.id ? { ...it, tags } : it)));
    recordFeedback({
      action: has ? 'untag' : 'tag', projectId: activeProject.id, snapshotId: s.id, tag,
      metal: s.metal, mode: s.params.mode, formulaVersion: formula?.version,
    });
  };

  const handleDeleteSnapshot = (s: Snapshot) => {
    if (!activeProject) return;
    syncSnapshots(activeProject.snapshots.filter((it) => it.id !== s.id));
  };

  /* ---------- 파생 값 ---------- */
  const amps = useMemo(
    () =>
      buffer
        ? buildRingAmps(buffer, params.samples, params.smoothing, sel.start, sel.end)
        : new Float32Array(0),
    [buffer, params.samples, params.smoothing, sel]
  );

  const patchParams = (patch: Partial<RingParams>) =>
    setParams((prev) => ({ ...prev, ...patch }));

  const exportBase = (fileName.replace(/\.[^.]+$/, '') || 'ring').slice(0, 40);

  // 스튜디오 접근 가능 여부: 화이트리스트 계정으로 로그인해 공식을 읽을 수 있을 때만 true.
  const studioOn = formula !== null;

  const projectBar = (
    <ProjectBar
      projects={projects}
      activeId={activeProjectId}
      saveState={saveState}
      onSelect={handleSelectProject}
      onCreate={(input) => void handleCreateProject(input)}
      onLogout={() => void signOut()}
    />
  );

  const studioEntry = !studioOn ? (
    <button className="btn btn-ghost studio-enter" onClick={() => setLoginOpen(true)}>
      {hasSession ? '스튜디오 권한 없음 · 계정 전환' : '스튜디오 로그인'}
    </button>
  ) : null;

  const loginModal = loginOpen ? <LoginPanel onClose={() => setLoginOpen(false)} /> : null;

  if (!buffer || !displayPeaks) {
    return (
      <div className="app">
        {studioOn ? projectBar : null}
        {studioEntry}
        <UploadDropzone onFile={handleFile} onDemo={handleDemo} loading={loading} error={error} />
        {loginModal}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          Waveform Ring Studio
        </div>
        <div className="topbar-file">
          <span className="file-name" title={fileName}>{fileName}</span>
          <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
            파일 변경
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
        </div>
        <nav className="tabs">
          <button className={tab === '3d' ? 'on' : ''} onClick={() => setTab('3d')}>
            3D 렌더
          </button>
          <button className={tab === 'sketch' ? 'on' : ''} onClick={() => setTab('sketch')}>
            2D 도면
          </button>
        </nav>
        <div className="topbar-actions">
          <button
            className="btn btn-primary"
            onClick={() => ring3dRef.current?.exportPNG(`${exportBase}-render.png`)}
          >
            PNG 렌더
          </button>
          <button
            className="btn btn-primary"
            onClick={() => sketchRef.current?.exportSVG(`${exportBase}-sketch.svg`)}
          >
            SVG 도면
          </button>
          {!studioOn ? (
            <button className="btn btn-ghost" onClick={() => setLoginOpen(true)}>
              {hasSession ? '권한 없음' : '스튜디오'}
            </button>
          ) : null}
        </div>
      </header>

      {studioOn ? projectBar : null}

      <div className="wave-wrap">
        <div className="wave-toggle-bar">
          <button
            className="snapshot-toggle"
            onClick={() => setWaveOpen((v) => !v)}
            aria-expanded={waveOpen}
          >
            <span className={`chev ${waveOpen ? 'up' : ''}`}>▾</span>
            파형
            <em>
              {formatTime(sel.start * buffer.duration)} – {formatTime(sel.end * buffer.duration)}{' '}
              선택됨 · {formatTime((sel.end - sel.start) * buffer.duration)}
            </em>
          </button>
        </div>
        {waveOpen ? (
          <WaveformSelector buffer={buffer} peaks={displayPeaks} selection={sel} onChange={setSel} />
        ) : null}
      </div>

      <div className="main">
        <div className="stage">
          <div className={`stage-layer ${tab === '3d' ? '' : 'hidden'}`}>
            <Ring3DView
              ref={ring3dRef}
              amps={amps}
              params={params}
              metal={metal}
              autoRotate={autoRotate}
            />
          </div>
          <div className={`stage-layer scrollable ${tab === 'sketch' ? '' : 'hidden'}`}>
            <RingSketch2D
              ref={sketchRef}
              amps={amps}
              params={params}
              fileName={fileName}
              selStartSec={sel.start * buffer.duration}
              selEndSec={sel.end * buffer.duration}
            />
          </div>
        </div>
        <div className="side">
          <ControlPanel
            params={params}
            onParams={patchParams}
            metal={metal}
            onMetal={setMetal}
            autoRotate={autoRotate}
            onAutoRotate={setAutoRotate}
          />
          {studioOn ? (
          <aside className="panel panel-secondary">
            <FormulaCard
              formula={formula}
              currentParams={params}
              currentMetal={metal}
              onApply={(p, m) => {
                setParams({ ...p });
                setMetal(m);
              }}
              onSaved={setFormula}
            />
          </aside>
          ) : null}
        </div>
      </div>

      {studioOn ? (
      <SnapshotStrip
        snapshots={activeProject?.snapshots ?? []}
        tasteTags={formula?.tasteTags ?? []}
        onSave={handleSaveSnapshot}
        onRestore={handleRestoreSnapshot}
        onToggleFavorite={handleToggleFavorite}
        onToggleTag={handleToggleTag}
        onDelete={handleDeleteSnapshot}
        disabled={!activeProject}
      />
      ) : null}
      {loginModal}
    </div>
  );
}
