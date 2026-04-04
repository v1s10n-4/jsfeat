/**
 * Demo registry -- defines all individual demos with their controls and processing logic.
 *
 * Each demo is a self-contained unit: setup, per-frame process, param change handler, and cleanup.
 */

import type { StageControl } from '@/lib/stages';
import { Matrix, Keypoint, Pyramid, U8C1, S32C2, F32C1 } from 'jsfeat/core';
import {
  grayscale as jfGrayscale,
  boxBlurGray,
  gaussianBlur,
  pyrDown,
  equalizeHistogram,
  cannyEdges,
  sobelDerivatives,
  scharrDerivatives,
  warpAffine,
} from 'jsfeat/imgproc';
import { fastCorners, yape06Detect, orbDescribe } from 'jsfeat/features';
import { lucasKanade } from 'jsfeat/flow';
import { ransac, createRansacParams, homography2d, affine2d } from 'jsfeat/motion';

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
// Box Blur
// ---------------------------------------------------------------------------

let _boxDst: Matrix | null = null;
let _boxParams: Record<string, any> = {};

const boxBlurDemo: DemoDefinition = {
  id: 'boxBlur',
  title: 'Box Blur',
  category: 'Image Processing',
  description: 'Box blur filter with adjustable radius.',
  controls: [
    { type: 'slider', key: 'radius', label: 'Radius', min: 1, max: 20, step: 1, defaultNum: 4 },
  ],
  setup(_canvas, _video, params) {
    _boxParams = { radius: 4, ...params };
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    if (!_boxDst || _boxDst.cols !== w || _boxDst.rows !== h) {
      _boxDst = new Matrix(w, h, U8C1);
    }

    profiler.start('boxBlur');
    boxBlurGray(gray, _boxDst, _boxParams.radius ?? 4);
    profiler.end('boxBlur');

    grayToImageData(_boxDst, imageData, w, h);
    ctx.putImageData(imageData, 0, 0);
  },
  onParamChange(key, value) {
    _boxParams[key] = value;
  },
  cleanup() {
    _gray = null;
    _boxDst = null;
  },
};

// ---------------------------------------------------------------------------
// Gaussian Blur (standalone demo)
// ---------------------------------------------------------------------------

let _gaussDst: Matrix | null = null;
let _gaussParams: Record<string, any> = {};

const gaussianBlurDemo: DemoDefinition = {
  id: 'gaussianBlur',
  title: 'Gaussian Blur',
  category: 'Image Processing',
  description: 'Gaussian blur with kernel size and sigma controls.',
  controls: [
    { type: 'slider', key: 'kernelSize', label: 'Kernel Size', min: 3, max: 15, step: 2, defaultNum: 5 },
    { type: 'slider', key: 'sigma', label: 'Sigma', min: 0, max: 10, step: 0.5, defaultNum: 0 },
  ],
  setup(_canvas, _video, params) {
    _gaussParams = { kernelSize: 5, sigma: 0, ...params };
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    if (!_gaussDst || _gaussDst.cols !== w || _gaussDst.rows !== h) {
      _gaussDst = new Matrix(w, h, U8C1);
    }

    profiler.start('gaussianBlur');
    let ks = _gaussParams.kernelSize ?? 5;
    if (ks % 2 === 0) ks += 1;
    gaussianBlur(gray, _gaussDst, ks, _gaussParams.sigma ?? 0);
    profiler.end('gaussianBlur');

    grayToImageData(_gaussDst, imageData, w, h);
    ctx.putImageData(imageData, 0, 0);
  },
  onParamChange(key, value) {
    _gaussParams[key] = value;
  },
  cleanup() {
    _gray = null;
    _gaussDst = null;
  },
};

// ---------------------------------------------------------------------------
// Pyramid Down
// ---------------------------------------------------------------------------

let _pyrDst: Matrix | null = null;
let _pyrParams: Record<string, any> = {};

const pyrDownDemo: DemoDefinition = {
  id: 'pyrDown',
  title: 'Pyramid Down',
  category: 'Image Processing',
  description: 'Multi-level image pyramid downsampling.',
  controls: [
    { type: 'slider', key: 'levels', label: 'Levels', min: 1, max: 4, step: 1, defaultNum: 1 },
  ],
  setup(_canvas, _video, params) {
    _pyrParams = { levels: 1, ...params };
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    profiler.start('pyrDown');
    const levels = _pyrParams.levels ?? 1;
    // Chain pyrDown operations -- use a pair of buffers
    let src = gray;
    for (let i = 0; i < levels; i++) {
      const dw = src.cols >> 1;
      const dh = src.rows >> 1;
      if (dw < 1 || dh < 1) break;
      if (!_pyrDst || _pyrDst.cols !== dw || _pyrDst.rows !== dh) {
        _pyrDst = new Matrix(dw, dh, U8C1);
      }
      pyrDown(src, _pyrDst);
      // For next iteration, we need to read from _pyrDst
      // Copy result to a gray-sized buffer for the loop
      if (i < levels - 1) {
        const nextSrc = new Matrix(dw, dh, U8C1);
        _pyrDst.copyTo(nextSrc);
        src = nextSrc;
      }
    }
    profiler.end('pyrDown');

    // Render: upscale the small result to fill the canvas
    if (_pyrDst) {
      const smallW = _pyrDst.cols;
      const smallH = _pyrDst.rows;
      const data = imageData.data;
      // Clear
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
      }
      // Nearest-neighbor upscale
      const scaleX = smallW / w;
      const scaleY = smallH / h;
      for (let y = 0; y < h; y++) {
        const sy = Math.min((y * scaleY) | 0, smallH - 1);
        for (let x = 0; x < w; x++) {
          const sx = Math.min((x * scaleX) | 0, smallW - 1);
          const v = _pyrDst.data[sy * smallW + sx];
          const di = (y * w + x) * 4;
          data[di] = v; data[di + 1] = v; data[di + 2] = v; data[di + 3] = 255;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  },
  onParamChange(key, value) {
    _pyrParams[key] = value;
  },
  cleanup() {
    _gray = null;
    _pyrDst = null;
  },
};

// ---------------------------------------------------------------------------
// Histogram Equalization
// ---------------------------------------------------------------------------

let _eqDst: Matrix | null = null;

const equalizeHistDemo: DemoDefinition = {
  id: 'equalizeHist',
  title: 'Histogram Equalization',
  category: 'Image Processing',
  description: 'Adaptive histogram equalization for contrast enhancement.',
  controls: [],
  setup() {},
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    if (!_eqDst || _eqDst.cols !== w || _eqDst.rows !== h) {
      _eqDst = new Matrix(w, h, U8C1);
    }

    profiler.start('equalize');
    equalizeHistogram(gray, _eqDst);
    profiler.end('equalize');

    // Split-screen: left original, right equalized
    const data = imageData.data;
    const halfW = (w / 2) | 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const di = (y * w + x) * 4;
        if (x < halfW) {
          const v = gray.data[y * w + x];
          data[di] = v; data[di + 1] = v; data[di + 2] = v; data[di + 3] = 255;
        } else {
          const v = _eqDst.data[y * w + x];
          data[di] = v; data[di + 1] = v; data[di + 2] = v; data[di + 3] = 255;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw divider line
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(halfW, 0);
    ctx.lineTo(halfW, h);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#ff0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Original', halfW / 2, 16);
    ctx.fillText('Equalized', halfW + halfW / 2, 16);
  },
  cleanup() {
    _gray = null;
    _eqDst = null;
  },
};

// ---------------------------------------------------------------------------
// Sobel Derivatives
// ---------------------------------------------------------------------------

let _sobelDst: Matrix | null = null;

const sobelDemo: DemoDefinition = {
  id: 'sobel',
  title: 'Sobel Derivatives',
  category: 'Edge Detection',
  description: 'Sobel edge detection showing dx/dy gradients.',
  controls: [],
  setup() {},
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    if (!_sobelDst || _sobelDst.cols !== w || _sobelDst.rows !== h) {
      _sobelDst = new Matrix(w, h, S32C2);
    }

    profiler.start('sobel');
    sobelDerivatives(gray, _sobelDst);
    profiler.end('sobel');

    // Render dx as red, dy as green
    const data = imageData.data;
    const dd = _sobelDst.data;
    for (let i = 0; i < w * h; i++) {
      const dx = Math.abs(dd[i * 2]) >> 2;
      const dy = Math.abs(dd[i * 2 + 1]) >> 2;
      data[i * 4] = Math.min(255, dx);
      data[i * 4 + 1] = Math.min(255, dy);
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  },
  cleanup() {
    _gray = null;
    _sobelDst = null;
  },
};

// ---------------------------------------------------------------------------
// Scharr Derivatives
// ---------------------------------------------------------------------------

let _scharrDst: Matrix | null = null;

const scharrDemo: DemoDefinition = {
  id: 'scharr',
  title: 'Scharr Derivatives',
  category: 'Edge Detection',
  description: 'Scharr operator for more accurate edge gradients.',
  controls: [],
  setup() {},
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    if (!_scharrDst || _scharrDst.cols !== w || _scharrDst.rows !== h) {
      _scharrDst = new Matrix(w, h, S32C2);
    }

    profiler.start('scharr');
    scharrDerivatives(gray, _scharrDst);
    profiler.end('scharr');

    const data = imageData.data;
    const dd = _scharrDst.data;
    for (let i = 0; i < w * h; i++) {
      const dx = Math.abs(dd[i * 2]) >> 2;
      const dy = Math.abs(dd[i * 2 + 1]) >> 2;
      data[i * 4] = Math.min(255, dx);
      data[i * 4 + 1] = Math.min(255, dy);
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  },
  cleanup() {
    _gray = null;
    _scharrDst = null;
  },
};

// ---------------------------------------------------------------------------
// YAPE06
// ---------------------------------------------------------------------------

let _yapeParams: Record<string, any> = {};

const yape06Demo: DemoDefinition = {
  id: 'yape06',
  title: 'YAPE06',
  category: 'Feature Detection',
  description: 'YAPE06 keypoint detector with Laplacian and eigen thresholds.',
  controls: [
    { type: 'slider', key: 'laplacianThreshold', label: 'Laplacian Thresh', min: 5, max: 100, step: 1, defaultNum: 30 },
    { type: 'slider', key: 'eigenThreshold', label: 'Eigen Thresh', min: 5, max: 100, step: 1, defaultNum: 25 },
    { type: 'slider', key: 'border', label: 'Border', min: 3, max: 10, step: 1, defaultNum: 5 },
  ],
  setup(_canvas, _video, params) {
    _yapeParams = { laplacianThreshold: 30, eigenThreshold: 25, border: 5, ...params };
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    profiler.start('yape06');
    const corners = ensureCorners(w * h);
    const count = yape06Detect(
      gray,
      corners,
      _yapeParams.border ?? 5,
      _yapeParams.laplacianThreshold ?? 30,
      _yapeParams.eigenThreshold ?? 25,
    );
    profiler.end('yape06');

    // Draw circles
    ctx.fillStyle = 'rgba(255, 100, 0, 0.7)';
    for (let i = 0; i < count; i++) {
      const kp = corners[i];
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  onParamChange(key, value) {
    _yapeParams[key] = value;
  },
  cleanup() {
    _gray = null;
    _corners = [];
  },
};

// ---------------------------------------------------------------------------
// ORB Match
// ---------------------------------------------------------------------------

let _orbParams: Record<string, any> = {};
let _orbBlurred: Matrix | null = null;
let _orbDescriptors: Matrix | null = null;
// Trained pattern state
let _orbTrainDescriptors: Matrix | null = null;
let _orbTrainCorners: Keypoint[] | null = null;
let _orbTrainCount = 0;
let _orbTrained = false;

/** Simple Hamming distance between two 32-byte descriptors. */
function hammingDistance(d1: ArrayLike<number>, off1: number, d2: ArrayLike<number>, off2: number): number {
  let dist = 0;
  for (let i = 0; i < 32; i++) {
    let v = d1[off1 + i] ^ d2[off2 + i];
    // popcount
    v = v - ((v >> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
    dist += (((v + (v >> 4)) & 0xF0F0F0F) * 0x1010101) >> 24;
  }
  return dist;
}

const orbMatchDemo: DemoDefinition = {
  id: 'orbMatch',
  title: 'ORB Match',
  category: 'Feature Detection',
  description: 'ORB feature matching with RANSAC homography and pattern training.',
  controls: [
    { type: 'slider', key: 'threshold', label: 'FAST Thresh', min: 5, max: 100, step: 1, defaultNum: 20 },
    { type: 'slider', key: 'matchThreshold', label: 'Match Dist', min: 30, max: 100, step: 1, defaultNum: 48 },
    { type: 'checkbox', key: 'train', label: 'Train Pattern', defaultBool: false },
  ],
  setup(_canvas, _video, params) {
    _orbParams = { threshold: 20, matchThreshold: 48, train: false, ...params };
    _orbTrained = false;
    _orbTrainDescriptors = null;
    _orbTrainCorners = null;
    _orbTrainCount = 0;
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    // Blur for stability
    if (!_orbBlurred || _orbBlurred.cols !== w || _orbBlurred.rows !== h) {
      _orbBlurred = new Matrix(w, h, U8C1);
    }
    profiler.start('blur');
    gaussianBlur(gray, _orbBlurred, 3, 0);
    profiler.end('blur');

    // Detect FAST corners
    profiler.start('FAST');
    const corners = ensureCorners(w * h);
    const count = fastCorners(_orbBlurred, corners, _orbParams.threshold ?? 20, 3);
    profiler.end('FAST');

    // Sort by score descending, take top N
    const maxFeatures = 500;
    const sorted = corners.slice(0, count).sort((a, b) => b.score - a.score);
    const nFeatures = Math.min(sorted.length, maxFeatures);

    // Compute ORB descriptors
    if (!_orbDescriptors) {
      _orbDescriptors = new Matrix(32, maxFeatures, U8C1);
    }
    profiler.start('ORB describe');
    orbDescribe(_orbBlurred, sorted, nFeatures, _orbDescriptors);
    profiler.end('ORB describe');

    // Handle train toggle
    if (_orbParams.train) {
      _orbParams.train = false;
      // Save current frame as pattern
      _orbTrainCount = nFeatures;
      _orbTrainCorners = sorted.slice(0, nFeatures).map(
        kp => new Keypoint(kp.x, kp.y, kp.score, kp.level, kp.angle),
      );
      _orbTrainDescriptors = new Matrix(32, nFeatures, U8C1);
      const srcD = _orbDescriptors.data;
      const dstD = _orbTrainDescriptors.data;
      for (let i = 0; i < nFeatures * 32; i++) {
        dstD[i] = srcD[i];
      }
      _orbTrained = true;
    }

    if (!_orbTrained || !_orbTrainDescriptors || !_orbTrainCorners) {
      // Draw current corners in yellow and show "Toggle Train to capture"
      ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
      for (let i = 0; i < nFeatures; i++) {
        ctx.beginPath();
        ctx.arc(sorted[i].x, sorted[i].y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ff0';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Toggle "Train Pattern" to capture reference', w / 2, h - 20);
      return;
    }

    // Match descriptors (brute-force Hamming)
    profiler.start('match');
    const matchThreshold = _orbParams.matchThreshold ?? 48;
    const from: { x: number; y: number }[] = [];
    const to: { x: number; y: number }[] = [];

    for (let i = 0; i < nFeatures; i++) {
      let bestDist = 256;
      let bestIdx = -1;
      for (let j = 0; j < _orbTrainCount; j++) {
        const dist = hammingDistance(
          _orbDescriptors.data, i * 32,
          _orbTrainDescriptors.data, j * 32,
        );
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = j;
        }
      }
      if (bestDist < matchThreshold && bestIdx >= 0) {
        from.push({ x: _orbTrainCorners[bestIdx].x, y: _orbTrainCorners[bestIdx].y });
        to.push({ x: sorted[i].x, y: sorted[i].y });
      }
    }
    profiler.end('match');

    // Draw matches as small lines
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < from.length; i++) {
      ctx.beginPath();
      ctx.moveTo(from[i].x, from[i].y);
      ctx.lineTo(to[i].x, to[i].y);
      ctx.stroke();
    }

    // RANSAC homography if enough matches
    if (from.length >= 4) {
      profiler.start('RANSAC');
      const homoModel = new Matrix(3, 3, F32C1);
      const rp = createRansacParams(4, 3, 0.5, 0.99);
      const mask = new Matrix(from.length, 1, U8C1);
      const found = ransac(rp, homography2d, from, to, from.length, homoModel, mask, 1000);
      profiler.end('RANSAC');

      if (found) {
        // Draw green outline around matched region using homography
        const md = homoModel.data;
        const corners4 = [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ];
        const projected = corners4.map(p => {
          const ww = md[6] * p.x + md[7] * p.y + md[8];
          return {
            x: (md[0] * p.x + md[1] * p.y + md[2]) / ww,
            y: (md[3] * p.x + md[4] * p.y + md[5]) / ww,
          };
        });
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(projected[0].x, projected[0].y);
        for (let i = 1; i < 4; i++) {
          ctx.lineTo(projected[i].x, projected[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Status text
    ctx.fillStyle = '#0f0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Matches: ${from.length}`, 8, h - 8);
  },
  onParamChange(key, value) {
    _orbParams[key] = value;
  },
  cleanup() {
    _gray = null;
    _corners = [];
    _orbBlurred = null;
    _orbDescriptors = null;
    _orbTrainDescriptors = null;
    _orbTrainCorners = null;
    _orbTrainCount = 0;
    _orbTrained = false;
  },
};

// ---------------------------------------------------------------------------
// Haar Face Detection (Web Worker)
// ---------------------------------------------------------------------------

let _haarParams: Record<string, any> = {};
let _haarWorker: Worker | null = null;
let _haarPending = false;
let _haarRects: { x: number; y: number; width: number; height: number }[] = [];

const haarFaceDemo: DemoDefinition = {
  id: 'haarFace',
  title: 'Haar Face Detection',
  category: 'Detection',
  description: 'Real-time face detection using Haar cascade classifier.',
  controls: [
    { type: 'slider', key: 'scaleFactor', label: 'Scale Factor', min: 1.1, max: 2.0, step: 0.1, defaultNum: 1.2 },
    { type: 'slider', key: 'minNeighbors', label: 'Min Neighbors', min: 0, max: 5, step: 1, defaultNum: 1 },
    { type: 'checkbox', key: 'equalize', label: 'Equalize Hist', defaultBool: true },
  ],
  setup(_canvas, _video, params) {
    _haarParams = { scaleFactor: 1.2, minNeighbors: 1, equalize: true, ...params };
    _haarRects = [];
    _haarPending = false;

    _haarWorker = new Worker(
      new URL('../workers/detection.worker.ts', import.meta.url),
      { type: 'module' },
    );
    _haarWorker.onmessage = (e: MessageEvent<{ rects: typeof _haarRects }>) => {
      _haarRects = e.data.rects;
      _haarPending = false;
    };
    _haarWorker.onerror = () => {
      _haarPending = false;
    };
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);

    // If worker is idle, extract grayscale and post detection request
    if (!_haarPending && _haarWorker) {
      const imageData = ctx.getImageData(0, 0, w, h);

      profiler.start('grayscale');
      const gray = ensureGray(w, h);
      jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
      profiler.end('grayscale');

      // Copy gray data for transfer to worker
      const grayData = new Uint8Array(gray.data.length);
      grayData.set(gray.data as Uint8Array);

      _haarPending = true;
      _haarWorker.postMessage(
        {
          type: 'haar' as const,
          data: grayData,
          width: w,
          height: h,
          params: {
            scaleFactor: _haarParams.scaleFactor,
            minNeighbors: _haarParams.minNeighbors,
            equalize: _haarParams.equalize,
          },
          scaleX: 1,
          scaleY: 1,
        },
        [grayData.buffer],
      );
    }

    // Always draw latest rects (even from previous frames)
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    for (const r of _haarRects) {
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    }

    ctx.fillStyle = '#0f0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Faces: ${_haarRects.length}`, 8, h - 8);
  },
  onParamChange(key, value) {
    _haarParams[key] = value;
  },
  cleanup() {
    _gray = null;
    if (_haarWorker) {
      _haarWorker.terminate();
      _haarWorker = null;
    }
    _haarRects = [];
    _haarPending = false;
  },
};

// ---------------------------------------------------------------------------
// BBF Face Detection (Web Worker)
// ---------------------------------------------------------------------------

let _bbfParams: Record<string, any> = {};
let _bbfWorker: Worker | null = null;
let _bbfPending = false;
let _bbfRects: { x: number; y: number; width: number; height: number }[] = [];

const bbfFaceDemo: DemoDefinition = {
  id: 'bbfFace',
  title: 'BBF Face Detection',
  category: 'Detection',
  description: 'Brightness Binary Feature face detection.',
  controls: [
    { type: 'slider', key: 'interval', label: 'Interval', min: 1, max: 5, step: 1, defaultNum: 4 },
  ],
  setup(_canvas, _video, params) {
    _bbfParams = { interval: 4, ...params };
    _bbfRects = [];
    _bbfPending = false;

    _bbfWorker = new Worker(
      new URL('../workers/detection.worker.ts', import.meta.url),
      { type: 'module' },
    );
    _bbfWorker.onmessage = (e: MessageEvent<{ rects: typeof _bbfRects }>) => {
      _bbfRects = e.data.rects;
      _bbfPending = false;
    };
    _bbfWorker.onerror = () => {
      _bbfPending = false;
    };
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);

    // If worker is idle, extract grayscale and post detection request
    if (!_bbfPending && _bbfWorker) {
      const imageData = ctx.getImageData(0, 0, w, h);

      profiler.start('grayscale');
      const gray = ensureGray(w, h);
      jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
      profiler.end('grayscale');

      const grayData = new Uint8Array(gray.data.length);
      grayData.set(gray.data as Uint8Array);

      _bbfPending = true;
      _bbfWorker.postMessage(
        {
          type: 'bbf' as const,
          data: grayData,
          width: w,
          height: h,
          params: {
            interval: _bbfParams.interval,
          },
          scaleX: 1,
          scaleY: 1,
        },
        [grayData.buffer],
      );
    }

    // Always draw latest rects (even from previous frames)
    ctx.strokeStyle = '#ff0066';
    ctx.lineWidth = 2;
    for (const r of _bbfRects) {
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    }

    ctx.fillStyle = '#ff0066';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Faces: ${_bbfRects.length}`, 8, h - 8);
  },
  onParamChange(key, value) {
    _bbfParams[key] = value;
  },
  cleanup() {
    _gray = null;
    if (_bbfWorker) {
      _bbfWorker.terminate();
      _bbfWorker = null;
    }
    _bbfRects = [];
    _bbfPending = false;
  },
};

// ---------------------------------------------------------------------------
// Optical Flow (Lucas-Kanade)
// ---------------------------------------------------------------------------

let _ofParams: Record<string, any> = {};
let _ofPrevPyr: Pyramid | null = null;
let _ofCurrPyr: Pyramid | null = null;
let _ofPrevXY: Float32Array | null = null;
let _ofCurrXY: Float32Array | null = null;
let _ofStatus: Uint8Array | null = null;
let _ofPointCount = 0;
let _ofFrameCount = 0;

const opticalFlowDemo: DemoDefinition = {
  id: 'opticalFlowLK',
  title: 'Optical Flow (LK)',
  category: 'Motion',
  description: 'Lucas-Kanade sparse optical flow tracking.',
  controls: [
    { type: 'slider', key: 'winSize', label: 'Window Size', min: 5, max: 30, step: 1, defaultNum: 20 },
    { type: 'slider', key: 'maxIter', label: 'Max Iterations', min: 5, max: 50, step: 1, defaultNum: 30 },
    { type: 'slider', key: 'maxPoints', label: 'Max Points', min: 50, max: 500, step: 50, defaultNum: 200 },
  ],
  setup(_canvas, _video, params) {
    _ofParams = { winSize: 20, maxIter: 30, maxPoints: 200, ...params };
    _ofPointCount = 0;
    _ofFrameCount = 0;
    _ofPrevPyr = null;
    _ofCurrPyr = null;
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    // Allocate pyramids
    const pyrLevels = 3;
    if (!_ofCurrPyr || _ofCurrPyr.data[0].cols !== w || _ofCurrPyr.data[0].rows !== h) {
      _ofPrevPyr = new Pyramid(pyrLevels);
      _ofPrevPyr.allocate(w, h, U8C1);
      _ofPrevPyr.pyrdown = pyrDown;
      _ofCurrPyr = new Pyramid(pyrLevels);
      _ofCurrPyr.allocate(w, h, U8C1);
      _ofCurrPyr.pyrdown = pyrDown;
      _ofPointCount = 0;
      _ofFrameCount = 0;
    }

    // Swap pyramids
    const tmp = _ofPrevPyr!;
    _ofPrevPyr = _ofCurrPyr!;
    _ofCurrPyr = tmp;

    // Copy gray into level 0
    gray.copyTo(_ofCurrPyr.data[0]);

    profiler.start('buildPyramid');
    _ofCurrPyr.build(_ofCurrPyr.data[0], true);
    profiler.end('buildPyramid');

    _ofFrameCount++;

    // Re-detect points every N frames or when count is too low
    const maxPts = _ofParams.maxPoints ?? 200;
    const maxBuf = 1000;
    if (_ofPointCount < maxPts / 2 || _ofFrameCount % 30 === 1) {
      profiler.start('detectPoints');
      const corners = ensureCorners(w * h);
      const count = fastCorners(gray, corners, 20, 3);

      // Sort by score and take top N
      const sorted = corners.slice(0, count).sort((a, b) => b.score - a.score);
      const n = Math.min(sorted.length, maxPts);

      if (!_ofPrevXY || _ofPrevXY.length < maxBuf * 2) {
        _ofPrevXY = new Float32Array(maxBuf * 2);
        _ofCurrXY = new Float32Array(maxBuf * 2);
        _ofStatus = new Uint8Array(maxBuf);
      }

      for (let i = 0; i < n; i++) {
        _ofPrevXY[i * 2] = sorted[i].x;
        _ofPrevXY[i * 2 + 1] = sorted[i].y;
      }
      _ofPointCount = n;
      profiler.end('detectPoints');

      // On first frame, nothing to track yet
      if (_ofFrameCount <= 1) return;
    }

    if (_ofPointCount === 0 || !_ofPrevXY || !_ofCurrXY || !_ofStatus) return;

    // Track
    profiler.start('lucasKanade');
    lucasKanade(
      _ofPrevPyr!, _ofCurrPyr!,
      _ofPrevXY, _ofCurrXY!,
      _ofPointCount,
      _ofParams.winSize ?? 20,
      _ofParams.maxIter ?? 30,
      _ofStatus!,
    );
    profiler.end('lucasKanade');

    // Draw flow vectors and compact surviving points
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    let newCount = 0;
    for (let i = 0; i < _ofPointCount; i++) {
      if (_ofStatus![i] === 1) {
        const px = _ofPrevXY[i * 2];
        const py = _ofPrevXY[i * 2 + 1];
        const cx = _ofCurrXY![i * 2];
        const cy = _ofCurrXY![i * 2 + 1];

        // Draw flow vector
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(cx, cy);
        ctx.stroke();

        // Draw point
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();

        // Compact
        _ofPrevXY[newCount * 2] = cx;
        _ofPrevXY[newCount * 2 + 1] = cy;
        newCount++;
      }
    }
    _ofPointCount = newCount;

    ctx.fillStyle = '#0f0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Points: ${_ofPointCount}`, 8, h - 8);
  },
  onParamChange(key, value) {
    _ofParams[key] = value;
  },
  cleanup() {
    _gray = null;
    _corners = [];
    _ofPrevPyr = null;
    _ofCurrPyr = null;
    _ofPrevXY = null;
    _ofCurrXY = null;
    _ofStatus = null;
    _ofPointCount = 0;
    _ofFrameCount = 0;
  },
};

// ---------------------------------------------------------------------------
// Video Stabilization (Motion Estimation)
// ---------------------------------------------------------------------------

let _stabParams: Record<string, any> = {};
let _stabPrevPyr: Pyramid | null = null;
let _stabCurrPyr: Pyramid | null = null;
let _stabPrevXY: Float32Array | null = null;
let _stabCurrXY: Float32Array | null = null;
let _stabStatus: Uint8Array | null = null;
let _stabPointCount = 0;
let _stabFrameCount = 0;
// Trajectory smoothing
let _stabTransforms: { a: number; b: number; tx: number; ty: number }[] = [];
let _stabSmoothedX = 0;
let _stabSmoothedY = 0;
let _stabSmoothedA = 0;

const videoStabDemo: DemoDefinition = {
  id: 'motionEstimation',
  title: 'Video Stabilization',
  category: 'Motion',
  description: 'FAST + LK + RANSAC motion estimation with Gaussian trajectory smoothing.',
  controls: [
    {
      type: 'select', key: 'model', label: 'Motion Model',
      options: [
        { value: 'affine', label: 'Affine' },
        { value: 'homography', label: 'Homography' },
      ],
      defaultStr: 'affine',
    },
    { type: 'slider', key: 'smoothingRadius', label: 'Smoothing', min: 5, max: 30, step: 1, defaultNum: 15 },
  ],
  setup(_canvas, _video, params) {
    _stabParams = { model: 'affine', smoothingRadius: 15, ...params };
    _stabPointCount = 0;
    _stabFrameCount = 0;
    _stabPrevPyr = null;
    _stabCurrPyr = null;
    _stabTransforms = [];
    _stabSmoothedX = 0;
    _stabSmoothedY = 0;
    _stabSmoothedA = 0;
  },
  process(ctx, video, w, h, profiler) {
    // Draw original on left half
    const halfW = (w / 2) | 0;

    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    // Allocate pyramids
    const pyrLevels = 3;
    if (!_stabCurrPyr || _stabCurrPyr.data[0].cols !== w || _stabCurrPyr.data[0].rows !== h) {
      _stabPrevPyr = new Pyramid(pyrLevels);
      _stabPrevPyr.allocate(w, h, U8C1);
      _stabPrevPyr.pyrdown = pyrDown;
      _stabCurrPyr = new Pyramid(pyrLevels);
      _stabCurrPyr.allocate(w, h, U8C1);
      _stabCurrPyr.pyrdown = pyrDown;
      _stabPointCount = 0;
      _stabFrameCount = 0;
      _stabTransforms = [];
    }

    // Swap pyramids
    const tmp = _stabPrevPyr!;
    _stabPrevPyr = _stabCurrPyr!;
    _stabCurrPyr = tmp;

    gray.copyTo(_stabCurrPyr.data[0]);

    profiler.start('buildPyramid');
    _stabCurrPyr.build(_stabCurrPyr.data[0], true);
    profiler.end('buildPyramid');

    _stabFrameCount++;

    // Detect points for tracking
    const maxPts = 200;
    const maxBuf = 500;

    profiler.start('detectPoints');
    const corners = ensureCorners(w * h);
    const count = fastCorners(gray, corners, 20, 3);
    const sorted = corners.slice(0, count).sort((a, b) => b.score - a.score);
    const n = Math.min(sorted.length, maxPts);

    if (!_stabPrevXY || _stabPrevXY.length < maxBuf * 2) {
      _stabPrevXY = new Float32Array(maxBuf * 2);
      _stabCurrXY = new Float32Array(maxBuf * 2);
      _stabStatus = new Uint8Array(maxBuf);
    }

    for (let i = 0; i < n; i++) {
      _stabPrevXY[i * 2] = sorted[i].x;
      _stabPrevXY[i * 2 + 1] = sorted[i].y;
    }
    _stabPointCount = n;
    profiler.end('detectPoints');

    if (_stabFrameCount <= 1 || _stabPointCount < 4) {
      // Draw split-screen label
      ctx.fillStyle = '#ff0';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Original', halfW / 2, 16);
      ctx.fillText('Stabilized', halfW + halfW / 2, 16);
      return;
    }

    // Track points
    profiler.start('lucasKanade');
    lucasKanade(
      _stabPrevPyr!, _stabCurrPyr!,
      _stabPrevXY, _stabCurrXY!,
      _stabPointCount, 20, 30,
      _stabStatus!,
    );
    profiler.end('lucasKanade');

    // Collect matched pairs
    const from: { x: number; y: number }[] = [];
    const to: { x: number; y: number }[] = [];
    for (let i = 0; i < _stabPointCount; i++) {
      if (_stabStatus![i] === 1) {
        from.push({ x: _stabPrevXY[i * 2], y: _stabPrevXY[i * 2 + 1] });
        to.push({ x: _stabCurrXY![i * 2], y: _stabCurrXY![i * 2 + 1] });
      }
    }

    if (from.length >= 4) {
      profiler.start('RANSAC');
      const model = new Matrix(3, 3, F32C1);
      const kernel = _stabParams.model === 'homography' ? homography2d : affine2d;
      const minPts = _stabParams.model === 'homography' ? 4 : 3;
      const rp = createRansacParams(minPts, 3, 0.5, 0.99);
      const mask = new Matrix(from.length, 1, U8C1);
      const found = ransac(rp, kernel, from, to, from.length, model, mask, 1000);
      profiler.end('RANSAC');

      if (found) {
        const md = model.data;
        // Extract translation and rotation from model
        const dx = md[2];
        const dy = md[5];
        const da = Math.atan2(md[3], md[0]);

        _stabTransforms.push({ a: da, b: 0, tx: dx, ty: dy });

        // Smooth using simple exponential moving average
        const alpha = 1.0 / (_stabParams.smoothingRadius ?? 15);
        _stabSmoothedX = _stabSmoothedX * (1 - alpha) + dx * alpha;
        _stabSmoothedY = _stabSmoothedY * (1 - alpha) + dy * alpha;
        _stabSmoothedA = _stabSmoothedA * (1 - alpha) + da * alpha;

        // Apply stabilization correction to right half
        const corrX = _stabSmoothedX - dx;
        const corrY = _stabSmoothedY - dy;
        const corrA = _stabSmoothedA - da;

        // Draw stabilized view on right half
        ctx.save();
        ctx.beginPath();
        ctx.rect(halfW, 0, halfW, h);
        ctx.clip();
        ctx.translate(halfW + halfW / 2, h / 2);
        ctx.rotate(corrA);
        ctx.translate(corrX, corrY);
        ctx.translate(-w / 2, -h / 2);
        ctx.drawImage(video, 0, 0, w, h);
        ctx.restore();
      }
    }

    // Draw original on left half
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, halfW, h);
    ctx.clip();
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    // Divider line
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(halfW, 0);
    ctx.lineTo(halfW, h);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#ff0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Original', halfW / 2, 16);
    ctx.fillText('Stabilized', halfW + halfW / 2, 16);
  },
  onParamChange(key, value) {
    _stabParams[key] = value;
  },
  cleanup() {
    _gray = null;
    _corners = [];
    _stabPrevPyr = null;
    _stabCurrPyr = null;
    _stabPrevXY = null;
    _stabCurrXY = null;
    _stabStatus = null;
    _stabPointCount = 0;
    _stabFrameCount = 0;
    _stabTransforms = [];
    _stabSmoothedX = 0;
    _stabSmoothedY = 0;
    _stabSmoothedA = 0;
  },
};

// ---------------------------------------------------------------------------
// Affine Warp
// ---------------------------------------------------------------------------

let _warpAffParams: Record<string, any> = {};
let _warpAffDst: Matrix | null = null;
let _warpAffTransform: Matrix | null = null;

const warpAffineDemo: DemoDefinition = {
  id: 'warpAffine',
  title: 'Affine Warp',
  category: 'Transform',
  description: 'Real-time affine image warping with rotation, scale, and translation.',
  controls: [
    { type: 'slider', key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1, defaultNum: 0 },
    { type: 'slider', key: 'scale', label: 'Scale', min: 0.5, max: 2.0, step: 0.1, defaultNum: 1.0 },
    { type: 'slider', key: 'translateX', label: 'Translate X', min: -100, max: 100, step: 1, defaultNum: 0 },
    { type: 'slider', key: 'translateY', label: 'Translate Y', min: -100, max: 100, step: 1, defaultNum: 0 },
  ],
  setup(_canvas, _video, params) {
    _warpAffParams = { rotation: 0, scale: 1.0, translateX: 0, translateY: 0, ...params };
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    if (!_warpAffDst || _warpAffDst.cols !== w || _warpAffDst.rows !== h) {
      _warpAffDst = new Matrix(w, h, U8C1);
    }
    if (!_warpAffTransform) {
      _warpAffTransform = new Matrix(3, 3, F32C1);
    }

    // Build affine transform matrix (rotation + scale + translation about center)
    const cx = w / 2;
    const cy = h / 2;
    const angle = (_warpAffParams.rotation ?? 0) * Math.PI / 180;
    const s = _warpAffParams.scale ?? 1.0;
    const tx = _warpAffParams.translateX ?? 0;
    const ty = _warpAffParams.translateY ?? 0;

    const cosA = Math.cos(angle) * s;
    const sinA = Math.sin(angle) * s;

    // Transform matrix: translate to origin, rotate+scale, translate back + user offset
    // [cosA, -sinA, cx - cx*cosA + cy*sinA + tx]
    // [sinA,  cosA, cy - cx*sinA - cy*cosA + ty]
    // [0,     0,    1]
    const td = _warpAffTransform.data;
    td[0] = cosA;
    td[1] = -sinA;
    td[2] = cx - cx * cosA + cy * sinA + tx;
    td[3] = sinA;
    td[4] = cosA;
    td[5] = cy - cx * sinA - cy * cosA + ty;
    td[6] = 0;
    td[7] = 0;
    td[8] = 1;

    profiler.start('warpAffine');
    warpAffine(gray, _warpAffDst, _warpAffTransform, 0);
    profiler.end('warpAffine');

    grayToImageData(_warpAffDst, imageData, w, h);
    ctx.putImageData(imageData, 0, 0);
  },
  onParamChange(key, value) {
    _warpAffParams[key] = value;
  },
  cleanup() {
    _gray = null;
    _warpAffDst = null;
    _warpAffTransform = null;
  },
};

// ---------------------------------------------------------------------------
// Homography (Perspective Warp)
// ---------------------------------------------------------------------------

let _homogParams: Record<string, any> = {};
let _homogCorners: { x: number; y: number }[] = [];
let _homogDragging = -1;
let _homogCanvas: HTMLCanvasElement | null = null;
let _homogMouseHandler: ((e: MouseEvent) => void) | null = null;
let _homogMouseUpHandler: ((e: MouseEvent) => void) | null = null;
let _homogMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
let _homogTouchHandler: ((e: TouchEvent) => void) | null = null;

function resetHomogCorners(w: number, h: number) {
  const inset = 40;
  _homogCorners = [
    { x: inset, y: inset },
    { x: w - inset, y: inset },
    { x: w - inset, y: h - inset },
    { x: inset, y: h - inset },
  ];
}

const homographyDemo: DemoDefinition = {
  id: 'homography',
  title: 'Perspective Warp',
  category: 'Transform',
  description: 'Drag corner handles to apply a perspective transform via homography.',
  controls: [
    { type: 'checkbox', key: 'reset', label: 'Reset Corners', defaultBool: false },
  ],
  setup(canvas, _video, params) {
    _homogParams = { reset: false, ...params };
    _homogCanvas = canvas;
    const w = canvas.width;
    const h = canvas.height;
    resetHomogCorners(w, h);

    // Mouse/touch handlers for dragging corners
    const getCanvasPos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    _homogMouseHandler = (e: MouseEvent) => {
      const pos = getCanvasPos(e.clientX, e.clientY);
      // Find closest corner within 20px
      let closest = -1;
      let minDist = 400; // 20px squared
      for (let i = 0; i < 4; i++) {
        const dx = pos.x - _homogCorners[i].x;
        const dy = pos.y - _homogCorners[i].y;
        const d = dx * dx + dy * dy;
        if (d < minDist) {
          minDist = d;
          closest = i;
        }
      }
      _homogDragging = closest;
    };

    _homogMouseMoveHandler = (e: MouseEvent) => {
      if (_homogDragging >= 0) {
        const pos = getCanvasPos(e.clientX, e.clientY);
        _homogCorners[_homogDragging] = pos;
      }
    };

    _homogMouseUpHandler = () => {
      _homogDragging = -1;
    };

    _homogTouchHandler = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        const pos = getCanvasPos(t.clientX, t.clientY);
        if (_homogDragging < 0) {
          let closest = -1;
          let minDist = 900;
          for (let i = 0; i < 4; i++) {
            const dx = pos.x - _homogCorners[i].x;
            const dy = pos.y - _homogCorners[i].y;
            const d = dx * dx + dy * dy;
            if (d < minDist) {
              minDist = d;
              closest = i;
            }
          }
          _homogDragging = closest;
        }
        if (_homogDragging >= 0) {
          _homogCorners[_homogDragging] = pos;
        }
        e.preventDefault();
      }
    };

    canvas.addEventListener('mousedown', _homogMouseHandler);
    canvas.addEventListener('mousemove', _homogMouseMoveHandler);
    canvas.addEventListener('mouseup', _homogMouseUpHandler);
    canvas.addEventListener('touchstart', _homogTouchHandler, { passive: false });
    canvas.addEventListener('touchmove', _homogTouchHandler, { passive: false });
    canvas.addEventListener('touchend', () => { _homogDragging = -1; });
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);

    // Handle reset
    if (_homogParams.reset) {
      _homogParams.reset = false;
      resetHomogCorners(w, h);
    }

    // Compute perspective warp using canvas setTransform
    // We project the video through the 4-point perspective using canvas
    // subdivided quad approach (approximate perspective via triangles)
    profiler.start('perspectiveWarp');

    // We divide the source into a grid and warp each cell
    const dstCorners = _homogCorners;

    // Simple approach: draw the video warped using canvas subdivision
    // Use a grid-based approach for approximate perspective warp
    const gridN = 16;
    ctx.save();
    for (let gy = 0; gy < gridN; gy++) {
      for (let gx = 0; gx < gridN; gx++) {
        const u0 = gx / gridN, u1 = (gx + 1) / gridN;
        const v0 = gy / gridN, v1 = (gy + 1) / gridN;

        // Bilinear interpolation in source
        const sx0 = u0 * w, sx1 = u1 * w;
        const sy0 = v0 * h, sy1 = v1 * h;

        // Bilinear interpolation in destination
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const bilerp = (c: { x: number; y: number }[], u: number, v: number) => ({
          x: lerp(lerp(c[0].x, c[1].x, u), lerp(c[3].x, c[2].x, u), v),
          y: lerp(lerp(c[0].y, c[1].y, u), lerp(c[3].y, c[2].y, u), v),
        });

        const d00 = bilerp(dstCorners, u0, v0);
        const d10 = bilerp(dstCorners, u1, v0);
        const d01 = bilerp(dstCorners, u0, v1);
        const d11 = bilerp(dstCorners, u1, v1);

        // Draw two triangles for this cell
        // Triangle 1: d00, d10, d01
        drawTexturedTriangle(
          ctx, video,
          sx0, sy0, sx1, sy0, sx0, sy1,
          d00.x, d00.y, d10.x, d10.y, d01.x, d01.y,
          w, h,
        );
        // Triangle 2: d10, d11, d01
        drawTexturedTriangle(
          ctx, video,
          sx1, sy0, sx1, sy1, sx0, sy1,
          d10.x, d10.y, d11.x, d11.y, d01.x, d01.y,
          w, h,
        );
      }
    }
    ctx.restore();
    profiler.end('perspectiveWarp');

    // Draw corner handles
    ctx.fillStyle = '#ff0';
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dstCorners[0].x, dstCorners[0].y);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(dstCorners[i].x, dstCorners[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(dstCorners[i].x, dstCorners[i].y, 8, 0, Math.PI * 2);
      ctx.fillStyle = _homogDragging === i ? '#f00' : '#ff0';
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#ff0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Drag corners to warp', w / 2, h - 8);
  },
  onParamChange(key, value) {
    _homogParams[key] = value;
    if (key === 'reset' && value && _homogCanvas) {
      resetHomogCorners(_homogCanvas.width, _homogCanvas.height);
    }
  },
  cleanup() {
    if (_homogCanvas) {
      if (_homogMouseHandler) _homogCanvas.removeEventListener('mousedown', _homogMouseHandler);
      if (_homogMouseMoveHandler) _homogCanvas.removeEventListener('mousemove', _homogMouseMoveHandler);
      if (_homogMouseUpHandler) _homogCanvas.removeEventListener('mouseup', _homogMouseUpHandler);
      if (_homogTouchHandler) {
        _homogCanvas.removeEventListener('touchstart', _homogTouchHandler);
        _homogCanvas.removeEventListener('touchmove', _homogTouchHandler);
      }
    }
    _homogCanvas = null;
    _homogMouseHandler = null;
    _homogMouseMoveHandler = null;
    _homogMouseUpHandler = null;
    _homogTouchHandler = null;
    _homogCorners = [];
    _homogDragging = -1;
  },
};

/** Draw a textured triangle using canvas affine transform. */
function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  sx0: number, sy0: number, sx1: number, sy1: number, sx2: number, sy2: number,
  dx0: number, dy0: number, dx1: number, dy1: number, dx2: number, dy2: number,
  imgW: number, imgH: number,
) {
  // Compute affine transform from source triangle to destination triangle
  // Source: (sx0,sy0), (sx1,sy1), (sx2,sy2) mapped to (0,0), (1,0), (0,1)
  const det = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0);
  if (Math.abs(det) < 0.001) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.lineTo(dx1, dy1);
  ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();

  // Map from unit triangle to destination
  const dxA = dx1 - dx0, dyA = dy1 - dy0;
  const dxB = dx2 - dx0, dyB = dy2 - dy0;

  // Map from source to unit triangle
  const invDet = 1 / det;
  const a = (sy2 - sy0) * invDet;
  const b = -(sx2 - sx0) * invDet;
  const c = -(sy1 - sy0) * invDet;
  const d = (sx1 - sx0) * invDet;
  const e = -a * sx0 - b * sy0;
  const f = -c * sx0 - d * sy0;

  // Combined transform: source coords -> unit -> dest
  ctx.setTransform(
    dxA * a + dxB * c,
    dyA * a + dyB * c,
    dxA * b + dxB * d,
    dyA * b + dyB * d,
    dxA * e + dxB * f + dx0,
    dyA * e + dyB * f + dy0,
  );

  ctx.drawImage(img, 0, 0, imgW, imgH, 0, 0, imgW, imgH);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Touch Flow (tap to add tracking points)
// ---------------------------------------------------------------------------

let _touchParams: Record<string, any> = {};
let _touchPrevPyr: Pyramid | null = null;
let _touchCurrPyr: Pyramid | null = null;
let _touchPrevXY: Float32Array | null = null;
let _touchCurrXY: Float32Array | null = null;
let _touchStatus: Uint8Array | null = null;
let _touchPointCount = 0;
let _touchFrameCount = 0;
let _touchCanvas: HTMLCanvasElement | null = null;
let _touchClickHandler: ((e: MouseEvent) => void) | null = null;
let _touchTouchHandler: ((e: TouchEvent) => void) | null = null;
const TOUCH_MAX_BUF = 1000;

function addTouchPoint(canvasX: number, canvasY: number) {
  if (!_touchPrevXY) {
    _touchPrevXY = new Float32Array(TOUCH_MAX_BUF * 2);
    _touchCurrXY = new Float32Array(TOUCH_MAX_BUF * 2);
    _touchStatus = new Uint8Array(TOUCH_MAX_BUF);
  }
  if (_touchPointCount < TOUCH_MAX_BUF) {
    _touchPrevXY[_touchPointCount * 2] = canvasX;
    _touchPrevXY[_touchPointCount * 2 + 1] = canvasY;
    _touchPointCount++;
  }
}

const touchFlowDemo: DemoDefinition = {
  id: 'touchFlow',
  title: 'Touch Tracking',
  category: 'Extras',
  description: 'Click/tap to add tracking points, tracked with Lucas-Kanade optical flow.',
  controls: [
    { type: 'slider', key: 'winSize', label: 'Window Size', min: 5, max: 30, step: 1, defaultNum: 20 },
    { type: 'checkbox', key: 'clear', label: 'Clear Points', defaultBool: false },
  ],
  setup(canvas, _video, params) {
    _touchParams = { winSize: 20, clear: false, ...params };
    _touchCanvas = canvas;
    _touchPointCount = 0;
    _touchFrameCount = 0;
    _touchPrevPyr = null;
    _touchCurrPyr = null;
    _touchPrevXY = new Float32Array(TOUCH_MAX_BUF * 2);
    _touchCurrXY = new Float32Array(TOUCH_MAX_BUF * 2);
    _touchStatus = new Uint8Array(TOUCH_MAX_BUF);

    const getCanvasPos = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    _touchClickHandler = (e: MouseEvent) => {
      const pos = getCanvasPos(e.clientX, e.clientY);
      addTouchPoint(pos.x, pos.y);
    };

    _touchTouchHandler = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        const pos = getCanvasPos(t.clientX, t.clientY);
        addTouchPoint(pos.x, pos.y);
        e.preventDefault();
      }
    };

    canvas.addEventListener('click', _touchClickHandler);
    canvas.addEventListener('touchstart', _touchTouchHandler, { passive: false });
  },
  process(ctx, video, w, h, profiler) {
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    const gray = ensureGray(w, h);
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    profiler.end('grayscale');

    // Handle clear
    if (_touchParams.clear) {
      _touchParams.clear = false;
      _touchPointCount = 0;
    }

    // Allocate pyramids
    const pyrLevels = 3;
    if (!_touchCurrPyr || _touchCurrPyr.data[0].cols !== w || _touchCurrPyr.data[0].rows !== h) {
      _touchPrevPyr = new Pyramid(pyrLevels);
      _touchPrevPyr.allocate(w, h, U8C1);
      _touchPrevPyr.pyrdown = pyrDown;
      _touchCurrPyr = new Pyramid(pyrLevels);
      _touchCurrPyr.allocate(w, h, U8C1);
      _touchCurrPyr.pyrdown = pyrDown;
      _touchFrameCount = 0;
    }

    // Swap pyramids
    const tmp = _touchPrevPyr!;
    _touchPrevPyr = _touchCurrPyr!;
    _touchCurrPyr = tmp;

    gray.copyTo(_touchCurrPyr.data[0]);

    profiler.start('buildPyramid');
    _touchCurrPyr.build(_touchCurrPyr.data[0], true);
    profiler.end('buildPyramid');

    _touchFrameCount++;

    if (_touchPointCount > 0 && _touchFrameCount > 1 && _touchPrevXY && _touchCurrXY && _touchStatus) {
      profiler.start('lucasKanade');
      lucasKanade(
        _touchPrevPyr!, _touchCurrPyr!,
        _touchPrevXY, _touchCurrXY,
        _touchPointCount,
        _touchParams.winSize ?? 20,
        30,
        _touchStatus,
      );
      profiler.end('lucasKanade');

      // Draw flow and compact
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;
      let newCount = 0;
      for (let i = 0; i < _touchPointCount; i++) {
        if (_touchStatus[i] === 1) {
          const px = _touchPrevXY[i * 2];
          const py = _touchPrevXY[i * 2 + 1];
          const cx = _touchCurrXY[i * 2];
          const cy = _touchCurrXY[i * 2 + 1];

          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(cx, cy);
          ctx.stroke();

          ctx.fillStyle = '#0f0';
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fill();

          _touchPrevXY[newCount * 2] = cx;
          _touchPrevXY[newCount * 2 + 1] = cy;
          newCount++;
        }
      }
      _touchPointCount = newCount;
    } else if (_touchPointCount > 0 && _touchPrevXY) {
      // First frame: just draw the points
      ctx.fillStyle = '#0f0';
      for (let i = 0; i < _touchPointCount; i++) {
        ctx.beginPath();
        ctx.arc(_touchPrevXY[i * 2], _touchPrevXY[i * 2 + 1], 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Instructions
    ctx.fillStyle = '#ff0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Click/tap to add points | Points: ${_touchPointCount}`, w / 2, h - 8);
  },
  onParamChange(key, value) {
    _touchParams[key] = value;
    if (key === 'clear' && value) {
      _touchPointCount = 0;
    }
  },
  cleanup() {
    if (_touchCanvas) {
      if (_touchClickHandler) _touchCanvas.removeEventListener('click', _touchClickHandler);
      if (_touchTouchHandler) _touchCanvas.removeEventListener('touchstart', _touchTouchHandler);
    }
    _touchCanvas = null;
    _touchClickHandler = null;
    _touchTouchHandler = null;
    _touchPrevPyr = null;
    _touchCurrPyr = null;
    _touchPrevXY = null;
    _touchCurrXY = null;
    _touchStatus = null;
    _touchPointCount = 0;
    _touchFrameCount = 0;
    _gray = null;
  },
};

// ---------------------------------------------------------------------------
// Full list of demos
// ---------------------------------------------------------------------------

const allDemos: DemoDefinition[] = [
  // Image Processing
  grayscaleDemo,
  cannyEdgesDemo,
  boxBlurDemo,
  gaussianBlurDemo,
  pyrDownDemo,
  equalizeHistDemo,

  // Edge Detection
  sobelDemo,
  scharrDemo,

  // Feature Detection
  fastCornersDemo,
  yape06Demo,
  orbMatchDemo,

  // Face Detection
  haarFaceDemo,
  bbfFaceDemo,

  // Motion
  opticalFlowDemo,
  videoStabDemo,

  // Transforms
  warpAffineDemo,
  homographyDemo,

  // Extras
  touchFlowDemo,
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
