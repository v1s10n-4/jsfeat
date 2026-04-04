import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, Keypoint, ColorCode } from 'jsfeat/core';
import { grayscale } from 'jsfeat/imgproc';
import { yape06Detect } from 'jsfeat/features';

const MAX_POINTS = 2000;
let gray: Matrix | null = null;
let points: Keypoint[] = [];
let laplacianThreshold = 30;
let minEigenThreshold = 25;
let border = 5;

const demo: Demo = {
  title: 'YAPE06',
  category: 'Feature Detection',
  description: 'YAPE06 keypoint detection with Laplacian and eigenvalue thresholds.',

  controls: [
    {
      type: 'slider',
      key: 'laplacianThreshold',
      label: 'Laplacian Threshold',
      min: 5,
      max: 100,
      step: 1,
      value: 30,
    },
    {
      type: 'slider',
      key: 'minEigenThreshold',
      label: 'Min Eigen Threshold',
      min: 5,
      max: 100,
      step: 1,
      value: 25,
    },
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
    laplacianThreshold = (params.laplacianThreshold as number) ?? 30;
    minEigenThreshold = (params.minEigenThreshold as number) ?? 25;
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
    const count = yape06Detect(gray, points, border, laplacianThreshold, minEigenThreshold);
    profiler.end('detect');

    profiler.start('render');
    ctx.putImageData(imageData, 0, 0);

    for (let i = 0; i < count; i++) {
      const kp = points[i];
      // Color keypoints based on score for visual variety
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
    if (key === 'laplacianThreshold') laplacianThreshold = value as number;
    if (key === 'minEigenThreshold') minEigenThreshold = value as number;
    if (key === 'border') border = value as number;
  },

  cleanup() {
    gray = null;
    points = [];
  },
};

export default demo;
