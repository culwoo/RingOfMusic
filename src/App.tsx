import { useMemo, useRef, useState } from 'react';
import UploadDropzone from './components/UploadDropzone';
import WaveformSelector, { Selection } from './components/WaveformSelector';
import ControlPanel from './components/ControlPanel';
import Ring3DView, { Ring3DHandle } from './components/Ring3DView';
import RingSketch2D, { SketchHandle } from './components/RingSketch2D';
import { buildRingAmps, decodeAudioFile, extractPeaks, generateDemoBuffer, normalize } from './lib/audio';
import { DEFAULT_PARAMS, MetalKey, RingParams } from './lib/ringMath';

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

  const ring3dRef = useRef<Ring3DHandle>(null);
  const sketchRef = useRef<SketchHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBuffer = (buf: AudioBuffer, name: string) => {
    setBuffer(buf);
    setFileName(name);
    setDisplayPeaks(normalize(extractPeaks(buf, 1600)));
    setSel({ start: 0, end: 1 });
    setError(null);
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const buf = await decodeAudioFile(file);
      loadBuffer(buf, file.name);
    } catch {
      setError('오디오 디코딩에 실패했습니다. 다른 파일을 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => loadBuffer(generateDemoBuffer(), '데모 사운드');

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

  if (!buffer || !displayPeaks) {
    return (
      <UploadDropzone onFile={handleFile} onDemo={handleDemo} loading={loading} error={error} />
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
        </div>
      </header>

      <WaveformSelector buffer={buffer} peaks={displayPeaks} selection={sel} onChange={setSel} />

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
        <ControlPanel
          params={params}
          onParams={patchParams}
          metal={metal}
          onMetal={setMetal}
          autoRotate={autoRotate}
          onAutoRotate={setAutoRotate}
        />
      </div>
    </div>
  );
}
