import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, F32C1, ColorCode, DataType, Channel } from 'jsfeat/core';
import { grayscale, warpAffine } from 'jsfeat/imgproc';

let gray: Matrix | null = null;
let warped: Matrix | null = null;
let transform: Matrix | null = null;

let rotation = 0;
let scale = 1.0;
let translateX = 0;
let translateY = 0;

const demo: Demo = {
  title: 'Warp Affine',
  category: 'Transforms',
  description: 'Real-time affine warp with rotation, scale, and translation controls.',

  controls: [
    {
      type: 'slider',
      key: 'rotation',
      label: 'Rotation',
      min: -180,
      max: 180,
      step: 1,
      value: 0,
    },
    {
      type: 'slider',
      key: 'scale',
      label: 'Scale',
      min: 0.5,
      max: 2.0,
      step: 0.1,
      value: 1.0,
    },
    {
      type: 'slider',
      key: 'translateX',
      label: 'Translate X',
      min: -100,
      max: 100,
      step: 1,
      value: 0,
    },
    {
      type: 'slider',
      key: 'translateY',
      label: 'Translate Y',
      min: -100,
      max: 100,
      step: 1,
      value: 0,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    gray = new Matrix(w, h, U8C1);
    warped = new Matrix(w, h, U8C1);
    transform = new Matrix(3, 3, DataType.F32 | Channel.C1);

    rotation = (params.rotation as number) ?? 0;
    scale = (params.scale as number) ?? 1.0;
    translateX = (params.translateX as number) ?? 0;
    translateY = (params.translateY as number) ?? 0;
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray || !warped || !transform) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    // Build affine matrix for rotation+scale+translate around center
    const cx = w * 0.5;
    const cy = h * 0.5;
    const theta = (rotation * Math.PI) / 180;
    const cosT = Math.cos(theta) * scale;
    const sinT = Math.sin(theta) * scale;
    const tx = translateX + cx * (1 - cosT) + cy * sinT;
    const ty = translateY + cy * (1 - cosT) - cx * sinT;

    const td = transform.data;
    td[0] = cosT;
    td[1] = -sinT;
    td[2] = tx;
    td[3] = sinT;
    td[4] = cosT;
    td[5] = ty;
    td[6] = 0;
    td[7] = 0;
    td[8] = 1;

    profiler.start('warp');
    warpAffine(gray, warped, transform, 0);
    profiler.end('warp');

    profiler.start('render');
    const src = warped.data;
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
    if (key === 'rotation') rotation = value as number;
    if (key === 'scale') scale = value as number;
    if (key === 'translateX') translateX = value as number;
    if (key === 'translateY') translateY = value as number;
  },

  cleanup() {
    gray = null;
    warped = null;
    transform = null;
  },
};

export default demo;
