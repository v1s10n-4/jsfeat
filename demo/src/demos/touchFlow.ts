import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, Keypoint, Pyramid, ColorCode } from 'jsfeat/core';
import { grayscale, pyrDown } from 'jsfeat/imgproc';
import { lucasKanade } from 'jsfeat/flow';

/* ------------------------------------------------------------------ *
 *  Constants
 * ------------------------------------------------------------------ */

const PYRAMID_LEVELS = 3;
const MAX_POINTS = 200;

/* ------------------------------------------------------------------ *
 *  State
 * ------------------------------------------------------------------ */

let gray: Matrix | null = null;
let prevPyr: Pyramid | null = null;
let currPyr: Pyramid | null = null;
let prevXY: Float32Array | null = null;
let currXY: Float32Array | null = null;
let status: Uint8Array | null = null;
let pointCount = 0;
let frameCount = 0;

let winSize = 20;
let canvasRef: HTMLCanvasElement | null = null;

// Queue of new points to add
const pendingPoints: { x: number; y: number }[] = [];

/* ------------------------------------------------------------------ *
 *  Event handlers
 * ------------------------------------------------------------------ */

function onCanvasClick(e: MouseEvent): void {
  if (!canvasRef) return;
  const rect = canvasRef.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvasRef.width / rect.width);
  const y = (e.clientY - rect.top) * (canvasRef.height / rect.height);
  pendingPoints.push({ x, y });
}

function onCanvasTouch(e: TouchEvent): void {
  if (!canvasRef) return;
  e.preventDefault();
  const rect = canvasRef.getBoundingClientRect();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    const x = (touch.clientX - rect.left) * (canvasRef.width / rect.width);
    const y = (touch.clientY - rect.top) * (canvasRef.height / rect.height);
    pendingPoints.push({ x, y });
  }
}

const demo: Demo = {
  title: 'Touch Flow',
  category: 'Extras',
  description:
    'Click or tap to add tracking points. Points are tracked with Lucas-Kanade optical flow until they leave the frame.',

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
      type: 'button',
      label: 'Clear Points',
      action: 'clear',
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;

    winSize = (params.winSize as number) ?? 20;

    gray = new Matrix(w, h, U8C1);

    prevPyr = new Pyramid(PYRAMID_LEVELS);
    prevPyr.allocate(w, h, U8C1);
    prevPyr.pyrdown = pyrDown;

    currPyr = new Pyramid(PYRAMID_LEVELS);
    currPyr.allocate(w, h, U8C1);
    currPyr.pyrdown = pyrDown;

    prevXY = new Float32Array(MAX_POINTS * 2);
    currXY = new Float32Array(MAX_POINTS * 2);
    status = new Uint8Array(MAX_POINTS);

    pointCount = 0;
    frameCount = 0;
    pendingPoints.length = 0;

    canvasRef = canvas;
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('touchstart', onCanvasTouch, { passive: false });
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

    // Add pending points
    while (pendingPoints.length > 0 && pointCount < MAX_POINTS) {
      const pt = pendingPoints.shift()!;
      currXY[pointCount * 2] = pt.x;
      currXY[pointCount * 2 + 1] = pt.y;
      pointCount++;
    }

    if (pointCount > 0 && frameCount > 0) {
      // Copy current to prev for tracking
      for (let i = 0; i < pointCount * 2; i++) {
        prevXY[i] = currXY[i];
      }

      profiler.start('optical flow');
      lucasKanade(prevPyr, currPyr, prevXY, currXY, pointCount, winSize, 30, status, 0.01, 0.0001);
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

          // Remove points that go out of bounds
          if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;

          // Draw flow vector
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(cx, cy);
          ctx.stroke();

          // Draw point
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
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

      // Still draw existing points (newly added, before first track)
      ctx.fillStyle = '#ff4444';
      for (let i = 0; i < pointCount; i++) {
        ctx.beginPath();
        ctx.arc(currXY[i * 2], currXY[i * 2 + 1], 3, 0, Math.PI * 2);
        ctx.fill();
      }
      profiler.end('render');
    }

    // Info text
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`Points: ${pointCount}`, 10, h - 10);
    if (pointCount === 0) {
      ctx.fillText('Click or tap to add tracking points', 10, h - 30);
    }

    frameCount++;
    profiler.frameEnd();
  },

  onParamChange(key: string, value: unknown) {
    if (key === 'winSize') winSize = value as number;
    if (key === 'clear') {
      pointCount = 0;
      pendingPoints.length = 0;
    }
  },

  cleanup() {
    if (canvasRef) {
      canvasRef.removeEventListener('click', onCanvasClick);
      canvasRef.removeEventListener('touchstart', onCanvasTouch);
    }
    prevPyr = null;
    currPyr = null;
    prevXY = null;
    currXY = null;
    status = null;
    gray = null;
    pointCount = 0;
    frameCount = 0;
    pendingPoints.length = 0;
    canvasRef = null;
  },
};

export default demo;
