import { buildSidebar, setActive } from './ui/sidebar';
import type { DemoEntry } from './ui/sidebar';

// Lazy-loaded demo modules
type DemoModule = {
  setup(canvas: HTMLCanvasElement, video: HTMLVideoElement, ctx: CanvasRenderingContext2D): void;
  process(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, w: number, h: number): void;
  cleanup(): void;
};

const demos: DemoEntry[] = [
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'edges', label: 'Canny Edges' },
  { id: 'corners', label: 'FAST Corners' },
  { id: 'faceDetect', label: 'Face Detection' },
  { id: 'opticalFlow', label: 'Optical Flow' },
  { id: 'orb', label: 'ORB Features' },
];

const loaders: Record<string, () => Promise<DemoModule>> = {
  grayscale: () => import('./demos/grayscale'),
  edges: () => import('./demos/edges'),
  corners: () => import('./demos/corners'),
  faceDetect: () => import('./demos/faceDetect'),
  opticalFlow: () => import('./demos/opticalFlow'),
  orb: () => import('./demos/orb'),
};

let currentDemo: DemoModule | null = null;
let animId = 0;
let stream: MediaStream | null = null;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const video = document.getElementById('video') as HTMLVideoElement;
const ctx = canvas.getContext('2d')!;
const nav = document.getElementById('nav')!;
const info = document.getElementById('info')!;
const fpsEl = document.getElementById('fps')!;

const W = canvas.width;
const H = canvas.height;

// FPS tracking
let lastTime = performance.now();
let frameCount = 0;
let fps = 0;

function updateFps(): void {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastTime = now;
    fpsEl.textContent = `${fps} FPS`;
  }
}

function animationLoop(): void {
  if (currentDemo && video.readyState >= 2) {
    currentDemo.process(ctx, video, W, H);
    updateFps();
  }
  animId = requestAnimationFrame(animationLoop);
}

async function startWebcam(): Promise<void> {
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: W }, height: { ideal: H }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    info.textContent = 'Webcam access denied. Please allow camera access and reload.';
    throw err;
  }
}

async function switchDemo(id: string): Promise<void> {
  // Cleanup previous
  if (currentDemo) {
    cancelAnimationFrame(animId);
    currentDemo.cleanup();
    currentDemo = null;
  }

  info.textContent = 'Loading...';

  // Start webcam if needed
  await startWebcam();

  // Load demo module
  const loader = loaders[id];
  if (!loader) {
    info.textContent = `Unknown demo: ${id}`;
    return;
  }

  const mod = await loader();
  mod.setup(canvas, video, ctx);
  currentDemo = mod;

  info.textContent = demos.find((d) => d.id === id)?.label ?? id;

  // Reset FPS
  lastTime = performance.now();
  frameCount = 0;
  fpsEl.textContent = '';

  // Start loop
  animationLoop();
}

// Build sidebar and wire up navigation
buildSidebar(nav, demos, switchDemo);

// Handle initial hash
const initialHash = window.location.hash.slice(1);
if (initialHash && loaders[initialHash]) {
  setActive(nav, initialHash);
  switchDemo(initialHash);
} else {
  // Auto-select first demo
  setActive(nav, demos[0].id);
  switchDemo(demos[0].id);
}
