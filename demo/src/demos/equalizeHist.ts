import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, ColorCode } from 'jsfeat/core';
import { grayscale, equalizeHistogram } from 'jsfeat/imgproc';

let gray: Matrix | null = null;
let equalized: Matrix | null = null;

const demo: Demo = {
  title: 'Equalize Histogram',
  category: 'Image Processing',
  description: 'Histogram equalization with split-screen comparison (left = original, right = equalized).',

  controls: [],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, _params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    gray = new Matrix(w, h, U8C1);
    equalized = new Matrix(w, h, U8C1);
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray || !equalized) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    profiler.start('equalize');
    equalizeHistogram(gray, equalized);
    profiler.end('equalize');

    profiler.start('render');
    const grayData = gray.data;
    const eqData = equalized.data;
    const pixels = imageData.data;
    const half = w >> 1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const j = y * w + x;
        const v = x < half ? grayData[j] : eqData[j];
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
    ctx.moveTo(half, 0);
    ctx.lineTo(half, h);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Original', half / 2, 20);
    ctx.fillText('Equalized', half + half / 2, 20);
    ctx.textAlign = 'start';
    profiler.end('render');

    profiler.frameEnd();
  },

  cleanup() {
    gray = null;
    equalized = null;
  },
};

export default demo;
