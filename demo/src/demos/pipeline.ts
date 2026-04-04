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
 *  Stage operations
 * ------------------------------------------------------------------ */

type StageName = 'none' | 'grayscale' | 'boxBlur' | 'gaussianBlur' | 'canny' | 'sobel' | 'scharr' | 'equalize';

const STAGE_OPTIONS: { label: string; value: StageName }[] = [
  { label: 'None', value: 'none' },
  { label: 'Grayscale', value: 'grayscale' },
  { label: 'Box Blur', value: 'boxBlur' },
  { label: 'Gaussian Blur', value: 'gaussianBlur' },
  { label: 'Canny Edges', value: 'canny' },
  { label: 'Sobel', value: 'sobel' },
  { label: 'Scharr', value: 'scharr' },
  { label: 'Equalize', value: 'equalize' },
];

/**
 * Apply a stage operation in-place: reads from `src`, writes to `dst`.
 * For some operations (sobel/scharr), we need the deriv scratch buffer.
 * Returns true if the stage was applied.
 */
function applyStage(
  name: StageName,
  src: Matrix,
  dst: Matrix,
  deriv: Matrix,
): boolean {
  const n = src.cols * src.rows;

  switch (name) {
    case 'none':
      return false;

    case 'grayscale':
      // pass-through (already grayscale)
      for (let i = 0; i < n; i++) dst.data[i] = src.data[i];
      return true;

    case 'boxBlur':
      boxBlurGray(src, dst, 4);
      return true;

    case 'gaussianBlur':
      for (let i = 0; i < n; i++) dst.data[i] = src.data[i];
      gaussianBlur(dst, dst, 5, 0);
      return true;

    case 'canny':
      cannyEdges(src, dst, 20, 50);
      return true;

    case 'sobel': {
      sobelDerivatives(src, deriv);
      const dd = deriv.data;
      for (let i = 0; i < n; i++) {
        const dx = dd[i * 2];
        const dy = dd[i * 2 + 1];
        dst.data[i] = Math.min(255, (Math.abs(dx) + Math.abs(dy)) >> 2);
      }
      return true;
    }

    case 'scharr': {
      scharrDerivatives(src, deriv);
      const dd2 = deriv.data;
      for (let i = 0; i < n; i++) {
        const dx = dd2[i * 2];
        const dy = dd2[i * 2 + 1];
        dst.data[i] = Math.min(255, (Math.abs(dx) + Math.abs(dy)) >> 2);
      }
      return true;
    }

    case 'equalize':
      equalizeHistogram(src, dst);
      return true;
  }
}

/* ------------------------------------------------------------------ *
 *  State
 * ------------------------------------------------------------------ */

let gray: Matrix | null = null;
let bufA: Matrix | null = null;
let bufB: Matrix | null = null;
let derivMat: Matrix | null = null;

let stage1: StageName = 'none';
let stage2: StageName = 'none';
let stage3: StageName = 'none';

const demo: Demo = {
  title: 'Pipeline',
  category: 'Extras',
  description: 'Chain up to 3 image processing stages. Each stage feeds into the next.',

  controls: [
    {
      type: 'dropdown',
      key: 'stage1',
      label: 'Stage 1',
      options: STAGE_OPTIONS,
      value: 'none',
    },
    {
      type: 'dropdown',
      key: 'stage2',
      label: 'Stage 2',
      options: STAGE_OPTIONS,
      value: 'none',
    },
    {
      type: 'dropdown',
      key: 'stage3',
      label: 'Stage 3',
      options: STAGE_OPTIONS,
      value: 'none',
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    gray = new Matrix(w, h, U8C1);
    bufA = new Matrix(w, h, U8C1);
    bufB = new Matrix(w, h, U8C1);
    derivMat = new Matrix(w, h, S32C2);

    stage1 = (params.stage1 as StageName) ?? 'none';
    stage2 = (params.stage2 as StageName) ?? 'none';
    stage3 = (params.stage3 as StageName) ?? 'none';
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray || !bufA || !bufB || !derivMat) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    // Pipeline: input starts as gray
    let current = gray;
    const stages: StageName[] = [stage1, stage2, stage3];
    const appliedNames: string[] = [];
    const buffers = [bufA, bufB];
    let bufIdx = 0;

    for (let i = 0; i < stages.length; i++) {
      if (stages[i] === 'none') continue;

      const dst = buffers[bufIdx];
      profiler.start(`stage${i + 1}`);
      const applied = applyStage(stages[i], current, dst, derivMat);
      profiler.end(`stage${i + 1}`);

      if (applied) {
        appliedNames.push(stages[i]);
        current = dst;
        bufIdx = (bufIdx + 1) % 2;
      }
    }

    profiler.start('render');
    const src = current.data;
    const pixels = imageData.data;
    const n = w * h;
    for (let i = 0, j = 0; j < n; i += 4, j++) {
      const v = src[j];
      pixels[i] = v;
      pixels[i + 1] = v;
      pixels[i + 2] = v;
      pixels[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    // Draw stage names as overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(5, h - 30 - appliedNames.length * 20, 200, appliedNames.length * 20 + 10);

    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    if (appliedNames.length === 0) {
      ctx.fillText('No stages active', 10, h - 15);
    } else {
      for (let i = 0; i < appliedNames.length; i++) {
        ctx.fillText(`${i + 1}. ${appliedNames[i]}`, 10, h - 15 - (appliedNames.length - 1 - i) * 20);
      }
    }
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'stage1') stage1 = value as StageName;
    if (key === 'stage2') stage2 = value as StageName;
    if (key === 'stage3') stage3 = value as StageName;
  },

  cleanup() {
    gray = null;
    bufA = null;
    bufB = null;
    derivMat = null;
  },
};

export default demo;
