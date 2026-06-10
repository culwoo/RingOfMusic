# Waveform Ring Studio

mp3 음원을 올리고 파형 구간을 선택하면, 그 파형으로 반지를 스케치(2D 제작 도면)하고 렌더링(3D 금속 렌더)하는 디자이너용 웹서비스입니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드 (dist/)
npm run preview  # 빌드 결과 로컬 확인
```

## 기능

- **오디오 업로드** — mp3 · wav · ogg · m4a 드래그&드롭, 데모 사운드 내장
- **구간 선택** — 파형 위 드래그로 부분 선택, 경계 핸들 조정, 더블클릭 전체 선택, 선택 구간 미리듣기
- **매핑 모드 2종 (전환 가능)**
  - 실루엣: 반지 외곽 자체가 파형으로 출렁이는 형태
  - 표면 각인: 일정한 밴드 표면에 파형을 음각/양각
- **3D 렌더** — three.js 금속 PBR 재질(골드/실버/로즈골드), 궤도 카메라, 자동 회전
- **2D 도면** — 정면도 + 전개도(각인 아트워크/측면 프로파일) + 치수선 + 타이틀 블록, 실치수(mm) 기반
- **파라미터** — 내경(호수), 밴드 폭, 두께, 파형 높이, 각인 깊이, 스무딩, 샘플 수
- **내보내기** — 3D 렌더 PNG, 제작용 SVG 도면

## 구조

```
src/
  lib/
    audio.ts         # 디코딩, 피크 추출, 원형 스무딩, 정규화, 데모 사운드
    ringMath.ts      # 파라미터 정의, 매핑 공통 수학
    ringGeometry.ts  # 파형 → three.js BufferGeometry (실루엣/각인)
    exporters.ts     # PNG/SVG 다운로드
  components/
    UploadDropzone.tsx    # 업로드 화면
    WaveformSelector.tsx  # 파형 표시 + 구간 선택 + 미리듣기
    Ring3DView.tsx        # three.js 렌더 뷰
    RingSketch2D.tsx      # SVG 제작 도면
    ControlPanel.tsx      # 파라미터 패널
  App.tsx
```

## 기술 노트

- **파형 파이프라인**: Web Audio `decodeAudioData` → 구간별 피크 추출(전 채널 절대값 최대, stride 샘플링) → 원형(wrap-around) 박스 스무딩 2회(링 이음새가 매끄럽게 이어지도록) → 최댓값 정규화.
- **지오메트리**: 둘레를 모듈로 인덱스로 연결한 파라메트릭 표면(안쪽 원통·바깥 면·양 측벽)을 하나의 BufferGeometry로 합성. 단위는 mm.
- **각인 모드**: 밴드 폭 방향 smoothstep 창 함수로 가운데 띠에만 파형 변위를 적용. 깊이 부호로 음각/양각 전환.
- **SVG 도면**: 1mm = 9px 실치수. 전개도 길이는 기준원 둘레(π·D)로 계산하며, 폭을 넘으면 길이만 축척 표기.

## 브라우저 지원

최신 Chrome / Edge / Safari / Firefox. (Web Audio API, WebGL2, `new AudioBuffer()` 필요)
