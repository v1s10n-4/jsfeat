import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, S32C2, ColorCode } from 'jsfeat/core';
import { grayscale, scharrDerivatives } from 'jsfeat/imgproc';

let gray: Matrix | null = null;
let derivatives: Matrix | null = null;

const demo: Demo = {
  title: 'Scharr',
  category: 'Image Processing',
  description: 'Scharr derivative visualization: dx mapped to red, dy mapped to green.',

  controls: [],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, _params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    gray = new Matrix(w, h, U8C1);
    derivatives = new Matrix(w, h, S32C2);
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray || !derivatives) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    profiler.start('scharr');
    scharrDerivatives(gray, derivatives);
    profiler.end('scharr');

    profiler.start('render');
    const ddata = derivatives.data;
    const pixels = imageData.data;
    const n = w * h;
    for (let i = 0; i < n; i++) {
      const dx = ddata[i * 2];
      const dy = ddata[i * 2 + 1];
      // Scale derivatives to visible range [0..255]
      const r = Math.min(255, Math.max(0, Math.abs(dx) >> 2));
      const g = Math.min(255, Math.max(0, Math.abs(dy) >> 2));
      const idx = i * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = 0;
      pixels[idx + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    profiler.end('render');

    profiler.frameEnd();
  },

  cleanup() {
    gray = null;
    derivatives = null;
  },
};

export default demo;
