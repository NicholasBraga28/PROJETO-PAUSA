import type { Mesh, MeshStandardMaterial, Vector3 } from "three";
import { itemAt, useThreeCanvas, type SceneContext, type SceneHandle } from "./three-canvas";

interface LogoWireProps {
  className?: string;
  isPaused: boolean;
}

export default function LogoWire({ className, isPaused }: LogoWireProps) {
  const ref = useThreeCanvas(setupLogo, isPaused);
  return <div ref={ref} className={className} aria-hidden="true" />;
}

const OUTLINE_PX_ON_200_ART: [number, number][] = [
  [68, 52],
  [132, 52],
  [156, 77],
  [100, 146],
  [44, 77],
];
const CHORDS_AS_PERIMETER_FRACTIONS: [number, number][] = [
  [0.055, 0.48],
  [0.15, 0.72],
  [0.889, 0.4],
  [0.95, 0.58],
  [0.26, 0.8],
  [0.1, 0.84],
];
const LOGO_WIDTH_IN_SCENE_UNITS = 2.24;
const LOGO_TOP_ABOVE_CENTER = 0.94;
const LAYER_HALF_DEPTH = 0.07;
const OUTLINE_RADIUS_PER_VIEW_HEIGHT = 0.0034,
  CHORD_RADIUS_PER_VIEW_HEIGHT = 0.0021;
const CHORD_SWAY_ALONG_PERIMETER = 0.045;
const REVEAL_SECONDS = 2.6;
const LOGO_TOP_SCREEN_FRACTION = 0.42;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function setupLogo(ctx: SceneContext): SceneHandle {
  const { THREE, scene, pointer } = ctx;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const viewH = 2 * 10 * Math.tan(THREE.MathUtils.degToRad(15));

  const pts = OUTLINE_PX_ON_200_ART.map(([x, y]) => new THREE.Vector2((x - 100) / 50, (99 - y) / 50));
  const lens = pts.map((p, i) => p.distanceTo(itemAt(pts, (i + 1) % pts.length)));
  const total = lens.reduce((a, b) => a + b);
  const tmp2 = new THREE.Vector2();
  const pointAlongPerimeter = (t: number) => {
    let d = (((t % 1) + 1) % 1) * total;
    for (let i = 0; i < pts.length; i++) {
      const len = itemAt(lens, i);
      if (d <= len) return tmp2.lerpVectors(itemAt(pts, i), itemAt(pts, (i + 1) % pts.length), d / len);
      d -= len;
    }
    return tmp2.copy(itemAt(pts, 0));
  };

  const barGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
  const jointGeo = new THREE.SphereGeometry(1, 16, 10);
  const frontMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.7, metalness: 0.2, roughness: 0.4 });
  const backMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.45 });

  const cssToken = (name: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const applyTheme = () => {
    frontMat.color.set(cssToken("--logo-front", "#cbbaff"));
    frontMat.emissive.set(cssToken("--logo-front-glow", "#a07bf6"));
    backMat.color.set(cssToken("--logo-back", "#7a46d8"));
    backMat.emissive.set(cssToken("--logo-back-glow", "#5a179a"));
  };
  const onTheme = () => {
    applyTheme();
    ctx.redraw();
  };
  applyTheme();
  const mo = new MutationObserver(onTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mqs = ["(prefers-color-scheme: dark)", "(prefers-contrast: more)"].map((q) => window.matchMedia(q));
  mqs.forEach((m) => m.addEventListener("change", onTheme));
  const logo = new THREE.Group();
  scene.add(logo);
  const bar = (mat: MeshStandardMaterial) => {
    const m = new THREE.Mesh(barGeo, mat);
    logo.add(m);
    return m;
  };
  const joint = (mat: MeshStandardMaterial) => {
    const m = new THREE.Mesh(jointGeo, mat);
    logo.add(m);
    return m;
  };

  const UP = new THREE.Vector3(0, 1, 0),
    dir = new THREE.Vector3(),
    a = new THREE.Vector3(),
    b = new THREE.Vector3();
  function placeBarDrawnUpTo(m: Mesh, p: Vector3, q: Vector3, r: number, k: number) {
    dir.subVectors(q, p).multiplyScalar(k);
    const len = dir.length();
    m.visible = len > 1e-4;
    if (!m.visible) return;
    m.position.copy(p).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
    m.scale.set(r, len, r);
  }

  const layers = [
    { z: LAYER_HALF_DEPTH, mat: frontMat, phase: 0 },
    { z: -LAYER_HALF_DEPTH, mat: backMat, phase: 2.1 },
  ].map((L) => ({
    ...L,
    edges: pts.map(() => bar(L.mat)),
    joints: pts.map(() => joint(L.mat)),
    chords: CHORDS_AS_PERIMETER_FRACTIONS.map(() => bar(L.mat)),
  }));
  const links = pts.map(() => bar(backMat));

  scene.add(new THREE.AmbientLight(0x2a0e4a, 0.8));
  const key = new THREE.PointLight(0xcbbaff, 60, 30);
  scene.add(key);

  let ry = 0,
    rx = 0,
    rOut = OUTLINE_RADIUS_PER_VIEW_HEIGHT,
    rIn = CHORD_RADIUS_PER_VIEW_HEIGHT;
  return {
    camera,
    stillFrameAt: REVEAL_SECONDS,
    resize(aspect) {
      const s = (1.25 * viewH * aspect) / LOGO_WIDTH_IN_SCENE_UNITS;
      logo.scale.setScalar(s);
      logo.position.y = viewH * (0.5 - LOGO_TOP_SCREEN_FRACTION) - LOGO_TOP_ABOVE_CENTER * s;
      rOut = (OUTLINE_RADIUS_PER_VIEW_HEIGHT * viewH) / s;
      rIn = (CHORD_RADIUS_PER_VIEW_HEIGHT * viewH) / s;
    },
    frame(_dt, t) {
      const P = 1 - (1 - clamp01(t / REVEAL_SECONDS)) ** 3;

      for (const L of layers) {
        pts.forEach((p, i) => {
          const k = clamp01((P - i * 0.06) / 0.55);
          a.set(p.x, p.y, L.z);
          const q = itemAt(pts, (i + 1) % pts.length);
          placeBarDrawnUpTo(itemAt(L.edges, i), a, b.set(q.x, q.y, L.z), rOut, k);
          const jointMesh = itemAt(L.joints, i);
          jointMesh.visible = k > 0;
          jointMesh.position.copy(a);
          jointMesh.scale.setScalar(rOut * clamp01(k * 3));
        });
        CHORDS_AS_PERIMETER_FRACTIONS.forEach(([ta, tb], j) => {
          const k = clamp01((P - 0.35 - j * 0.05) / 0.45);
          const wa = CHORD_SWAY_ALONG_PERIMETER * Math.sin(t * 0.35 + j * 1.7 + L.phase);
          const wb = CHORD_SWAY_ALONG_PERIMETER * Math.sin(t * 0.27 + j * 2.3 + 1 + L.phase);
          const pa = pointAlongPerimeter(ta + wa);
          a.set(pa.x, pa.y, L.z);
          const pb = pointAlongPerimeter(tb + wb);
          b.set(pb.x, pb.y, L.z);
          placeBarDrawnUpTo(itemAt(L.chords, j), a, b, rIn, k);
        });
      }
      const kl = clamp01((P - 0.3) / 0.4);
      pts.forEach((p, i) =>
        placeBarDrawnUpTo(
          itemAt(links, i),
          a.set(p.x, p.y, LAYER_HALF_DEPTH),
          b.set(p.x, p.y, -LAYER_HALF_DEPTH),
          rIn,
          kl,
        ),
      );

      ry += (Math.sin(t * 0.16) * 0.55 + pointer.x * 0.15 - ry) * 0.05;
      rx += (-0.12 + pointer.y * 0.08 - rx) * 0.05;
      logo.rotation.set(rx, ry, 0);
      key.position.set(Math.cos(t * 0.4) * 6, 2, 6);
    },
    dispose() {
      mo.disconnect();
      mqs.forEach((m) => m.removeEventListener("change", onTheme));
      [barGeo, jointGeo, frontMat, backMat].forEach((x) => x.dispose());
    },
  };
}
