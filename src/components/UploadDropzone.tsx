import { useRef, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
  onDemo: () => void;
  loading: boolean;
  error: string | null;
}

export default function UploadDropzone({ onFile, onDemo, loading, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
  };

  return (
    <div className="dropzone-screen">
      <div
        className={`dropzone ${over ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <div className="dropzone-ring" aria-hidden>
          ◌
        </div>
        <h1>Waveform Ring Studio</h1>
        <p>
          mp3 음원을 끌어다 놓으면, 파형으로 반지를 스케치하고 렌더링합니다.
          <br />
          (mp3 · wav · ogg · m4a 지원)
        </p>
        <div className="dropzone-actions">
          <button className="btn btn-primary" disabled={loading}>
            {loading ? '디코딩 중…' : '파일 선택'}
          </button>
          <button
            className="btn btn-ghost"
            disabled={loading}
            onClick={(e) => {
              e.stopPropagation();
              onDemo();
            }}
          >
            데모 사운드로 시작
          </button>
        </div>
        {error && <p className="dropzone-error">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a"
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
