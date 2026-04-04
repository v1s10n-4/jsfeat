import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, Keypoint, Pyramid, ColorCode } from 'jsfeat/core';
import { grayscale, pyrDown } from 'jsfeat/imgproc';
import { fastCorners } from 'jsfeat/features';
import { lucasKanade } from 'jsfeat/flow';

const PYRAMID_LEVELS = 3;
const REDETECT_INTERVAL = 30;

let prevPyr: Pyramid | null = null;
let currPyr: Pyramid | null = null;
let prevXY: Float32Array | null = null;
let currXY: Float32Array | null = null;
let status: Uint8Array | null = null;
let pointCount = 0;
let frameCount = 0;
let gray: Matrix | null = null;
let corners: Keypoint[] = [];

let winSize = 20;
let maxIter = 30;
let maxPoints = 500;

const demo: Demo = {
  title: 'Optical Flow',
  category: 'Motion',
  description: 'Lucas-Kanade optical flow with feature tracking.',

  controls: [
    {
      type: 'slider',
      key: 'winSize',
      label: 'Window Size',
      min: 5,
      max: 30,
      step: 1,
      value: 20,
    },
    {
      type: 'slider',
      key: 'maxIter',
      label: 'Max Iterations',
      min: 5,
      max: 50,
      step: 1,
      value: 30,
    },
    {
      type: 'slider',
      key: 'maxPoints',
      label: 'Max Points',
      min: 50,
      max: 500,
      step: 50,
      value: 500,
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;

    winSize = (params.winSize as number) ?? 20;
    maxIter = (params.maxIter as number) ?? 30;
    maxPoints = (params.maxPoints as number) ?? 500;

    gray = new Matrix(w, h, U8C1);
    corners = Array.from({ length: maxPoints }, () => new Keypoint());

    prevPyr = new Pyramid(PYRAMID_LEVELS);
    prevPyr.allocate(w, h, U8C1);
    prevPyr.pyrdown = pyrDown;

    currPyr = new Pyramid(PYRAMID_LEVELS);
    currPyr.allocate(w, h, U8C1);
    currPyr.pyrdown = pyrDown;

    prevXY = new Float32Array(maxPoints * 2);
    currXY = new Float32Array(maxPoints * 2);
    status = new Uint8Array(maxPoints);

    pointCount = 0;
    frameCount = 0;
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray || !prevPyr || !currPyr || !prevXY || !currXY || !status) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    // Swap pyramids
    const tmp = prevPyr;
    prevPyr = currPyr;
    currPyr = tmp;

    profiler.start('pyramid');
    const lvl0 = currPyr.data[0];
    const n = w * h;
    for (let i = 0; i < n; i++) {
      lvl0.data[i] = gray.data[i];
    }
    currPyr.build(currPyr.data[0], true);
    profiler.end('pyramid');

    // Periodically re-detect features
    if (frameCount === 0 || pointCount < 10 || frameCount % REDETECT_INTERVAL === 0) {
      profiler.start('detect');
      const count = fastCorners(gray, corners, 20);
      pointCount = Math.min(count, maxPoints);
      for (let i = 0; i < pointCount; i++) {
        currXY[i * 2] = corners[i].x;
        currXY[i * 2 + 1] = corners[i].y;
      }
      profiler.end('detect');
    }

    if (pointCount > 0 && frameCount > 0) {
      for (let i = 0; i < pointCount * 2; i++) {
        prevXY[i] = currXY[i];
      }

      profiler.start('optical flow');
      lucasKanade(prevPyr, currPyr, prevXY, currXY, pointCount, winSize, maxIter, status, 0.01, 0.0001);
      profiler.end('optical flow');

      profiler.start('render');
      ctx.putImageData(imageData, 0, 0);

      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = '#ff4444';

      let newCount = 0;
      for (let i = 0; i < pointCount; i++) {
        if (status[i] === 1) {
          const px = prevXY[i * 2], py = prevXY[i * 2 + 1];
          const cx = currXY[i * 2], cy = currXY[i * 2 + 1];

          if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;

          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(cx, cy);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, 2, 0, Math.PI * 2);
          ctx.fill();

          if (newCount !== i) {
            currXY[newCount * 2] = cx;
            currXY[newCount * 2 + 1] = cy;
          }
          newCount++;
        }
      }
      pointCount = newCount;
      profiler.end('render');
    } else {
      profiler.start('render');
      ctx.putImageData(imageData, 0, 0);
      profiler.end('render');
    }

    frameCount++;
    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'winSize') winSize = value as number;
    if (key === 'maxIter') maxIter = value as number;
    if (key === 'maxPoints') maxPoints = value as number;
  },

  cleanup() {
    prevPyr = null;
    currPyr = null;
    prevXY = null;
    currXY = null;
    status = null;
    gray = null;
    corners = [];
    pointCount = 0;
    frameCount = 0;
  },
};

export default demo;
