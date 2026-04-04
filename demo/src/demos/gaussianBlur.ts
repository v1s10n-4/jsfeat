import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, ColorCode } from 'jsfeat/core';
import { grayscale, gaussianBlur } from 'jsfeat/imgproc';

let src: Matrix | null = null;
let dst: Matrix | null = null;
let kernelSize = 5;
let sigma = 0;

const demo: Demo = {
  title: 'Gaussian Blur',
  category: 'Image Processing',
  description: 'Real-time Gaussian blur on grayscale image.',

  controls: [
    {
      type: 'slider',
      key: 'kernelSize',
      label: 'Kernel Size',
      min: 3,
      max: 15,
      step: 2,
      value: 5,
    },
    {
      type: 'slider',
      key: 'sigma',
      label: 'Sigma',
      min: 0,
      max: 10,
      step: 0.5,
      value: 0,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    src = new Matrix(w, h, U8C1);
    dst = new Matrix(w, h, U8C1);
    kernelSize = (params.kernelSize as number) ?? 5;
    sigma = (params.sigma as number) ?? 0;
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!src || !dst) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, src, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    profiler.start('gaussian blur');
    gaussianBlur(src, dst, kernelSize, sigma);
    profiler.end('gaussian blur');

    profiler.start('render');
    const data = dst.data;
    const pixels = imageData.data;
    for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
      const v = data[j];
      pixels[i] = v;
      pixels[i + 1] = v;
      pixels[i + 2] = v;
      pixels[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'kernelSize') kernelSize = value as number;
    if (key === 'sigma') sigma = value as number;
  },

  cleanup() {
    src = null;
    dst = null;
  },
};

export default demo;
