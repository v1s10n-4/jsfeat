import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, ColorCode } from 'jsfeat/core';
import { grayscale, pyrDown } from 'jsfeat/imgproc';

let src: Matrix | null = null;
let levels: Matrix[] = [];
let numLevels = 2;

const demo: Demo = {
  title: 'Pyramid Down',
  category: 'Image Processing',
  description: 'Image pyramid downsampling with upscaled rendering.',

  controls: [
    {
      type: 'slider',
      key: 'levels',
      label: 'Levels',
      min: 1,
      max: 4,
      step: 1,
      value: 2,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    src = new Matrix(w, h, U8C1);
    numLevels = (params.levels as number) ?? 2;

    // Pre-allocate pyramid level matrices
    levels = [];
    let lw = w;
    let lh = h;
    for (let i = 0; i < 4; i++) {
      lw = lw >> 1;
      lh = lh >> 1;
      levels.push(new Matrix(lw, lh, U8C1));
    }
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!src || levels.length === 0) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, src, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    profiler.start('pyrDown');
    let current: Matrix = src;
    for (let i = 0; i < numLevels; i++) {
      pyrDown(current, levels[i]);
      current = levels[i];
    }
    profiler.end('pyrDown');

    profiler.start('render');
    // Render the downsampled result stretched to full canvas
    const result = current;
    const rw = result.cols;
    const rh = result.rows;
    const data = result.data;

    // Create a small ImageData, put it on an offscreen canvas, then draw stretched
    const smallData = ctx.createImageData(rw, rh);
    const pixels = smallData.data;
    for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
      const v = data[j];
      pixels[i] = v;
      pixels[i + 1] = v;
      pixels[i + 2] = v;
      pixels[i + 3] = 255;
    }

    // Use imageSmoothingEnabled for upscaling
    ctx.imageSmoothingEnabled = true;
    ctx.putImageData(smallData, 0, 0);
    // Copy the small region and draw it stretched to fill canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = rw;
    tempCanvas.height = rh;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(smallData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0, rw, rh, 0, 0, w, h);
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'levels') numLevels = value as number;
  },

  cleanup() {
    src = null;
    levels = [];
  },
};

export default demo;
