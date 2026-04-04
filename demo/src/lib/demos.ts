/**
 * Demo registry -- defines all individual demos with their controls and processing logic.
 *
 * Each demo is a self-contained unit: setup, per-frame process, param change handler, and cleanup.
 */

import type { StageControl } from '@/lib/stages';
import { Matrix, Keypoint, U8C1 } from 'jsfeat/core';
import { grayscale as jfGrayscale, gaussianBlur, cannyEdges } from 'jsfeat/imgproc';
import { fastCorners } from 'jsfeat/features';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DemoDefinition {
  id: string;
  title: string;
  category: string;
  description: string;
  controls: StageControl[];
  /** Called once when the demo is mounted. */
  setup: (
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    params: Record<string, any>,
  ) => void;
  /** Called each animation frame. */
  process: (
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: { start: (n: string) => void; end: (n: string) => void },
  ) => void;
  /** Called when a control value changes. */
  onParamChange?: (key: string, value: any) => void;
  /** Called when the demo is unmounted. */
  cleanup: () => void;
}

// ---------------------------------------------------------------------------
// Shared state for working demos (module-level to survive re-renders)
// ---------------------------------------------------------------------------

let _gray: Matrix | null = null;
let _blurred: Matrix | null = null;
let _edges: Matrix | null = null;
let _corners: Keypoint[] = [];

// Current params for process callbacks
let _currentParams: Record<string, any> = {};

function ensureGray(w: number, h: number): Matrix {
  if (!_gray || _gray.cols !== w || _gray.rows !== h) {
    _gray = new Matrix(w, h, U8C1);
  }
  return _gray;
}

function ensureBlurred(w: number, h: number): Matrix {
  if (!_blurred || _blurred.cols !== w || _blurred.rows !== h) {
    _blurred = new Matrix(w, h, U8C1);
  }
  return _blurred;
}

function ensureEdges(w: number, h: number): Matrix {
  if (!_edges || _edges.cols !== w || _edges.rows !== h) {
    _edges = new Matrix(w, h, U8C1);
  }
  return _edges;
}

function ensureCorners(maxCount: number): Keypoint[] {
  while (_corners.length < maxCount) {
    _corners.push(new Keypoint());
  }
  return _corners;
}

/** Write grayscale matrix into RGBA ImageData. */
function grayToImageData(gray: Matrix, imageData: ImageData, w: number, h: number) {
  const src = gray.data;
  const dst = imageData.data;
  const sw = Math.min(w, gray.cols);
  const sh = Math.min(h, gray.rows);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const v = src[y * gray.cols + x];
      const di = (y * w + x) * 4;
      dst[di] = v;
      dst[di + 1] = v;
      dst[di + 2] = v;
      dst[di + 3] = 255;
    }
  }
}

// ---------------------------------------------------------------------------
// Working demo definitions
// ---------------------------------------------------------------------------

const grayscaleDemo: DemoDefinition = {
  id: 'grayscale',
  title: 'Grayscale',
  category: 'Image Processing',
  description: 'Convert webcam feed to grayscale using luminance weighting.',
  controls: [],
  setup(_canvas, _video, params) {
    _currentParams = { ...params };
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    grayToImageData(gray, imageData, w, h);
    ctx.putImageData(imageData, 0, 0);
  },
  cleanup() {
    _gray = null;
  },
};

const cannyEdgesDemo: DemoDefinition = {
  id: 'cannyEdges',
  title: 'Canny Edges',
  category: 'Image Processing',
  description: 'Real-time Canny edge detection with adjustable thresholds and blur kernel.',
  controls: [
    { type: 'slider', key: 'low', label: 'Low Thresh', min: 1, max: 127, step: 1, defaultNum: 30 },
    { type: 'slider', key: 'high', label: 'High Thresh', min: 1, max: 255, step: 1, defaultNum: 80 },
    { type: 'slider', key: 'kernelSize', label: 'Blur Kernel', min: 3, max: 15, step: 2, defaultNum: 5 },
  ],
  setup(_canvas, _video, params) {
    _currentParams = { low: 30, high: 80, kernelSize: 5, ...params };
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    const blurred = ensureBlurred(w, h);
    profiler.start('blur');
    let ks = _currentParams.kernelSize ?? 5;
    if (ks % 2 === 0) ks += 1;
    gaussianBlur(gray, blurred, ks, 0);
    profiler.end('blur');

    const edges = ensureEdges(w, h);
    profiler.start('canny');
    cannyEdges(blurred, edges, _currentParams.low ?? 30, _currentParams.high ?? 80);
    profiler.end('canny');

    grayToImageData(edges, imageData, w, h);
    ctx.putImageData(imageData, 0, 0);
  },
  onParamChange(key, value) {
    _currentParams[key] = value;
  },
  cleanup() {
    _gray = null;
    _blurred = null;
    _edges = null;
  },
};

const fastCornersDemo: DemoDefinition = {
  id: 'fastCorners',
  title: 'FAST Corners',
  category: 'Feature Detection',
  description: 'FAST-16 corner detector with adjustable threshold and border exclusion.',
  controls: [
    { type: 'slider', key: 'threshold', label: 'Threshold', min: 5, max: 100, step: 1, defaultNum: 20 },
    { type: 'slider', key: 'border', label: 'Border', min: 1, max: 10, step: 1, defaultNum: 3 },
  ],
  setup(_canvas, _video, params) {
    _currentParams = { threshold: 20, border: 3, ...params };
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    profiler.start('FAST corners');
    const corners = ensureCorners(w * h);
    const count = fastCorners(
      gray,
      corners,
      _currentParams.threshold ?? 20,
      _currentParams.border ?? 3,
    );
    profiler.end('FAST corners');

    // Draw overlay
    ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
    for (let i = 0; i < count; i++) {
      const kp = corners[i];
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  onParamChange(key, value) {
    _currentParams[key] = value;
  },
  cleanup() {
    _gray = null;
    _corners = [];
  },
};

// ---------------------------------------------------------------------------
// Placeholder demos (filled in Task 7)
// ---------------------------------------------------------------------------

function placeholder(
  id: string,
  title: string,
  category: string,
  description: string,
): DemoDefinition {
  return {
    id,
    title,
    category,
    description,
    controls: [],
    setup() {},
    process(ctx, _video, w, h) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#888';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Coming soon', w / 2, h / 2);
    },
    cleanup() {},
  };
}

// ---------------------------------------------------------------------------
// Full list of demos
// ---------------------------------------------------------------------------

const allDemos: DemoDefinition[] = [
  // Working
  grayscaleDemo,
  cannyEdgesDemo,
  fastCornersDemo,

  // Placeholders
  placeholder('boxBlur', 'Box Blur', 'Image Processing', 'Box blur filter with adjustable radius.'),
  placeholder('gaussianBlur', 'Gaussian Blur', 'Image Processing', 'Gaussian blur with kernel size and sigma controls.'),
  placeholder('equalizeHist', 'Histogram Equalization', 'Image Processing', 'Adaptive histogram equalization for contrast enhancement.'),
  placeholder('pyrDown', 'Pyramid Down', 'Image Processing', 'Multi-level image pyramid downsampling.'),
  placeholder('sobel', 'Sobel Derivatives', 'Edge Detection', 'Sobel edge detection showing dx/dy gradients.'),
  placeholder('scharr', 'Scharr Derivatives', 'Edge Detection', 'Scharr operator for more accurate edge gradients.'),
  placeholder('yape06', 'YAPE06', 'Feature Detection', 'YAPE06 keypoint detector with Laplacian and eigen thresholds.'),
  placeholder('orbDescriptors', 'ORB Descriptors', 'Feature Detection', 'ORB feature descriptors with oriented FAST and BRIEF.'),
  placeholder('haarFace', 'Haar Face Detection', 'Detection', 'Real-time face detection using Haar cascade classifier.'),
  placeholder('bbfFace', 'BBF Face Detection', 'Detection', 'Brightness Binary Feature face detection.'),
  placeholder('opticalFlowLK', 'Optical Flow (LK)', 'Motion', 'Lucas-Kanade sparse optical flow tracking.'),
  placeholder('motionEstimation', 'Motion Estimation', 'Motion', 'Affine motion estimation between frames.'),
  placeholder('warpAffine', 'Affine Warp', 'Transform', 'Real-time affine image warping.'),
  placeholder('homography', 'Homography', 'Transform', 'Perspective transform via homography estimation.'),
];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const demoRegistry = new Map<string, DemoDefinition>(
  allDemos.map((d) => [d.id, d]),
);

/** Demos grouped by category, preserving definition order. */
export const demoCategories = (() => {
  const map = new Map<string, DemoDefinition[]>();
  for (const d of allDemos) {
    const arr = map.get(d.category) ?? [];
    arr.push(d);
    map.set(d.category, arr);
  }
  return map;
})();

/** Flat list for grid display. */
export const demoList = allDemos;
