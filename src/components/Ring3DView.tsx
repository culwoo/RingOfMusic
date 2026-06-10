import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildRingGeometry } from '../lib/ringGeometry';
import { MetalKey, METALS, RingParams } from '../lib/ringMath';
import { downloadDataURL } from '../lib/exporters';

export interface Ring3DHandle {
  exportPNG: (fileName: string) => void;
}

interface Props {
  amps: Float32Array;
  params: RingParams;
  metal: MetalKey;
  autoRotate: boolean;
}

/** three.js 기반 금속 반지 렌더 뷰 */
const Ring3DView = forwardRef<Ring3DHandle, Props>(function Ring3DView(
  { amps, params, metal, autoRotate },
  ref
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  /* ---------- 씬 셋업 (1회) ---------- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141419);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
    camera.position.set(26, 16, 40);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(18, 30, 22);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xaab4ff, 0.35);
    fill.position.set(-20, -10, -16);
    scene.add(fill);

    const material = new THREE.MeshPhysicalMaterial({
      color: METALS.gold.color,
      metalness: 1,
      roughness: 0.22,
      envMapIntensity: 1.1,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.rotation.x = 0.4;
    scene.add(mesh);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotateSpeed = 1.6;
    controls.minDistance = 18;
    controls.maxDistance = 160;

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    meshRef.current = mesh;
    controlsRef.current = controls;

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      mesh.geometry.dispose();
      material.dispose();
      pmrem.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      rendererRef.current = null;
    };
  }, []);

  /* ---------- 지오메트리 갱신 ---------- */
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || amps.length === 0) return;
    const next = buildRingGeometry(amps, params);
    const old = mesh.geometry;
    mesh.geometry = next;
    old.dispose();
  }, [amps, params]);

  /* ---------- 재질 / 회전 ---------- */
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    (mesh.material as THREE.MeshPhysicalMaterial).color.setHex(METALS[metal].color);
  }, [metal]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  /* ---------- PNG 내보내기 ---------- */
  useImperativeHandle(ref, () => ({
    exportPNG: (fileName: string) => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return;
      renderer.render(scene, camera); // 같은 틱에서 렌더 직후 캡처
      downloadDataURL(renderer.domElement.toDataURL('image/png'), fileName);
    },
  }));

  return <div ref={mountRef} className="view-3d" />;
});

export default Ring3DView;
