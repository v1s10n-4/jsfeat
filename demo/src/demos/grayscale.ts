import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, ColorCode } from 'jsfeat/core';
import { grayscale } from 'jsfeat/imgproc';

let gray: Matrix | null = null;
let colorCode: number = ColorCode.RGBA2GRAY;

const COLOR_CODE_MAP: Record<string, number> = {
  RGBA: ColorCode.RGBA2GRAY,
  RGB: ColorCode.RGB2GRAY,
  BGRA: ColorCode.BGRA2GRAY,
  BGR: ColorCode.BGR2GRAY,
};

const demo: Demo = {
  title: 'Grayscale',
  category: 'Image Processing',
  description: 'Real-time RGB to grayscale conversion.',

  controls: [
    {
      type: 'dropdown',
      key: 'colorCode',
      label: 'Color Code',
      options: [
        { label: 'RGBA', value: 'RGBA' },
        { label: 'RGB', value: 'RGB' },
        { label: 'BGRA', value: 'BGRA' },
        { label: 'BGR', value: 'BGR' },
      ],
      value: 'RGBA',
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    gray = new Matrix(canvas.width, canvas.height, U8C1);
    colorCode = COLOR_CODE_MAP[params.colorCode as string] ?? ColorCode.RGBA2GRAY;
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, colorCode);
    profiler.end('grayscale');

    profiler.start('render');
    const src = gray.data;
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
    if (key === 'colorCode') {
      colorCode = COLOR_CODE_MAP[value as string] ?? ColorCode.RGBA2GRAY;
    }
  },

  cleanup() {
    gray = null;
  },
};

export default demo;
