import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, S32C2, ColorCode } from 'jsfeat/core';
import {
  grayscale,
  boxBlurGray,
  gaussianBlur,
  cannyEdges,
  sobelDerivatives,
  scharrDerivatives,
  equalizeHistogram,
} from 'jsfeat/imgproc';

/* ------------------------------------------------------------------ *
 *  Filter application helpers
 * ------------------------------------------------------------------ */

type FilterName = 'grayscale' | 'boxBlur' | 'gaussianBlur' | 'canny' | 'sobel' | 'scharr' | 'equalize';

const FILTER_OPTIONS: { label: string; value: FilterName }[] = [
  { label: 'Grayscale', value: 'grayscale' },
  { label: 'Box Blur', value: 'boxBlur' },
  { label: 'Gaussian Blur', value: 'gaussianBlur' },
  { label: 'Canny Edges', value: 'canny' },
  { label: 'Sobel', value: 'sobel' },
  { label: 'Scharr', value: 'scharr' },
  { label: 'Equalize', value: 'equalize' },
];

/**
 * Apply a named filter to the grayscale source and write results into
 * the output matrix. The output is always U8C1 for rendering.
 */
function applyFilter(
  name: FilterName,
  src: Matrix,
  out: Matrix,
  tmp: Matrix,
  deriv: Matrix,
): void {
  const n = src.cols * src.rows;

  switch (name) {
    case 'grayscale':
      for (let i = 0; i < n; i++) out.data[i] = src.data[i];
      break;

    case 'boxBlur':
      boxBlurGray(src, out, 4);
      break;

    case 'gaussianBlur':
      // Copy src to out, then blur in-place
      for (let i = 0; i < n; i++) out.data[i] = src.data[i];
      gaussianBlur(out, out, 5, 0);
      break;

    case 'canny':
      cannyEdges(src, out, 20, 50);
      break;

    case 'sobel': {
      sobelDerivatives(src, deriv);
      const dd = deriv.data;
      for (let i = 0; i < n; i++) {
        const dx = dd[i * 2];
        const dy = dd[i * 2 + 1];
        out.data[i] = Math.min(255, (Math.abs(dx) + Math.abs(dy)) >> 2);
      }
      break;
    }

    case 'scharr': {
      scharrDerivatives(src, deriv);
      const dd2 = deriv.data;
      for (let i = 0; i < n; i++) {
        const dx = dd2[i * 2];
        const dy = dd2[i * 2 + 1];
        out.data[i] = Math.min(255, (Math.abs(dx) + Math.abs(dy)) >> 2);
      }
      break;
    }

    case 'equalize':
      equalizeHistogram(src, out);
      break;
  }
}

/* ------------------------------------------------------------------ *
 *  State
 * ------------------------------------------------------------------ */

let gray: Matrix | null = null;
let outA: Matrix | null = null;
let outB: Matrix | null = null;
let tmpMat: Matrix | null = null;
let derivMat: Matrix | null = null;

let filterA: FilterName = 'grayscale';
let filterB: FilterName = 'canny';
let splitPos = 50;

const demo: Demo = {
  title: 'Compare',
  category: 'Extras',
  description: 'Side-by-side comparison of two image filters with an adjustable split position.',

  controls: [
    {
      type: 'dropdown',
      key: 'filterA',
      label: 'Filter A (Left)',
      options: FILTER_OPTIONS,
      value: 'grayscale',
    },
    {
      type: 'dropdown',
      key: 'filterB',
      label: 'Filter B (Right)',
      options: FILTER_OPTIONS,
      value: 'canny',
    },
    {
      type: 'slider',
      key: 'splitPos',
      label: 'Split Position',
      min: 0,
      max: 100,
      step: 1,
      value: 50,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    gray = new Matrix(w, h, U8C1);
    outA = new Matrix(w, h, U8C1);
    outB = new Matrix(w, h, U8C1);
    tmpMat = new Matrix(w, h, U8C1);
    derivMat = new Matrix(w, h, S32C2);

    filterA = (params.filterA as FilterName) ?? 'grayscale';
    filterB = (params.filterB as FilterName) ?? 'canny';
    splitPos = (params.splitPos as number) ?? 50;
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray || !outA || !outB || !tmpMat || !derivMat) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    profiler.start('filterA');
    applyFilter(filterA, gray, outA, tmpMat, derivMat);
    profiler.end('filterA');

    profiler.start('filterB');
    applyFilter(filterB, gray, outB, tmpMat, derivMat);
    profiler.end('filterB');

    profiler.start('render');
    const splitX = ((splitPos / 100) * w) | 0;
    const pixels = imageData.data;
    const dataA = outA.data;
    const dataB = outB.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const j = y * w + x;
        const idx = j * 4;
        const v = x < splitX ? dataA[j] : dataB[j];
        pixels[idx] = v;
        pixels[idx + 1] = v;
        pixels[idx + 2] = v;
        pixels[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw divider line
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, h);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    if (splitX > 60) {
      ctx.fillText(filterA, splitX / 2, 20);
    }
    if (w - splitX > 60) {
      ctx.fillText(filterB, splitX + (w - splitX) / 2, 20);
    }
    ctx.textAlign = 'start';
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'filterA') filterA = value as FilterName;
    if (key === 'filterB') filterB = value as FilterName;
    if (key === 'splitPos') splitPos = value as number;
  },

  cleanup() {
    gray = null;
    outA = null;
    outB = null;
    tmpMat = null;
    derivMat = null;
  },
};

export default demo;
