import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, Keypoint, ColorCode } from 'jsfeat/core';
import { grayscale } from 'jsfeat/imgproc';
import { fastCorners } from 'jsfeat/features';

const MAX_CORNERS = 2000;
let gray: Matrix | null = null;
let corners: Keypoint[] = [];
let threshold = 20;
let border = 3;

const demo: Demo = {
  title: 'FAST Corners',
  category: 'Feature Detection',
  description: 'FAST corner detection with drawn keypoints.',

  controls: [
    {
      type: 'slider',
      key: 'threshold',
      label: 'Threshold',
      min: 5,
      max: 100,
      step: 1,
      value: 20,
    },
    {
      type: 'slider',
      key: 'border',
      label: 'Border',
      min: 1,
      max: 10,
      step: 1,
      value: 3,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    gray = new Matrix(canvas.width, canvas.height, U8C1);
    corners = Array.from({ length: MAX_CORNERS }, () => new Keypoint());
    threshold = (params.threshold as number) ?? 20;
    border = (params.border as number) ?? 3;
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
    const count = fastCorners(gray, corners, threshold);
    profiler.end('detect');

    profiler.start('render');
    ctx.putImageData(imageData, 0, 0);

    ctx.fillStyle = '#e94560';
    for (let i = 0; i < count; i++) {
      const kp = corners[i];
      if (kp.x < border || kp.x >= w - border || kp.y < border || kp.y >= h - border) continue;
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'threshold') threshold = value as number;
    if (key === 'border') border = value as number;
  },

  cleanup() {
    gray = null;
    corners = [];
  },
};

export default demo;
