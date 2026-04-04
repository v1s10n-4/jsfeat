import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, ColorCode } from 'jsfeat/core';
import { grayscale, gaussianBlur, cannyEdges } from 'jsfeat/imgproc';

let gray: Matrix | null = null;
let edgesMat: Matrix | null = null;
let lowThreshold = 20;
let highThreshold = 40;
let blurKernel = 5;

const demo: Demo = {
  title: 'Canny Edges',
  category: 'Image Processing',
  description: 'Canny edge detection with Gaussian pre-blur.',

  controls: [
    {
      type: 'slider',
      key: 'lowThreshold',
      label: 'Low Threshold',
      min: 1,
      max: 127,
      step: 1,
      value: 20,
    },
    {
      type: 'slider',
      key: 'highThreshold',
      label: 'High Threshold',
      min: 1,
      max: 255,
      step: 1,
      value: 40,
    },
    {
      type: 'slider',
      key: 'blurKernel',
      label: 'Blur Kernel',
      min: 3,
      max: 15,
      step: 2,
      value: 5,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    gray = new Matrix(w, h, U8C1);
    edgesMat = new Matrix(w, h, U8C1);
    lowThreshold = (params.lowThreshold as number) ?? 20;
    highThreshold = (params.highThreshold as number) ?? 40;
    blurKernel = (params.blurKernel as number) ?? 5;
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray || !edgesMat) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    profiler.start('blur');
    gaussianBlur(gray, gray, blurKernel, 0);
    profiler.end('blur');

    profiler.start('canny');
    cannyEdges(gray, edgesMat, lowThreshold, highThreshold);
    profiler.end('canny');

    profiler.start('render');
    const src = edgesMat.data;
    const dst = imageData.data;
    for (let i = 0, j = 0; i < dst.length; i += 4, j++) {
      const v = src[j];
      dst[i] = v;
      dst[i + 1] = v;
      dst[i + 2] = v;
      dst[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'lowThreshold') lowThreshold = value as number;
    if (key === 'highThreshold') highThreshold = value as number;
    if (key === 'blurKernel') blurKernel = value as number;
  },

  cleanup() {
    gray = null;
    edgesMat = null;
  },
};

export default demo;
