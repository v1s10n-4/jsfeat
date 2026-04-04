import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, Keypoint, ColorCode } from 'jsfeat/core';
import { grayscale } from 'jsfeat/imgproc';
import { yapeDetect } from 'jsfeat/features';

const MAX_POINTS = 2000;
let gray: Matrix | null = null;
let points: Keypoint[] = [];
let border = 5;

const demo: Demo = {
  title: 'YAPE',
  category: 'Feature Detection',
  description: 'YAPE keypoint detection.',

  controls: [
    {
      type: 'slider',
      key: 'border',
      label: 'Border',
      min: 3,
      max: 10,
      step: 1,
      value: 5,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    gray = new Matrix(w, h, U8C1);
    points = Array.from({ length: MAX_POINTS }, () => new Keypoint());
    border = (params.border as number) ?? 5;
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
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    profiler.start('detect');
    const count = yapeDetect(gray, points, border);
    profiler.end('detect');

    profiler.start('render');
    ctx.putImageData(imageData, 0, 0);

    for (let i = 0; i < count; i++) {
      const kp = points[i];
      const hue = (i * 137.5) % 360;
      ctx.strokeStyle = `hsl(${hue}, 80%, 60%)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`Keypoints: ${count}`, 10, h - 10);
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'border') border = value as number;
  },

  cleanup() {
    gray = null;
    points = [];
  },
};

export default demo;
