import { useEffect, useRef } from "react";
import type * as ThreeModule from "three";
import type { RoomEnvironment as RoomEnvironmentClass } from "three/addons/environments/RoomEnvironment.js";

export type Three = typeof ThreeModule;

export interface SceneContext {
  THREE: Three;
  scene: ThreeModule.Scene;
  pointer: { x: number; y: number };
  redraw: () => void;
}

export interface SceneHandle {
  camera: ThreeModule.PerspectiveCamera;
  stillFrameAt: number;
  frame: (dt: number, t: number) => void;
  resize: (aspect: number) => void;
  dispose: () => void;
}

export type SceneSetup = (ctx: SceneContext) => SceneHandle;

export function useThreeCanvas(setup: SceneSetup, isPaused: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(isPaused);
  const sceneRef = useRef<RunningScene | null>(null);
  useEffect(() => {
    isPausedRef.current = isPaused;
    sceneRef.current?.setPaused(isPaused);
  }, [isPaused]);
  useEffect(() => {
    let running: RunningScene | null = null,
      cancelled = false;
    Promise.all([import("three"), import("three/addons/environments/RoomEnvironment.js")]).then(
      ([THREE, { RoomEnvironment }]) => {
        const host = ref.current;
        if (cancelled || !host) return;
        running = run(THREE, RoomEnvironment, { host, setup, startsPaused: isPausedRef.current });
        sceneRef.current = running;
      },
    );
    return () => {
      cancelled = true;
      running?.stop();
      sceneRef.current = null;
    };
  }, [setup]);
  return ref;
}

interface RunningScene {
  stop: () => void;
  setPaused: (isPaused: boolean) => void;
}

interface RunOptions {
  host: HTMLElement;
  setup: SceneSetup;
  startsPaused: boolean;
}

const WITHOUT_WEBGL: RunningScene = { stop: () => {}, setPaused: () => {} };

function run(
  THREE: Three,
  RoomEnvironment: typeof RoomEnvironmentClass,
  { host, setup, startsPaused }: RunOptions,
): RunningScene {
  let renderer: ThreeModule.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return WITHOUT_WEBGL;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block" });
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;

  const pointer = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => {
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = e.clientY / window.innerHeight - 0.5;
  };
  window.addEventListener("pointermove", onMove);

  const ctx: SceneContext = { THREE, scene, pointer, redraw: () => {} };
  const s = setup(ctx);

  let elapsed = startsPaused ? s.stillFrameAt : 0,
    raf = 0,
    visible = true,
    isPaused = startsPaused;
  const clock = new THREE.Clock();
  const draw = (dt: number) => {
    elapsed += dt;
    s.frame(dt, elapsed);
    renderer.render(scene, s.camera);
  };
  ctx.redraw = () => draw(0);
  const loop = () => {
    raf = visible && !isPaused ? requestAnimationFrame(loop) : 0;
    draw(Math.min(clock.getDelta(), 0.05));
  };
  const start = () => {
    if (visible && !isPaused && !raf) {
      clock.getDelta();
      loop();
    }
  };

  const resize = () => {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    s.camera.aspect = w / h;
    s.resize(w / h);
    s.camera.updateProjectionMatrix();
    draw(0);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const pauseWhenOffscreen = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    start();
  });
  pauseWhenOffscreen.observe(host);
  resize();
  start();

  const setPaused = (next: boolean) => {
    isPaused = next;
    if (!isPaused) start();
    else {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    pauseWhenOffscreen.disconnect();
    window.removeEventListener("pointermove", onMove);
    s.dispose();
    [env, pmrem, renderer].forEach((x) => x.dispose());
    renderer.domElement.remove();
  };
  return { stop, setPaused };
}

export function itemAt<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new RangeError(`Índice ${index} fora da lista de ${list.length} itens.`);
  return item;
}
