/* ------------------------------------------------------------------ *
 *  jsfeat demo shell
 *
 *  Integrates: sidebar, toolbar, controls panel, profiler, hash routing
 * ------------------------------------------------------------------ */

import type { Demo, DemoEntry } from './lib/demoBase';
import { buildSidebar, setActive } from './ui/sidebar';
import { buildControls } from './ui/controls';
import { Profiler, renderProfiler } from './ui/profiler';
import { buildToolbar } from './ui/toolbar';

// =====================================================================
//  Demo registry  (25 entries, grouped by category)
// =====================================================================

/** Helper: wraps a legacy module (named exports) as a new-style Demo */
function legacyLoader(
  loader: () => Promise<Record<string, unknown>>,
  meta: { title: string; category: string; description: string },
): () => Promise<{ default: Demo }> {
  return async () => {
    const mod = await loader();

    // New-style module already has a default export
    if (mod.default && typeof (mod.default as Demo).process === 'function') {
      return mod as { default: Demo };
    }

    // Wrap legacy named exports
    const legacy = mod as {
      setup(c: HTMLCanvasElement, v: HTMLVideoElement, ctx: CanvasRenderingContext2D): void;
      process(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, w: number, h: number): void;
      cleanup(): void;
    };

    const demo: Demo = {
      ...meta,
      controls: [],
      setup(canvas, video, _params) {
        const ctx = canvas.getContext('2d')!;
        legacy.setup(canvas, video, ctx);
      },
      process(ctx, video, w, h, _profiler) {
        legacy.process(ctx, video, w, h);
      },
      cleanup() {
        legacy.cleanup();
      },
    };

    return { default: demo };
  };
}

function placeholderLoader(
  meta: { title: string; category: string },
): () => Promise<{ default: Demo }> {
  return async () => {
    const mod = await import('./demos/placeholder');
    const ph = mod.default;
    return {
      default: {
        ...ph,
        title: meta.title,
        category: meta.category,
        description: `${meta.title} demo — coming soon.`,
      },
    };
  };
}

const demoRegistry: DemoEntry[] = [
  // ---- Image Processing ----
  {
    id: 'grayscale',
    title: 'Grayscale',
    category: 'Image Processing',
    loader: legacyLoader(() => import('./demos/grayscale'), {
      title: 'Grayscale',
      category: 'Image Processing',
      description: 'Real-time RGB to grayscale conversion.',
    }),
  },
  {
    id: 'boxBlur',
    title: 'Box Blur',
    category: 'Image Processing',
    loader: placeholderLoader({ title: 'Box Blur', category: 'Image Processing' }),
  },
  {
    id: 'gaussianBlur',
    title: 'Gaussian Blur',
    category: 'Image Processing',
    loader: placeholderLoader({ title: 'Gaussian Blur', category: 'Image Processing' }),
  },
  {
    id: 'pyrDown',
    title: 'Pyramid Down',
    category: 'Image Processing',
    loader: placeholderLoader({ title: 'Pyramid Down', category: 'Image Processing' }),
  },
  {
    id: 'equalizeHist',
    title: 'Equalize Histogram',
    category: 'Image Processing',
    loader: placeholderLoader({ title: 'Equalize Histogram', category: 'Image Processing' }),
  },
  {
    id: 'sobel',
    title: 'Sobel',
    category: 'Image Processing',
    loader: placeholderLoader({ title: 'Sobel', category: 'Image Processing' }),
  },
  {
    id: 'scharr',
    title: 'Scharr',
    category: 'Image Processing',
    loader: placeholderLoader({ title: 'Scharr', category: 'Image Processing' }),
  },
  {
    id: 'edges',
    title: 'Canny Edges',
    category: 'Image Processing',
    loader: legacyLoader(() => import('./demos/edges'), {
      title: 'Canny Edges',
      category: 'Image Processing',
      description: 'Canny edge detection with Gaussian pre-blur.',
    }),
  },

  // ---- Feature Detection ----
  {
    id: 'corners',
    title: 'FAST Corners',
    category: 'Feature Detection',
    loader: legacyLoader(() => import('./demos/corners'), {
      title: 'FAST Corners',
      category: 'Feature Detection',
      description: 'FAST corner detection with drawn keypoints.',
    }),
  },
  {
    id: 'yape06',
    title: 'YAPE06',
    category: 'Feature Detection',
    loader: placeholderLoader({ title: 'YAPE06', category: 'Feature Detection' }),
  },
  {
    id: 'yape',
    title: 'YAPE',
    category: 'Feature Detection',
    loader: placeholderLoader({ title: 'YAPE', category: 'Feature Detection' }),
  },
  {
    id: 'orbMatch',
    title: 'ORB Match',
    category: 'Feature Detection',
    loader: legacyLoader(() => import('./demos/orb'), {
      title: 'ORB Features',
      category: 'Feature Detection',
      description: 'ORB descriptor extraction with orientation visualization.',
    }),
  },

  // ---- Face Detection ----
  {
    id: 'faceDetect',
    title: 'Haar Face',
    category: 'Face Detection',
    loader: legacyLoader(() => import('./demos/faceDetect'), {
      title: 'Haar Face Detection',
      category: 'Face Detection',
      description: 'Haar cascade face detection with bounding boxes.',
    }),
  },
  {
    id: 'bbfFace',
    title: 'BBF Face',
    category: 'Face Detection',
    loader: placeholderLoader({ title: 'BBF Face', category: 'Face Detection' }),
  },

  // ---- Motion ----
  {
    id: 'opticalFlow',
    title: 'Optical Flow',
    category: 'Motion',
    loader: legacyLoader(() => import('./demos/opticalFlow'), {
      title: 'Optical Flow',
      category: 'Motion',
      description: 'Lucas-Kanade optical flow with feature tracking.',
    }),
  },
  {
    id: 'videoStab',
    title: 'Video Stabilization',
    category: 'Motion',
    loader: placeholderLoader({ title: 'Video Stabilization', category: 'Motion' }),
  },

  // ---- Transforms ----
  {
    id: 'warpAffine',
    title: 'Warp Affine',
    category: 'Transforms',
    loader: placeholderLoader({ title: 'Warp Affine', category: 'Transforms' }),
  },
  {
    id: 'warpPerspective',
    title: 'Warp Perspective',
    category: 'Transforms',
    loader: placeholderLoader({ title: 'Warp Perspective', category: 'Transforms' }),
  },

  // ---- Extras ----
  {
    id: 'compare',
    title: 'Compare',
    category: 'Extras',
    loader: placeholderLoader({ title: 'Compare', category: 'Extras' }),
  },
  {
    id: 'pipeline',
    title: 'Pipeline',
    category: 'Extras',
    loader: placeholderLoader({ title: 'Pipeline', category: 'Extras' }),
  },
  {
    id: 'touchFlow',
    title: 'Touch Flow',
    category: 'Extras',
    loader: placeholderLoader({ title: 'Touch Flow', category: 'Extras' }),
  },
];

// =====================================================================
//  DOM references
// =====================================================================

const sidebar    = document.getElementById('sidebar')!;
const nav        = document.getElementById('nav')!;
const toolbar    = document.getElementById('toolbar')!;
const canvasArea = document.getElementById('canvas-area')!;
const display    = document.getElementById('display')!;
const canvas     = document.getElementById('canvas') as HTMLCanvasElement;
const video      = document.getElementById('video') as HTMLVideoElement;
const info       = document.getElementById('info')!;
const profilerEl = document.getElementById('profiler')!;
const ctrlPanel  = document.getElementById('controls-panel')!;
const ctrlContainer = document.getElementById('controls')!;
const demoDesc   = document.getElementById('demo-desc')!;
const pageContent = document.getElementById('page-content')!;
const hamburger  = document.getElementById('hamburger')!;
const hamburgerClose = document.getElementById('hamburger-close')!;

let ctx = canvas.getContext('2d')!;

// =====================================================================
//  State
// =====================================================================

let currentDemo: Demo | null = null;
let currentParams: Record<string, unknown> = {};
let animId = 0;
let frozen = false;
let stream: MediaStream | null = null;
let canvasW = 640;
let canvasH = 480;

const profiler = new Profiler();

// =====================================================================
//  Sidebar
// =====================================================================

buildSidebar(nav, demoRegistry, handleNav, [
  { label: 'API Reference', href: '#/api' },
  { label: 'About', href: '#/about' },
]);

// =====================================================================
//  Toolbar
// =====================================================================

const toolbarHandle = buildToolbar(toolbar, {
  onResolution(w, h) {
    canvasW = w;
    canvasH = h;
    canvas.width = w;
    canvas.height = h;
    video.width = w;
    video.height = h;
    ctx = canvas.getContext('2d')!;

    // Restart current demo at new resolution
    if (currentDemo) {
      const demoRef = currentDemo;
      demoRef.cleanup();
      restartWebcam(w, h).then(() => {
        demoRef.setup(canvas, video, currentParams);
      });
    }
  },

  onFreeze(isFrozen) {
    frozen = isFrozen;
    if (!frozen && currentDemo) {
      animationLoop();
    }
  },

  onCapture() {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `jsfeat-capture-${Date.now()}.png`;
    a.click();
  },

  onFullscreen() {
    if (!document.fullscreenElement) {
      display.requestFullscreen().catch(() => { /* user denied */ });
    } else {
      document.exitFullscreen();
    }
  },
});

// =====================================================================
//  Hamburger (mobile)
// =====================================================================

hamburger.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  hamburgerClose.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
});
hamburgerClose.addEventListener('click', () => {
  sidebar.classList.remove('open');
  hamburgerClose.style.display = 'none';
});

// =====================================================================
//  Webcam
// =====================================================================

async function startWebcam(w: number, h: number): Promise<void> {
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: w }, height: { ideal: h }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    info.textContent = 'Webcam access denied. Please allow camera access and reload.';
    throw err;
  }
}

async function restartWebcam(w: number, h: number): Promise<void> {
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
    video.srcObject = null;
  }
  await startWebcam(w, h);
}

// =====================================================================
//  Animation loop
// =====================================================================

function animationLoop(): void {
  if (frozen) return;

  if (currentDemo && video.readyState >= 2) {
    profiler.frameStart();
    currentDemo.process(ctx, video, canvasW, canvasH, profiler);
    profiler.frameEnd();
    renderProfiler(profilerEl, profiler);
  }
  animId = requestAnimationFrame(animationLoop);
}

// =====================================================================
//  Demo switching
// =====================================================================

async function switchDemo(id: string): Promise<void> {
  // Clean up previous
  if (currentDemo) {
    cancelAnimationFrame(animId);
    currentDemo.cleanup();
    currentDemo = null;
    profiler.reset();
  }

  // Reset frozen state
  frozen = false;
  toolbarHandle.setFrozen(false);

  info.textContent = 'Loading...';

  const entry = demoRegistry.find((d) => d.id === id);
  if (!entry) {
    info.textContent = `Unknown demo: ${id}`;
    return;
  }

  // Start webcam
  await startWebcam(canvasW, canvasH);

  // Load module
  const mod = await entry.loader();
  const demo = mod.default;

  // Build controls
  demoDesc.textContent = demo.description || '';
  currentParams = buildControls(ctrlContainer, demo.controls || [], (key, value) => {
    currentParams[key] = value;
    demo.onParamChange?.(key, value);
  });

  // Setup
  demo.setup(canvas, video, currentParams);
  currentDemo = demo;

  info.textContent = demo.title || entry.title;

  // Start loop
  animationLoop();
}

// =====================================================================
//  Page routes  (#/api, #/about)
// =====================================================================

function showPage(route: string): void {
  // Cleanup demo if running
  if (currentDemo) {
    cancelAnimationFrame(animId);
    currentDemo.cleanup();
    currentDemo = null;
    profiler.reset();
  }

  // Hide demo UI, show page
  canvasArea.style.display = 'none';
  profilerEl.style.display = 'none';
  ctrlPanel.style.display = 'none';
  pageContent.style.display = 'block';

  if (route === '#/api') {
    pageContent.innerHTML =
      '<h2>API Reference</h2><p>Full API docs coming soon. See the <a href="https://github.com/nickclaw/jsfeat" style="color:var(--accent)">GitHub repo</a> for source-level documentation.</p>';
  } else if (route === '#/about') {
    pageContent.innerHTML =
      '<h2>About jsfeat</h2><p>jsfeat is a JavaScript/TypeScript computer vision library featuring image processing, feature detection, face detection, optical flow, and geometric transforms.</p>';
  }
}

function showDemoUI(): void {
  canvasArea.style.display = '';
  profilerEl.style.display = '';
  ctrlPanel.style.display = '';
  pageContent.style.display = 'none';
}

// =====================================================================
//  Navigation handler
// =====================================================================

function handleNav(target: string): void {
  // Close mobile sidebar
  sidebar.classList.remove('open');
  hamburgerClose.style.display = 'none';

  if (target === '#/api' || target === '#/about') {
    window.location.hash = target;
    showPage(target);
    return;
  }

  // It's a demo id
  showDemoUI();
  window.location.hash = `/demos/${target}`;
  switchDemo(target);
}

// =====================================================================
//  Hash routing
// =====================================================================

function routeFromHash(): void {
  const hash = window.location.hash;

  if (hash === '#/api' || hash === '#/about') {
    setActive(nav, hash);
    showPage(hash);
    return;
  }

  const match = hash.match(/^#\/demos\/(.+)$/);
  if (match) {
    const id = match[1];
    if (demoRegistry.find((d) => d.id === id)) {
      setActive(nav, id);
      showDemoUI();
      switchDemo(id);
      return;
    }
  }

  // Default: first demo
  const first = demoRegistry[0];
  setActive(nav, first.id);
  showDemoUI();
  switchDemo(first.id);
}

window.addEventListener('hashchange', routeFromHash);

// =====================================================================
//  Boot
// =====================================================================

routeFromHash();
