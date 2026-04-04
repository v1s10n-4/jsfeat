/**
 * Stage registry -- defines all available pipeline stages for the Pipeline Studio.
 *
 * Each stage wraps a jsfeat function and exposes controls (sliders, selects, checkboxes)
 * that the UI renders inline on its card.
 */

import { Matrix, Keypoint, U8C1, S32C2 } from 'jsfeat/core';
import {
  grayscale as jfGrayscale,
  boxBlurGray,
  gaussianBlur,
  pyrDown,
  equalizeHistogram,
  cannyEdges,
  sobelDerivatives,
  scharrDerivatives,
  resample,
  computeIntegralImage,
} from 'jsfeat/imgproc';
import { fastCorners, yape06Detect } from 'jsfeat/features';
import {
  haarDetectMultiScale,
  groupRectangles,
  bbfPrepareCascade,
  bbfBuildPyramid,
  bbfDetect,
  bbfGroupRectangles,
} from 'jsfeat/detect';
import { frontalface, bbfFace } from 'jsfeat/cascades';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StageControl {
  type: 'slider' | 'select' | 'checkbox';
  key: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  defaultNum?: number;
  options?: { value: string; label: string }[];
  defaultStr?: string;
  defaultBool?: boolean;
}

export interface StageDefinition {
  id: string;
  name: string;
  category: string;
  icon: string; // lucide icon name
  controls: StageControl[];
  /** Called once when stage is added. */
  init?: () => void;
  /**
   * Called each frame. Reads from ctx, writes results back.
   * `gray` is the current grayscale matrix. `params` has the control values.
   */
  process: (
    ctx: CanvasRenderingContext2D,
    gray: Matrix,
    w: number,
    h: number,
    params: Record<string, any>,
    imageData: ImageData,
  ) => void;
}

// ---------------------------------------------------------------------------
// Shared scratch buffers (reused across frames to avoid allocations)
// ---------------------------------------------------------------------------

let _scratchGray: Matrix | null = null;
let _scratchDst: Matrix | null = null;
let _scratchS32: Matrix | null = null;
let _cornersPool: Keypoint[] = [];

function getScratchGray(w: number, h: number): Matrix {
  if (!_scratchGray || _scratchGray.cols !== w || _scratchGray.rows !== h) {
    _scratchGray = new Matrix(w, h, U8C1);
  }
  return _scratchGray;
}

function getScratchDst(w: number, h: number): Matrix {
  if (!_scratchDst || _scratchDst.cols !== w || _scratchDst.rows !== h) {
    _scratchDst = new Matrix(w, h, U8C1);
  }
  return _scratchDst;
}

function getScratchS32(w: number, h: number): Matrix {
  if (!_scratchS32 || _scratchS32.cols !== w || _scratchS32.rows !== h) {
    _scratchS32 = new Matrix(w, h, S32C2);
  }
  return _scratchS32;
}

function getCornersPool(maxCount: number): Keypoint[] {
  while (_cornersPool.length < maxCount) {
    _cornersPool.push(new Keypoint());
  }
  return _cornersPool;
}

// ---------------------------------------------------------------------------
// Haar helpers -- integral images
// ---------------------------------------------------------------------------

let _iiSum: Int32Array | null = null;
let _iiSqSum: Int32Array | null = null;
let _iiTilted: Int32Array | null = null;

function getIntegralBuffers(w: number, h: number) {
  const sz = (w + 1) * (h + 1);
  if (!_iiSum || _iiSum.length < sz) {
    _iiSum = new Int32Array(sz);
    _iiSqSum = new Int32Array(sz);
    _iiTilted = new Int32Array(sz);
  }
  return { iiSum: _iiSum, iiSqSum: _iiSqSum!, iiTilted: _iiTilted! };
}

// BBF cascade prepared flag
let _bbfPrepared = false;

// ---------------------------------------------------------------------------
// Stage definitions
// ---------------------------------------------------------------------------

const definitions: StageDefinition[] = [
  // 1. Grayscale
  {
    id: 'grayscale',
    name: 'Grayscale',
    category: 'Conversion',
    icon: 'Image',
    controls: [],
    process(_ctx, gray, w, h, _params, imageData) {
      gray.resize(w, h, 1);
      jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, gray);
    },
  },

  // 2. Box Blur
  {
    id: 'boxBlur',
    name: 'Box Blur',
    category: 'Filters',
    icon: 'Square',
    controls: [
      { type: 'slider', key: 'radius', label: 'Radius', min: 1, max: 20, step: 1, defaultNum: 4 },
    ],
    process(_ctx, gray, w, h, params) {
      const dst = getScratchDst(w, h);
      const radius = params.radius ?? 4;
      boxBlurGray(gray, dst, radius);
      dst.copyTo(gray);
    },
  },

  // 3. Gaussian Blur
  {
    id: 'gaussianBlur',
    name: 'Gaussian Blur',
    category: 'Filters',
    icon: 'Circle',
    controls: [
      { type: 'slider', key: 'kernelSize', label: 'Kernel', min: 3, max: 15, step: 2, defaultNum: 5 },
      { type: 'slider', key: 'sigma', label: 'Sigma', min: 0, max: 10, step: 0.5, defaultNum: 0 },
    ],
    process(_ctx, gray, w, h, params) {
      const dst = getScratchDst(w, h);
      let ks = params.kernelSize ?? 5;
      // Ensure kernel size is odd
      if (ks % 2 === 0) ks += 1;
      const sigma = params.sigma ?? 0;
      gaussianBlur(gray, dst, ks, sigma);
      dst.copyTo(gray);
    },
  },

  // 4. Pyramid Down
  {
    id: 'pyrDown',
    name: 'Pyramid Down',
    category: 'Filters',
    icon: 'Triangle',
    controls: [
      { type: 'slider', key: 'levels', label: 'Levels', min: 1, max: 4, step: 1, defaultNum: 1 },
    ],
    process(_ctx, gray, _w, _h, params) {
      const levels = params.levels ?? 1;
      const dst = getScratchDst(gray.cols, gray.rows);
      for (let i = 0; i < levels; i++) {
        pyrDown(i === 0 ? gray : dst, dst);
      }
      // Copy downsampled result back — note dimensions changed
      gray.resize(dst.cols, dst.rows, 1);
      dst.copyTo(gray);
    },
  },

  // 5. Equalize Histogram
  {
    id: 'equalizeHist',
    name: 'Equalize Histogram',
    category: 'Filters',
    icon: 'BarChart3',
    controls: [],
    process(_ctx, gray, w, h) {
      const dst = getScratchDst(w, h);
      equalizeHistogram(gray, dst);
      dst.copyTo(gray);
    },
  },

  // 6. Canny Edges
  {
    id: 'canny',
    name: 'Canny Edges',
    category: 'Edge Detection',
    icon: 'Hexagon',
    controls: [
      { type: 'slider', key: 'low', label: 'Low', min: 1, max: 127, step: 1, defaultNum: 30 },
      { type: 'slider', key: 'high', label: 'High', min: 1, max: 255, step: 1, defaultNum: 80 },
    ],
    process(_ctx, gray, w, h, params) {
      const dst = getScratchDst(w, h);
      const low = params.low ?? 30;
      const high = params.high ?? 80;
      cannyEdges(gray, dst, low, high);
      dst.copyTo(gray);
    },
  },

  // 7. Sobel Derivatives
  {
    id: 'sobel',
    name: 'Sobel Derivatives',
    category: 'Edge Detection',
    icon: 'Layers',
    controls: [],
    process(ctx, gray, w, h, _params, imageData) {
      const dst = getScratchS32(w, h);
      sobelDerivatives(gray, dst);
      // Render dx as red, dy as green
      const data = imageData.data;
      const dd = dst.data;
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
  },

  // 8. Scharr Derivatives
  {
    id: 'scharr',
    name: 'Scharr Derivatives',
    category: 'Edge Detection',
    icon: 'Layers',
    controls: [],
    process(ctx, gray, w, h, _params, imageData) {
      const dst = getScratchS32(w, h);
      scharrDerivatives(gray, dst);
      const data = imageData.data;
      const dd = dst.data;
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
  },

  // 9. FAST Corners
  {
    id: 'fastCorners',
    name: 'FAST Corners',
    category: 'Feature Detection',
    icon: 'Crosshair',
    controls: [
      { type: 'slider', key: 'threshold', label: 'Threshold', min: 5, max: 100, step: 1, defaultNum: 20 },
      { type: 'slider', key: 'border', label: 'Border', min: 1, max: 10, step: 1, defaultNum: 3 },
    ],
    process(ctx, gray, _w, _h, params) {
      const threshold = params.threshold ?? 20;
      const border = params.border ?? 3;
      const corners = getCornersPool(gray.cols * gray.rows);
      const count = fastCorners(gray, corners, threshold, border);
      // Draw circles overlay
      ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
      for (let i = 0; i < count; i++) {
        const kp = corners[i];
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },

  // 10. YAPE06
  {
    id: 'yape06',
    name: 'YAPE06',
    category: 'Feature Detection',
    icon: 'Target',
    controls: [
      { type: 'slider', key: 'laplacianThreshold', label: 'Laplacian', min: 5, max: 100, step: 1, defaultNum: 30 },
      { type: 'slider', key: 'eigenThreshold', label: 'Eigen', min: 5, max: 100, step: 1, defaultNum: 25 },
    ],
    process(ctx, gray, _w, _h, params) {
      const lapTh = params.laplacianThreshold ?? 30;
      const eigTh = params.eigenThreshold ?? 25;
      const corners = getCornersPool(gray.cols * gray.rows);
      const count = yape06Detect(gray, corners, 5, lapTh, eigTh);
      ctx.fillStyle = 'rgba(255, 100, 0, 0.7)';
      for (let i = 0; i < count; i++) {
        const kp = corners[i];
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },

  // 11. Haar Face Detection
  {
    id: 'haarFace',
    name: 'Haar Face',
    category: 'Detection',
    icon: 'ScanFace',
    controls: [
      { type: 'slider', key: 'scaleFactor', label: 'Scale', min: 1.1, max: 2.0, step: 0.1, defaultNum: 1.2 },
    ],
    process(ctx, gray, w, h, params) {
      const scaleFactor = params.scaleFactor ?? 1.2;

      // Downsample for performance
      const maxDim = 160;
      const scale = Math.min(maxDim / w, maxDim / h, 1);
      const dw = (w * scale) | 0;
      const dh = (h * scale) | 0;

      let src = gray;
      if (scale < 1) {
        const small = getScratchGray(dw, dh);
        resample(gray, small, dw, dh);
        src = small;
      }

      // Compute integral images
      const { iiSum, iiSqSum, iiTilted } = getIntegralBuffers(dw, dh);
      computeIntegralImage(src, iiSum, iiSqSum, iiTilted);

      // Detect
      const rects = haarDetectMultiScale(iiSum, iiSqSum, iiTilted, null, dw, dh, frontalface, scaleFactor);
      const grouped = groupRectangles(rects, 1);

      // Draw boxes scaled back up
      const invScale = 1 / scale;
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      for (const r of grouped) {
        ctx.strokeRect(r.x * invScale, r.y * invScale, r.width * invScale, r.height * invScale);
      }
    },
  },

  // 12. BBF Face Detection
  {
    id: 'bbfFace',
    name: 'BBF Face',
    category: 'Detection',
    icon: 'ScanFace',
    controls: [
      { type: 'slider', key: 'scaleFactor', label: 'Scale', min: 1.1, max: 2.0, step: 0.1, defaultNum: 1.2 },
    ],
    init() {
      if (!_bbfPrepared) {
        bbfPrepareCascade(bbfFace);
        _bbfPrepared = true;
      }
    },
    process(ctx, gray, w, h, _params) {
      if (!_bbfPrepared) {
        bbfPrepareCascade(bbfFace);
        _bbfPrepared = true;
      }

      // Downsample for performance
      const maxDim = 160;
      const scale = Math.min(maxDim / w, maxDim / h, 1);
      const dw = (w * scale) | 0;
      const dh = (h * scale) | 0;

      let src = gray;
      if (scale < 1) {
        const small = getScratchGray(dw, dh);
        resample(gray, small, dw, dh);
        src = small;
      }

      const interval = Math.max(1, Math.round((_params.scaleFactor ?? 1.2) * 3));
      const pyr = bbfBuildPyramid(src, 24, 24, interval);
      const rects = bbfDetect(pyr, bbfFace);
      const grouped = bbfGroupRectangles(rects, 1);

      const invScale = 1 / scale;
      ctx.strokeStyle = '#ff0066';
      ctx.lineWidth = 2;
      for (const r of grouped) {
        ctx.strokeRect(r.x * invScale, r.y * invScale, r.width * invScale, r.height * invScale);
      }
    },
  },
];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const stageRegistry = new Map<string, StageDefinition>(
  definitions.map((d) => [d.id, d]),
);

/** Stages grouped by category, preserving definition order. */
export const stageCategories = (() => {
  const map = new Map<string, StageDefinition[]>();
  for (const d of definitions) {
    const arr = map.get(d.category) ?? [];
    arr.push(d);
    map.set(d.category, arr);
  }
  return map;
})();
