import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, ColorCode } from 'jsfeat/core';
import { grayscale, equalizeHistogram, computeIntegralImage } from 'jsfeat/imgproc';
import { haarDetectMultiScale, groupRectangles } from 'jsfeat/detect';
import { frontalface } from 'jsfeat/cascades';

let gray: Matrix | null = null;
let intSum: Int32Array | null = null;
let intSqsum: Int32Array | null = null;
let intTilted: Int32Array | null = null;
let scaleFactor = 1.2;
let minNeighbors = 1;
let doEqualize = true;

const demo: Demo = {
  title: 'Haar Face Detection',
  category: 'Face Detection',
  description: 'Haar cascade face detection with bounding boxes.',

  controls: [
    {
      type: 'slider',
      key: 'scaleFactor',
      label: 'Scale Factor',
      min: 1.1,
      max: 2.0,
      step: 0.1,
      value: 1.2,
    },
    {
      type: 'slider',
      key: 'minNeighbors',
      label: 'Min Neighbors',
      min: 0,
      max: 5,
      step: 1,
      value: 1,
    },
    {
      type: 'checkbox',
      key: 'equalize',
      label: 'Equalize Histogram',
      value: true,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    gray = new Matrix(w, h, U8C1);
    const integralSize = (w + 1) * (h + 1);
    intSum = new Int32Array(integralSize);
    intSqsum = new Int32Array(integralSize);
    intTilted = new Int32Array(integralSize);
    scaleFactor = (params.scaleFactor as number) ?? 1.2;
    minNeighbors = (params.minNeighbors as number) ?? 1;
    doEqualize = (params.equalize as boolean) ?? true;
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray || !intSum || !intSqsum || !intTilted) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    if (doEqualize) {
      profiler.start('equalize');
      equalizeHistogram(gray, gray);
      profiler.end('equalize');
    }

    profiler.start('integral');
    computeIntegralImage(gray, intSum, intSqsum, intTilted);
    profiler.end('integral');

    profiler.start('detect');
    const rects = haarDetectMultiScale(
      intSum,
      intSqsum,
      intTilted,
      null,
      w + 1,
      h + 1,
      frontalface,
      scaleFactor,
      2.0,
    );
    const grouped = groupRectangles(rects, minNeighbors);
    profiler.end('detect');

    profiler.start('render');
    ctx.putImageData(imageData, 0, 0);

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    for (const r of grouped) {
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    }
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'scaleFactor') scaleFactor = value as number;
    if (key === 'minNeighbors') minNeighbors = value as number;
    if (key === 'equalize') doEqualize = value as boolean;
  },

  cleanup() {
    gray = null;
    intSum = null;
    intSqsum = null;
    intTilted = null;
  },
};

export default demo;
