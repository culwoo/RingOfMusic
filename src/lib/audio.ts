/**
 * 오디오 디코딩 + 파형 피크 추출 파이프라인
 */

/** mp3/wav/ogg 등 오디오 파일을 AudioBuffer로 디코딩 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  try {
    return await ctx.decodeAudioData(data);
  } finally {
    void ctx.close();
  }
}

/**
 * 버퍼의 [startFrac, endFrac) 구간을 buckets개의 피크(0..1 정규화 전)로 추출.
 * 모든 채널의 절대값 최대를 사용. 큰 파일은 stride 샘플링으로 속도 확보.
 */
export function extractPeaks(
  buffer: AudioBuffer,
  buckets: number,
  startFrac = 0,
  endFrac = 1
): Float32Array {
  const total = buffer.length;
  const start = Math.max(0, Math.min(total - 1, Math.floor(startFrac * total)));
  const end = Math.max(start + 1, Math.min(total, Math.ceil(endFrac * total)));
  const len = end - start;

  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));

  const peaks = new Float32Array(buckets);
  for (let b = 0; b < buckets; b++) {
    const s = start + Math.floor((b / buckets) * len);
    const e = Math.max(s + 1, start + Math.floor(((b + 1) / buckets) * len));
    const stride = Math.max(1, Math.floor((e - s) / 600));
    let m = 0;
    for (const ch of channels) {
      for (let i = s; i < e; i += stride) {
        const v = Math.abs(ch[i]);
        if (v > m) m = v;
      }
    }
    peaks[b] = m;
  }
  return peaks;
}

/** 최댓값 기준 0..1 정규화 (무음이면 0 유지) */
export function normalize(data: Float32Array): Float32Array {
  let max = 0;
  for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
  const out = new Float32Array(data.length);
  if (max < 1e-8) return out;
  for (let i = 0; i < data.length; i++) out[i] = data[i] / max;
  return out;
}

/** 링 위에서 이음새가 자연스럽도록 원형(wrap-around) 박스 스무딩 2회 적용 */
export function circularSmooth(data: Float32Array, win: number): Float32Array {
  if (win <= 0) return Float32Array.from(data);
  const pass = (a: Float32Array): Float32Array => {
    const n = a.length;
    const out = new Float32Array(n);
    const k = 2 * win + 1;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = -win; j <= win; j++) sum += a[(i + j + n) % n];
      out[i] = sum / k;
    }
    return out;
  };
  return pass(pass(data));
}

/** 링 파형 생성 파이프라인: 추출 → 스무딩 → 정규화 */
export function buildRingAmps(
  buffer: AudioBuffer,
  samples: number,
  smoothing: number,
  startFrac: number,
  endFrac: number
): Float32Array {
  const raw = extractPeaks(buffer, samples, startFrac, endFrac);
  const smoothed = circularSmooth(raw, smoothing);
  return normalize(smoothed);
}

/** 데모용 합성 사운드 (음성 느낌의 진폭 변화를 가진 노이즈) */
export function generateDemoBuffer(): AudioBuffer {
  const sampleRate = 44100;
  const seconds = 5;
  const n = sampleRate * seconds;
  const buf = new AudioBuffer({ length: n, sampleRate, numberOfChannels: 1 });
  const data = buf.getChannelData(0);
  let env = 0;
  let target = 0.5;
  for (let i = 0; i < n; i++) {
    if (i % 2205 === 0) target = Math.random() < 0.2 ? 0 : Math.random();
    env += (target - env) * 0.001;
    const tremor = 0.65 + 0.35 * Math.sin(i * 0.00073) * Math.sin(i * 0.000131);
    data[i] = (Math.random() * 2 - 1) * env * tremor * 0.8;
  }
  return buf;
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
