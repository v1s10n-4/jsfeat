import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, Keypoint, ColorCode } from 'jsfeat/core';
import { grayscale, gaussianBlur } from 'jsfeat/imgproc';
import { fastCorners, orbDescribe } from 'jsfeat/features';

let gray: Matrix | null = null;
let corners: Keypoint[] = [];
let descriptors: Matrix | null = null;
let threshold = 20;
let maxFeatures = 1000;

const demo: Demo = {
  title: 'ORB Features',
  category: 'Feature Detection',
  description: 'ORB descriptor extraction with orientation visualization.',

  controls: [
    {
      type: 'slider',
      key: 'threshold',
      label: 'Threshold',
      min: 5,
      max: 50,
      step: 1,
      value: 20,
    },
    {
      type: 'slider',
      key: 'maxFeatures',
      label: 'Max Features',
      min: 100,
      max: 2000,
      step: 100,
      value: 1000,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    threshold = (params.threshold as number) ?? 20;
    maxFeatures = (params.maxFeatures as number) ?? 1000;
    gray = new Matrix(w, h, U8C1);
    corners = Array.from({ length: maxFeatures }, () => new Keypoint());
    descriptors = new Matrix(32, maxFeatures, U8C1);
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray || !descriptors) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    profiler.start('blur');
    gaussianBlur(gray, gray, 3, 0);
    profiler.end('blur');

    profiler.start('detect');
    const count = fastCorners(gray, corners, threshold);
    const usable = Math.min(count, maxFeatures);
    profiler.end('detect');

    profiler.start('describe');
    if (usable > 0) {
      orbDescribe(gray, corners, usable, descriptors);
    }
    profiler.end('describe');

    profiler.start('render');
    ctx.putImageData(imageData, 0, 0);

    for (let i = 0; i < usable; i++) {
      const kp = corners[i];
      const descByte = descriptors.data[i * 32] || 0;
      const hue = (descByte * 1.4) % 360;
      ctx.strokeStyle = `hsl(${hue}, 80%, 60%)`;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2);
      ctx.stroke();

      if (kp.angle >= 0) {
        const len = 10;
        const ex = kp.x + len * Math.cos(kp.angle);
        const ey = kp.y + len * Math.sin(kp.angle);
        ctx.beginPath();
        ctx.moveTo(kp.x, kp.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`Features: ${usable}`, 10, h - 10);
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'threshold') threshold = value as number;
    if (key === 'maxFeatures') maxFeatures = value as number;
  },

  cleanup() {
    gray = null;
    corners = [];
    descriptors = null;
  },
};

export default demo;
