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
  findContours,
  approxPoly,
  detectLineSegments,
} from 'jsfeat/imgproc';
import type { LineSegment } from 'jsfeat/imgproc';
import { fastCorners, yape06Detect, orbDescribe } from 'jsfeat/features';
import { drawVideoFrame } from '@/lib/videoOrientation';
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
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);

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
    drawVideoFrame(ctx, video, w, h);

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
    drawVideoFrame(ctx, video, w, h);
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

    drawVideoFrame(ctx, video, w, h);
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
        drawVideoFrame(ctx, video, w, h);
        ctx.restore();
      }
    }

    // Draw original on left half
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, halfW, h);
    ctx.clip();
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);
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
    drawVideoFrame(ctx, video, w, h);

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
    drawVideoFrame(ctx, video, w, h);
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
// Card Detection
// ---------------------------------------------------------------------------

let _cardParams: Record<string, any> = {};
let _cardGray: Matrix | null = null;
let _cardBlurred: Matrix | null = null;
let _cardEdges: Matrix | null = null;
let _cardScharr: Matrix | null = null;
let _cardDebugInfo: string = '';
// Temporal smoothing for stable bounding box
let _cardSmoothedCorners: { x: number; y: number }[] | null = null;
let _cardGraceFrames = 0;
const _cardQualityHistory: number[] = [];
let _cardLastRectFill = 0;
let _cardLastAspect = 0;
let _cardShowPipelineOverlays = true;
let _cardPrevThreshold = 0;
let _cardLastContours: ReturnType<typeof findContours> = [];
let _cardLsdSegments: LineSegment[] = [];
let _cardLsdWinningLines: LineSegment[] = [];

/** Toggle the pipeline's built-in debug overlays (thumbnail, quality chart, status text). */
export function setCardPipelineOverlays(show: boolean) {
  _cardShowPipelineOverlays = show;
}

/** Sort 4 corners into top-left, top-right, bottom-right, bottom-left order. */
function sortCorners(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  // Center point
  const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 4;
  // Sort by angle from center
  const sorted = pts.slice().sort((a, b) =>
    Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  // Find top-left (smallest x+y sum)
  let minSum = Infinity, minIdx = 0;
  for (let i = 0; i < 4; i++) {
    const s = sorted[i].x + sorted[i].y;
    if (s < minSum) { minSum = s; minIdx = i; }
  }
  // Rotate so TL is first
  const result = [];
  for (let i = 0; i < 4; i++) result.push(sorted[(minIdx + i) % 4]);
  return result;
}

/** Build card corners from a bounding rect, enforcing 5:7 (w:h) ratio. */
function buildCardCorners(br: { x: number; y: number; width: number; height: number }) {
  const cx = br.x + br.width / 2;
  const cy = br.y + br.height / 2;
  const isLandscape = br.width > br.height;
  let cw: number, ch: number;
  if (isLandscape) {
    cw = br.width; ch = cw * (5 / 7);
    if (ch < br.height) { ch = br.height; cw = ch * (7 / 5); }
  } else {
    ch = br.height; cw = ch * (5 / 7);
    if (cw < br.width) { cw = br.width; ch = cw * (7 / 5); }
  }
  return sortCorners([
    { x: cx - cw / 2, y: cy - ch / 2 },
    { x: cx + cw / 2, y: cy - ch / 2 },
    { x: cx + cw / 2, y: cy + ch / 2 },
    { x: cx - cw / 2, y: cy + ch / 2 },
  ]);
}

/**
 * Compute 3x3 perspective transform from 4 source points to 4 destination points.
 * Solves the 8-parameter homography using simple Gaussian elimination.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getPerspectiveTransform(
  src: { x: number; y: number }[],
  dst: { x: number; y: number }[],
): Float64Array {
  // Build 8x8 system Ah = b
  const A = new Float64Array(64);
  const b = new Float64Array(8);
  for (let i = 0; i < 4; i++) {
    const sx = src[i].x, sy = src[i].y, dx = dst[i].x, dy = dst[i].y;
    const r1 = i * 2, r2 = i * 2 + 1;
    A[r1 * 8 + 0] = sx; A[r1 * 8 + 1] = sy; A[r1 * 8 + 2] = 1;
    A[r1 * 8 + 3] = 0;  A[r1 * 8 + 4] = 0;  A[r1 * 8 + 5] = 0;
    A[r1 * 8 + 6] = -dx * sx; A[r1 * 8 + 7] = -dx * sy;
    b[r1] = dx;
    A[r2 * 8 + 0] = 0;  A[r2 * 8 + 1] = 0;  A[r2 * 8 + 2] = 0;
    A[r2 * 8 + 3] = sx; A[r2 * 8 + 4] = sy; A[r2 * 8 + 5] = 1;
    A[r2 * 8 + 6] = -dy * sx; A[r2 * 8 + 7] = -dy * sy;
    b[r2] = dy;
  }
  // Gaussian elimination with partial pivoting
  for (let col = 0; col < 8; col++) {
    let maxRow = col, maxVal = Math.abs(A[col * 8 + col]);
    for (let row = col + 1; row < 8; row++) {
      const v = Math.abs(A[row * 8 + col]);
      if (v > maxVal) { maxVal = v; maxRow = row; }
    }
    if (maxRow !== col) {
      for (let j = 0; j < 8; j++) {
        const tmp = A[col * 8 + j]; A[col * 8 + j] = A[maxRow * 8 + j]; A[maxRow * 8 + j] = tmp;
      }
      const tmp = b[col]; b[col] = b[maxRow]; b[maxRow] = tmp;
    }
    const pivot = A[col * 8 + col];
    if (Math.abs(pivot) < 1e-12) return new Float64Array(9); // singular
    for (let row = col + 1; row < 8; row++) {
      const factor = A[row * 8 + col] / pivot;
      for (let j = col; j < 8; j++) A[row * 8 + j] -= factor * A[col * 8 + j];
      b[row] -= factor * b[col];
    }
  }
  // Back substitution
  const h = new Float64Array(8);
  for (let i = 7; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < 8; j++) s -= A[i * 8 + j] * h[j];
    h[i] = s / A[i * 8 + i];
  }
  // Return 3x3 homography [h0..h7, 1]
  const H = new Float64Array(9);
  for (let i = 0; i < 8; i++) H[i] = h[i];
  H[8] = 1;
  return H;
}

// ---------------------------------------------------------------------------
// LSD-based card quadrilateral detection
// ---------------------------------------------------------------------------

let _quadDebug = ''; // temporary debug info
function findCardQuadrilateral(
  segments: LineSegment[],
  w: number,
  h: number,
): { x: number; y: number }[] | null {
  _quadDebug = '';
  const sideMargin = w * 0.03;
  const topMargin = h * 0.03;
  const bottomMargin = h * 0.18; // exclude MacBook bezel / desk edge
  const filtered = segments.filter(s => {
    // Check BOTH endpoints to exclude segments crossing into border zones
    return s.x1 > sideMargin && s.x2 > sideMargin &&
           s.x1 < w - sideMargin && s.x2 < w - sideMargin &&
           s.y1 > topMargin && s.y2 > topMargin &&
           s.y1 < h - bottomMargin && s.y2 < h - bottomMargin &&
           // Reject very long segments (desk edges, MacBook frame)
           s.length < Math.sqrt(w * w + h * h) * 0.35;
  });
  _quadDebug = `in=${segments.length} filt=${filtered.length}`;
  if (filtered.length < 4) return null;
  segments = filtered;

  const minArea = w * h * 0.03;
  const maxArea = w * h * 0.25;
  const margin = 10;

  interface AngleGroup {
    segments: LineSegment[];
    meanAngle: number;
    totalLength: number;
  }

  const groups: AngleGroup[] = [];
  const ANGLE_GROUP_TOL = (15 * Math.PI) / 180;

  for (const seg of segments) {
    let placed = false;
    for (const g of groups) {
      let diff = Math.abs(seg.angle - g.meanAngle);
      if (diff > Math.PI / 2) diff = Math.PI - diff;
      if (diff < ANGLE_GROUP_TOL) {
        g.segments.push(seg);
        g.totalLength += seg.length;
        let sum = 0;
        for (const s of g.segments) sum += s.angle;
        g.meanAngle = sum / g.segments.length;
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push({
        segments: [seg],
        meanAngle: seg.angle,
        totalLength: seg.length,
      });
    }
  }

  groups.sort((a, b) => b.totalLength - a.totalLength);

  let group1: AngleGroup | null = null;
  let group2: AngleGroup | null = null;

  for (let i = 0; i < groups.length && !group2; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      let angleDiff = Math.abs(groups[i].meanAngle - groups[j].meanAngle);
      if (angleDiff > Math.PI / 2) angleDiff = Math.PI - angleDiff;
      const perpDiff = Math.abs(angleDiff - Math.PI / 2);
      if (perpDiff < (20 * Math.PI) / 180) {
        group1 = groups[i];
        group2 = groups[j];
        break;
      }
    }
  }

  _quadDebug += ` grps=${groups.length} perp=${group1 && group2 ? 'Y' : 'N'}`;
  if (group1 && group2) {
    _quadDebug += ` g1=${group1.segments.length}@${(group1.meanAngle * 180 / Math.PI).toFixed(0)}° g2=${group2.segments.length}@${(group2.meanAngle * 180 / Math.PI).toFixed(0)}°`;
  }
  if (!group1 || !group2) return null;

  const MAX_PER_GROUP = 15;
  const lines1 = group1.segments.slice(0, MAX_PER_GROUP);
  const lines2 = group2.segments.slice(0, MAX_PER_GROUP);

  if (lines1.length < 2 || lines2.length < 2) return null;

  let bestScore = 0;
  let bestCorners: { x: number; y: number }[] | null = null;

  for (let a = 0; a < lines1.length; a++) {
    for (let b = a + 1; b < lines1.length; b++) {
      for (let c = 0; c < lines2.length; c++) {
        for (let d = c + 1; d < lines2.length; d++) {
          const fourLines = [lines1[a], lines1[b], lines2[c], lines2[d]];

          const corners: { x: number; y: number }[] = [];
          for (const la of [lines1[a], lines1[b]]) {
            for (const lb of [lines2[c], lines2[d]]) {
              const pt = intersectSegmentLines(la, lb);
              if (pt) corners.push(pt);
            }
          }

          if (corners.length !== 4) continue;

          let inBounds = true;
          for (const c2 of corners) {
            if (c2.x < margin || c2.y < margin || c2.x >= w - margin || c2.y >= h - margin) {
              inBounds = false;
              break;
            }
          }
          if (!inBounds) continue;

          const sorted = sortCorners(corners);
          if (!isConvexQuad(sorted)) continue;

          const area = quadArea(sorted);
          if (area < minArea || area > maxArea) continue;

          const sides: number[] = [];
          for (let si = 0; si < 4; si++) {
            const sa = sorted[si], sb = sorted[(si + 1) % 4];
            sides.push(Math.sqrt((sb.x - sa.x) ** 2 + (sb.y - sa.y) ** 2));
          }
          const minSide = Math.min(...sides), maxSide = Math.max(...sides);
          if (minSide < maxSide * 0.15) continue;

          // Rectangularity: opposite sides must be roughly parallel and equal
          const parallelRatio0 = Math.min(sides[0], sides[2]) / Math.max(sides[0], sides[2]);
          const parallelRatio1 = Math.min(sides[1], sides[3]) / Math.max(sides[1], sides[3]);
          if (parallelRatio0 < 0.2 || parallelRatio1 < 0.2) continue; // opposite sides too different

          // Check angles at corners are roughly 90° (dot product near 0)
          let minAngleCos = 1;
          for (let ai = 0; ai < 4; ai++) {
            const p = sorted[ai], q = sorted[(ai + 1) % 4], r = sorted[(ai + 2) % 4];
            const v1x = p.x - q.x, v1y = p.y - q.y;
            const v2x = r.x - q.x, v2y = r.y - q.y;
            const len1 = Math.sqrt(v1x*v1x + v1y*v1y) || 1;
            const len2 = Math.sqrt(v2x*v2x + v2y*v2y) || 1;
            const cosAngle = Math.abs((v1x*v2x + v1y*v2y) / (len1 * len2));
            if (cosAngle < minAngleCos) minAngleCos = cosAngle;
          }
          // cosAngle should be near 0 for 90° — reject if any angle > ~60° or < ~120°
          const maxCosAngle = Math.max(...[0,1,2,3].map(ai => {
            const p = sorted[ai], q = sorted[(ai+1)%4], r = sorted[(ai+2)%4];
            const v1x = p.x-q.x, v1y = p.y-q.y, v2x = r.x-q.x, v2y = r.y-q.y;
            return Math.abs((v1x*v2x+v1y*v2y) / ((Math.sqrt(v1x*v1x+v1y*v1y)||1) * (Math.sqrt(v2x*v2x+v2y*v2y)||1)));
          }));
          if (maxCosAngle > 0.75) continue; // allow up to ~41° deviation from right angle

          const aspect = Math.min(
            (sides[0] + sides[2]) / 2,
            (sides[1] + sides[3]) / 2,
          ) / Math.max(
            (sides[0] + sides[2]) / 2,
            (sides[1] + sides[3]) / 2,
          );
          const aspectMatch = 1 - Math.abs(aspect - 5 / 7) * 3;
          if (aspectMatch < -0.3) continue; // tighter aspect filter

          const totalLen = fourLines.reduce((s2, l) => s2 + l.length, 0);
          // Prefer card-sized quads. Soft Gaussian-like penalty around ideal size.
          const idealArea = w * h * 0.12;
          const logRatio = Math.log(area / idealArea);
          const sizePenalty = Math.exp(-logRatio * logRatio * 2);
          // Bonus for rectangular shapes (low maxCosAngle = closer to 90° corners)
          const rectBonus = 1 - maxCosAngle; // 1.0 for perfect right angles, 0.35 at threshold
          const score = area * Math.max(0.1, aspectMatch) * sizePenalty * rectBonus * totalLen;

          if (score > bestScore) {
            bestScore = score;
            bestCorners = sorted;
          }
        }
      }
    }
  }

  return bestCorners;
}

function intersectSegmentLines(
  s1: LineSegment,
  s2: LineSegment,
): { x: number; y: number } | null {
  const d1x = s1.x2 - s1.x1, d1y = s1.y2 - s1.y1;
  const d2x = s2.x2 - s2.x1, d2y = s2.y2 - s2.y1;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-6) return null;
  const dx = s2.x1 - s1.x1, dy = s2.y1 - s1.y1;
  const t = (dx * d2y - dy * d2x) / cross;
  return { x: s1.x1 + t * d1x, y: s1.y1 + t * d1y };
}

function isConvexQuad(pts: { x: number; y: number }[]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4], c = pts[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (sign === 0) sign = cross > 0 ? 1 : -1;
    else if ((cross > 0 ? 1 : -1) !== sign) return false;
  }
  return true;
}

function quadArea(pts: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

const cardDetectionDemo: DemoDefinition = {
  id: 'cardDetection',
  title: 'Trading Card Detection',
  category: 'Detection',
  description: 'Detects rectangular cards via edge detection and perspective-corrects them.',
  controls: [
    { type: 'slider', key: 'blurKernel', label: 'Blur Kernel', min: 3, max: 21, step: 2, defaultNum: 9 },
    { type: 'slider', key: 'lsdMinLength', label: 'LSD Min Length', min: 10, max: 200, step: 5, defaultNum: 40 },
    { type: 'slider', key: 'minContourArea', label: 'Min Area', min: 200, max: 50000, step: 100, defaultNum: 1000 },
  ],
  setup(_canvas, _video, params) {
    _cardParams = {
      blurKernel: 9, lsdMinLength: 40, minContourArea: 1000,
      ...params,
    };
  },
  process(ctx, video, w, h, profiler) {
    if (video.readyState >= 2) {
      drawVideoFrame(ctx, video, w, h);
    }
    const imageData = ctx.getImageData(0, 0, w, h);

    if (!_cardGray || _cardGray.cols !== w || _cardGray.rows !== h) {
      _cardGray = new Matrix(w, h, U8C1);
      _cardBlurred = new Matrix(w, h, U8C1);
      _cardEdges = new Matrix(w, h, U8C1);
    }
    if (!_cardScharr) _cardScharr = new Matrix(w, h, S32C2);
    _cardScharr.resize(w, h, 2);

    profiler.start('grayscale');
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, _cardGray);
    profiler.end('grayscale');

    const gd = _cardGray!.data;
    let brightSum = 0;
    for (let i = 0; i < w * h; i++) brightSum += gd[i];
    if (brightSum / (w * h) < 100) {
      equalizeHistogram(_cardGray!, _cardGray!);
    }

    profiler.start('blur');
    let ks = _cardParams.blurKernel ?? 9;
    if (ks % 2 === 0) ks += 1;
    const detKs = Math.max(ks, 15) | 1;
    gaussianBlur(_cardGray, _cardBlurred!, detKs, 0);
    profiler.end('blur');

    // ===================================================================
    // STAGE 1: Morph blob to find rough card region
    // ===================================================================
    profiler.start('canny');
    cannyEdges(_cardBlurred!, _cardEdges!, 20, 60);
    profiler.end('canny');

    profiler.start('morph');
    const ed = _cardEdges!.data;
    // Scharr gradient merge
    scharrDerivatives(_cardBlurred!, _cardScharr!);
    const sd = _cardScharr!.data;
    for (let i = 0; i < w * h; i++) {
      const mag = Math.min(255, (Math.abs(sd[i * 2]) + Math.abs(sd[i * 2 + 1])) >> 3);
      if (mag > 30) ed[i] = 255;
    }
    // Warmth + Chroma edge merge
    const rgba = imageData.data;
    const colorBuf = _cardGray!;
    const cbd = colorBuf.data;
    for (let i = 0; i < w * h; i++) {
      cbd[i] = Math.min(255, Math.max(0, 128 + rgba[i * 4] - rgba[i * 4 + 2]));
    }
    gaussianBlur(colorBuf, colorBuf, detKs, 0);
    scharrDerivatives(colorBuf, _cardScharr);
    for (let i = 0; i < w * h; i++) {
      const px = i % w, py = (i / w) | 0;
      if (px < 30 || py < 30 || px >= w - 30 || py >= h - 30) continue;
      const wmag = Math.min(255, (Math.abs(sd[i * 2]) + Math.abs(sd[i * 2 + 1])) >> 3);
      if (wmag > 25) ed[i] = 255;
    }
    for (let i = 0; i < w * h; i++) {
      const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
      cbd[i] = Math.max(r, g, b) - Math.min(r, g, b);
    }
    gaussianBlur(colorBuf, colorBuf, detKs, 0);
    scharrDerivatives(colorBuf, _cardScharr);
    for (let i = 0; i < w * h; i++) {
      const px = i % w, py = (i / w) | 0;
      if (px < 30 || py < 30 || px >= w - 30 || py >= h - 30) continue;
      const cmag = Math.min(255, (Math.abs(sd[i * 2]) + Math.abs(sd[i * 2 + 1])) >> 3);
      if (cmag > 30) ed[i] = 255;
    }
    // Restore grayscale Scharr
    scharrDerivatives(_cardBlurred!, _cardScharr!);
    _cardGray!.data.set(_cardEdges!.data);
    // Morph blob
    boxBlurGray(_cardEdges!, _cardBlurred!, 5);
    const bd = _cardBlurred!.data;
    let densitySum = 0;
    for (let i = 0; i < w * h; i++) densitySum += bd[i];
    const meanDensity = densitySum / (w * h);
    const rawThresh = Math.max(8, meanDensity + 7);
    _cardPrevThreshold = _cardPrevThreshold > 0 ? _cardPrevThreshold * 0.7 + rawThresh * 0.3 : rawThresh;
    for (let i = 0; i < w * h; i++) ed[i] = bd[i] > _cardPrevThreshold ? 255 : 0;
    // Erosion
    boxBlurGray(_cardEdges!, _cardBlurred!, 2);
    for (let i = 0; i < w * h; i++) ed[i] = bd[i] > 200 ? 255 : 0;
    profiler.end('morph');

    // Find largest card-like contour for ROI
    const contours = findContours(_cardEdges!);
    _cardLastContours = contours;
    let roiRect: { x: number; y: number; width: number; height: number } | null = null;
    const minArea = Math.max(_cardParams.minContourArea ?? 1000, w * h * 0.03);
    for (const contour of contours) {
      if (contour.area < minArea || contour.area > w * h * 0.4) continue;
      const br = contour.boundingRect;
      if (br.x <= 3 || br.y <= 3 || br.x + br.width >= w - 3 || br.y + br.height >= h - 3) continue;
      const aspect = Math.min(br.width, br.height) / Math.max(br.width, br.height);
      if (aspect < 0.3) continue;
      if (!roiRect || contour.area > (roiRect.width * roiRect.height)) {
        roiRect = br;
      }
    }

    // ===================================================================
    // STAGE 2: LSD within ROI (or full image if no ROI)
    // ===================================================================
    profiler.start('lsd');
    const minLen = _cardParams.lsdMinLength ?? 40;
    const allSegments: LineSegment[] = [];
    const lsdKs = Math.max(ks, 9) | 1;

    // Multi-channel LSD
    gaussianBlur(_cardGray!, _cardEdges!, lsdKs, 0);
    scharrDerivatives(_cardEdges!, _cardScharr!);
    allSegments.push(...detectLineSegments(_cardScharr!, minLen, 5));

    for (let i = 0; i < w * h; i++) {
      cbd[i] = Math.min(255, Math.max(0, 128 + rgba[i * 4] - rgba[i * 4 + 2]));
    }
    gaussianBlur(colorBuf, colorBuf, lsdKs, 0);
    scharrDerivatives(colorBuf, _cardScharr);
    allSegments.push(...detectLineSegments(_cardScharr!, minLen, 5));

    for (let i = 0; i < w * h; i++) {
      const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
      cbd[i] = Math.max(r, g, b) - Math.min(r, g, b);
    }
    gaussianBlur(colorBuf, colorBuf, lsdKs, 0);
    scharrDerivatives(colorBuf, _cardScharr);
    allSegments.push(...detectLineSegments(_cardScharr!, minLen, 5));

    // Filter segments to ROI (expanded 30%) if available
    let mergedSegments: LineSegment[];
    if (roiRect) {
      const expand = 0.3;
      const ex = roiRect.width * expand, ey = roiRect.height * expand;
      const rx0 = Math.max(0, roiRect.x - ex);
      const ry0 = Math.max(0, roiRect.y - ey);
      const rx1 = Math.min(w, roiRect.x + roiRect.width + ex);
      const ry1 = Math.min(h, roiRect.y + roiRect.height + ey);
      const roiFiltered = allSegments.filter(s => {
        const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
        return mx >= rx0 && mx <= rx1 && my >= ry0 && my <= ry1;
      });
      mergedSegments = roiFiltered.sort((a, b) => b.length - a.length).slice(0, 200);
    } else {
      mergedSegments = allSegments.sort((a, b) => b.length - a.length).slice(0, 300);
    }
    _cardLsdSegments = mergedSegments;

    scharrDerivatives(_cardBlurred!, _cardScharr!);
    profiler.end('lsd');

    // ===================================================================
    // STAGE 3: Quad grouping from filtered LSD segments
    // ===================================================================
    profiler.start('quad');
    let detected = false;
    let cardCorners: { x: number; y: number }[] = [];
    _cardDebugInfo = '';
    _cardLsdWinningLines = [];

    const quadResult = findCardQuadrilateral(mergedSegments, w, h);
    if (quadResult) {
      detected = true;
      cardCorners = quadResult;
      _cardDebugInfo = `LSD roi=${roiRect ? 'Y' : 'N'} segs=${mergedSegments.length}`;
    }

    // FALLBACK: If LSD quad grouping fails, use morph blob contour + approxPoly
    // This preserves the 37/48 baseline from the morph blob approach.
    if (!detected) {
      const minArea2 = Math.max(_cardParams.minContourArea ?? 1000, w * h * 0.03);
      let bestScore = 0;
      for (const contour of _cardLastContours) {
        if (contour.area < minArea2 || contour.area > w * h * 0.4) continue;
        const br = contour.boundingRect;
        if (br.x <= 3 || br.y <= 3 || br.x + br.width >= w - 3 || br.y + br.height >= h - 3) continue;
        const aspect = Math.min(br.width, br.height) / Math.max(br.width, br.height);
        if (aspect < 0.35) continue;
        const targetAspect = 5 / 7;
        const aspectMatch = 1 - Math.abs(aspect - targetAspect) * 3;
        if (aspectMatch < 0) continue;

        // Convex hull + approxPoly (same as master pipeline)
        const pts = contour.points;
        const hullPts: { x: number; y: number }[] = [];
        if (pts.length >= 4) {
          let startIdx = 0;
          for (let pi = 1; pi < pts.length; pi++) {
            if (pts[pi].y > pts[startIdx].y || (pts[pi].y === pts[startIdx].y && pts[pi].x > pts[startIdx].x)) startIdx = pi;
          }
          const start = pts[startIdx];
          const sorted = pts.slice().sort((a2, b2) => {
            const angA = Math.atan2(a2.y - start.y, a2.x - start.x);
            const angB = Math.atan2(b2.y - start.y, b2.x - start.x);
            return angA - angB || ((a2.x - start.x) ** 2 + (a2.y - start.y) ** 2) - ((b2.x - start.x) ** 2 + (b2.y - start.y) ** 2);
          });
          for (const p of sorted) {
            while (hullPts.length >= 2) {
              const a2 = hullPts[hullPts.length - 2], b2 = hullPts[hullPts.length - 1];
              if ((b2.x - a2.x) * (p.y - a2.y) - (b2.y - a2.y) * (p.x - a2.x) <= 0) hullPts.pop();
              else break;
            }
            hullPts.push(p);
          }
        }
        const hullContour = hullPts.length >= 4 ? {
          points: hullPts, area: contour.area,
          perimeter: hullPts.reduce((sum, p, i2) => { const n = hullPts[(i2 + 1) % hullPts.length]; return sum + Math.sqrt((n.x - p.x) ** 2 + (n.y - p.y) ** 2); }, 0),
          boundingRect: contour.boundingRect,
        } : contour;

        let poly = approxPoly(hullContour, hullContour.perimeter * 0.02);
        for (let ep = 0.04; poly.length > 4 && ep <= 0.15; ep += 0.02) poly = approxPoly(hullContour, hullContour.perimeter * ep);
        if (poly.length === 5) {
          let minDist2 = Infinity, mergeIdx = 0;
          for (let pi = 0; pi < 5; pi++) {
            const ni = (pi + 1) % 5;
            const d = (poly[ni].x - poly[pi].x) ** 2 + (poly[ni].y - poly[pi].y) ** 2;
            if (d < minDist2) { minDist2 = d; mergeIdx = pi; }
          }
          const ni = (mergeIdx + 1) % 5;
          const mid = { x: (poly[mergeIdx].x + poly[ni].x) / 2, y: (poly[mergeIdx].y + poly[ni].y) / 2 };
          poly = poly.filter((_2, i2) => i2 !== ni).map((p, i2) => i2 === mergeIdx ? mid : p);
        }
        if (poly.length < 4) continue;

        const rectFill = contour.area / (br.width * br.height);
        const ptPenalty = poly.length === 4 ? 1 : 0.7;
        const score = contour.area * Math.max(0.3, rectFill) * (0.3 + aspectMatch) * ptPenalty;
        if (score > bestScore) {
          bestScore = score;
          detected = true;
          _cardLastRectFill = rectFill;
          _cardLastAspect = aspect;
          if (poly.length === 4) {
            const sq = sortCorners(poly);
            const sides2: number[] = [];
            for (let si2 = 0; si2 < 4; si2++) {
              const sa = sq[si2], sb = sq[(si2 + 1) % 4];
              sides2.push(Math.sqrt((sb.x - sa.x) ** 2 + (sb.y - sa.y) ** 2));
            }
            const maxS = Math.max(...sides2), minS = Math.min(...sides2);
            cardCorners = (minS > maxS * 0.2) ? sq : buildCardCorners(br);
          } else {
            cardCorners = buildCardCorners(br);
          }
          _cardDebugInfo = `MORPH a=${contour.area} asp=${aspect.toFixed(2)} rf=${rectFill.toFixed(2)}`;
        }
      }
    }
    profiler.end('quad');

    // Pipeline HUD overlay
    if (_cardShowPipelineOverlays) {
      const sd = _cardScharr!.data;
      const ds = 4, dw = (w / ds) | 0, dh = (h / ds) | 0;
      const di = ctx.createImageData(dw, dh);
      const dd = di.data;
      for (let dy2 = 0; dy2 < dh; dy2++) {
        for (let dx2 = 0; dx2 < dw; dx2++) {
          const si = (dy2 * ds) * w + (dx2 * ds);
          const mag = Math.min(255, (Math.abs(sd[si * 2]) + Math.abs(sd[si * 2 + 1])) >> 3);
          const oi = (dy2 * dw + dx2) * 4;
          dd[oi] = 0; dd[oi + 1] = mag; dd[oi + 2] = 0; dd[oi + 3] = 200;
        }
      }
      ctx.putImageData(di, 4, 4);
      ctx.strokeStyle = '#0f0'; ctx.lineWidth = 1;
      ctx.strokeRect(3, 3, dw + 2, dh + 2);
      ctx.fillStyle = '#0f0'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
      ctx.fillText('gradient', 6, dh + 16);

      // Draw LSD segments
      ctx.lineWidth = 1;
      for (const seg of mergedSegments) {
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      }

      // Detection status
      ctx.font = '12px monospace'; ctx.textAlign = 'left';
      if (detected) {
        ctx.fillStyle = '#0f0';
        ctx.fillText(`Card detected | ${_cardDebugInfo}`, 6, h - 8);
      } else {
        ctx.fillStyle = '#f00';
        ctx.fillText(`No card found | segs=${mergedSegments.length} | ${_quadDebug}`, 6, h - 8);
      }

      // Draw detected quad
      if (detected) {
        ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cardCorners[0].x, cardCorners[0].y);
        for (let i2 = 1; i2 < 4; i2++) ctx.lineTo(cardCorners[i2].x, cardCorners[i2].y);
        ctx.closePath();
        ctx.stroke();
      }

      // Quality history
      const qh = _cardQualityHistory;
      if (detected && cardCorners.length === 4) {
        const sides: number[] = [];
        for (let i2 = 0; i2 < 4; i2++) {
          const a2 = cardCorners[i2], b2 = cardCorners[(i2 + 1) % 4];
          sides.push(Math.sqrt((b2.x - a2.x) ** 2 + (b2.y - a2.y) ** 2));
        }
        const aspect = Math.min((sides[0]+sides[2])/2, (sides[1]+sides[3])/2) /
                       Math.max((sides[0]+sides[2])/2, (sides[1]+sides[3])/2);
        _cardLastRectFill = 0;
        _cardLastAspect = aspect;
        const q = Math.max(0, 1 - Math.abs(aspect - 5/7) * 3);
        qh.push(q);
        if (qh.length > 60) qh.shift();
      }
    }

    // Temporal smoothing
    const SMOOTHING = 0.7;
    if (detected && cardCorners.length === 4) {
      _cardGraceFrames = 0;
      if (_cardSmoothedCorners) {
        let maxJump = 0;
        for (let i2 = 0; i2 < 4; i2++) {
          const dx2 = cardCorners[i2].x - _cardSmoothedCorners[i2].x;
          const dy2 = cardCorners[i2].y - _cardSmoothedCorners[i2].y;
          maxJump = Math.max(maxJump, Math.sqrt(dx2 * dx2 + dy2 * dy2));
        }
        if (maxJump > 80) {
          _cardSmoothedCorners = cardCorners.map(p => ({ ...p }));
        } else {
          for (let i2 = 0; i2 < 4; i2++) {
            _cardSmoothedCorners[i2].x = _cardSmoothedCorners[i2].x * SMOOTHING + cardCorners[i2].x * (1 - SMOOTHING);
            _cardSmoothedCorners[i2].y = _cardSmoothedCorners[i2].y * SMOOTHING + cardCorners[i2].y * (1 - SMOOTHING);
          }
        }
        cardCorners = _cardSmoothedCorners;
      } else {
        _cardSmoothedCorners = cardCorners.map(p => ({ ...p }));
      }
    } else if (!detected && _cardSmoothedCorners) {
      _cardGraceFrames++;
      if (_cardGraceFrames > 12) {
        _cardSmoothedCorners = null;
        _cardGraceFrames = 0;
      } else {
        detected = true;
        cardCorners = _cardSmoothedCorners;
      }
    }

    if (detected && cardCorners.length === 4 && !_cardShowPipelineOverlays) {
      ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardCorners[0].x, cardCorners[0].y);
      for (let ci = 1; ci < 4; ci++) ctx.lineTo(cardCorners[ci].x, cardCorners[ci].y);
      ctx.closePath();
      ctx.stroke();
    }
  },
  onParamChange(key, value) {
    _cardParams[key] = value;
  },
  cleanup() {
    _cardGray = null;
    _cardBlurred = null;
    _cardEdges = null;
    _cardScharr = null;
    _cardSmoothedCorners = null;
    _cardGraceFrames = 0;
    _cardLsdSegments = [];
    _cardLsdWinningLines = [];
  },
};

/** Expose card detection internal buffers for the debug workbench. */
/** Reset temporal state (smoothed corners, grace period, threshold) between images. */
export function resetCardTemporalState() {
  _cardSmoothedCorners = null;
  _cardGraceFrames = 0;
  _cardPrevThreshold = 0;
  _cardQualityHistory.length = 0;
  _cardLsdSegments = [];
  _cardLsdWinningLines = [];
}

export function getCardDebugBuffers() {
  return {
    gray: _cardGray,
    edges: _cardEdges,
    blurred: _cardBlurred,
    scharr: _cardScharr,
    smoothedCorners: _cardSmoothedCorners,
    debugInfo: _cardDebugInfo,
    qualityHistory: _cardQualityHistory,
    lastRectFill: _cardLastRectFill,
    lastAspect: _cardLastAspect,
    params: _cardParams,
    graceFrames: _cardGraceFrames,
    lsdSegments: _cardLsdSegments,
    lsdWinningLines: _cardLsdWinningLines,
  };
}

export { cardDetectionDemo };

// ---------------------------------------------------------------------------
// Side-by-Side Compare
// ---------------------------------------------------------------------------

let _compareParams: Record<string, any> = {};
let _compareGray: Matrix | null = null;
let _compareA: Matrix | null = null;
let _compareB: Matrix | null = null;
let _compareSobelA: Matrix | null = null;
let _compareSobelB: Matrix | null = null;

type FilterId = 'grayscale' | 'boxBlur' | 'gaussianBlur' | 'canny' | 'sobel' | 'scharr' | 'equalizeHist';

function applyFilter(
  id: FilterId, src: Matrix, dst: Matrix, w: number, h: number,
  sobelBuf: Matrix,
): void {
  switch (id) {
    case 'grayscale':
      src.copyTo(dst);
      break;
    case 'boxBlur':
      boxBlurGray(src, dst, 4);
      break;
    case 'gaussianBlur':
      gaussianBlur(src, dst, 5, 0);
      break;
    case 'canny':
      cannyEdges(src, dst, 30, 80);
      break;
    case 'sobel': {
      sobelBuf.resize(w, h, 2);
      sobelDerivatives(src, sobelBuf);
      const sd = sobelBuf.data, dd = dst.data;
      for (let i = 0; i < w * h; i++) {
        dd[i] = Math.min(255, (Math.abs(sd[i * 2]) + Math.abs(sd[i * 2 + 1])) >> 2);
      }
      break;
    }
    case 'scharr': {
      sobelBuf.resize(w, h, 2);
      scharrDerivatives(src, sobelBuf);
      const sd2 = sobelBuf.data, dd2 = dst.data;
      for (let i = 0; i < w * h; i++) {
        dd2[i] = Math.min(255, (Math.abs(sd2[i * 2]) + Math.abs(sd2[i * 2 + 1])) >> 2);
      }
      break;
    }
    case 'equalizeHist':
      equalizeHistogram(src, dst);
      break;
  }
}

const filterOptions: { value: string; label: string }[] = [
  { value: 'grayscale', label: 'Grayscale' },
  { value: 'boxBlur', label: 'Box Blur' },
  { value: 'gaussianBlur', label: 'Gaussian Blur' },
  { value: 'canny', label: 'Canny' },
  { value: 'sobel', label: 'Sobel' },
  { value: 'scharr', label: 'Scharr' },
  { value: 'equalizeHist', label: 'Equalize Hist' },
];

const compareDemo: DemoDefinition = {
  id: 'compare',
  title: 'Side-by-Side Compare',
  category: 'Extras',
  description: 'Compare two filters side by side with an adjustable split.',
  controls: [
    { type: 'select', key: 'filterA', label: 'Left Filter', options: filterOptions, defaultStr: 'grayscale' },
    { type: 'select', key: 'filterB', label: 'Right Filter', options: filterOptions, defaultStr: 'canny' },
    { type: 'slider', key: 'splitPos', label: 'Split %', min: 0, max: 100, step: 1, defaultNum: 50 },
  ],
  setup(_canvas, _video, params) {
    _compareParams = { filterA: 'grayscale', filterB: 'canny', splitPos: 50, ...params };
  },
  process(ctx, video, w, h, profiler) {
    drawVideoFrame(ctx, video, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    // Grayscale source
    if (!_compareGray || _compareGray.cols !== w || _compareGray.rows !== h) {
      _compareGray = new Matrix(w, h, U8C1);
      _compareA = new Matrix(w, h, U8C1);
      _compareB = new Matrix(w, h, U8C1);
      _compareSobelA = new Matrix(w, h, S32C2);
      _compareSobelB = new Matrix(w, h, S32C2);
    }

    profiler.start('grayscale');
    jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, _compareGray);
    profiler.end('grayscale');

    // Apply filters
    profiler.start('filterA');
    applyFilter(_compareParams.filterA as FilterId, _compareGray, _compareA!, w, h, _compareSobelA!);
    profiler.end('filterA');

    profiler.start('filterB');
    applyFilter(_compareParams.filterB as FilterId, _compareGray, _compareB!, w, h, _compareSobelB!);
    profiler.end('filterB');

    // Render split-screen
    const splitX = (((_compareParams.splitPos ?? 50) / 100) * w) | 0;
    const data = imageData.data;
    const dA = _compareA!.data, dB = _compareB!.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const di = (y * w + x) * 4;
        const v = x < splitX ? dA[y * w + x] : dB[y * w + x];
        data[di] = v; data[di + 1] = v; data[di + 2] = v; data[di + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Divider line
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, h);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#ff0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    const nameA = filterOptions.find(o => o.value === _compareParams.filterA)?.label ?? _compareParams.filterA;
    const nameB = filterOptions.find(o => o.value === _compareParams.filterB)?.label ?? _compareParams.filterB;
    ctx.fillText(nameA, splitX / 2, 16);
    ctx.fillText(nameB, splitX + (w - splitX) / 2, 16);
  },
  onParamChange(key, value) {
    _compareParams[key] = value;
  },
  cleanup() {
    _compareGray = null;
    _compareA = null;
    _compareB = null;
    _compareSobelA = null;
    _compareSobelB = null;
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

  // Detection
  cardDetectionDemo,
  haarFaceDemo,
  bbfFaceDemo,

  // Motion
  opticalFlowDemo,
  videoStabDemo,

  // Transforms
  warpAffineDemo,
  homographyDemo,

  // Extras
  compareDemo,
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
