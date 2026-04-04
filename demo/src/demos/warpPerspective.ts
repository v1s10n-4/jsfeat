import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, ColorCode, DataType, Channel } from 'jsfeat/core';
import { grayscale } from 'jsfeat/imgproc';
import { perspective4PointTransform } from 'jsfeat/math';

let gray: Matrix | null = null;
let warped: Matrix | null = null;
let homoMat: Matrix | null = null;

// 4 draggable corner positions (destination corners)
let corners: { x: number; y: number }[] = [];
let canvasRef: HTMLCanvasElement | null = null;
let draggingIdx = -1;

const HANDLE_RADIUS = 10;

/* ------------------------------------------------------------------ *
 *  Inline perspective warp (no warpPerspective in imgproc)
 * ------------------------------------------------------------------ */

function warpPerspectiveInline(
  src: Matrix,
  dst: Matrix,
  H: Matrix,
  fillValue: number,
): void {
  const sw = src.cols, sh = src.rows;
  const dw = dst.cols, dh = dst.rows;
  const sd = src.data, dd = dst.data;
  const m = H.data;

  for (let y = 0, dptr = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++, dptr++) {
      const ww = m[6] * x + m[7] * y + m[8];
      if (Math.abs(ww) < 1e-10) {
        dd[dptr] = fillValue;
        continue;
      }
      const invw = 1.0 / ww;
      const xs = (m[0] * x + m[1] * y + m[2]) * invw;
      const ys = (m[3] * x + m[4] * y + m[5]) * invw;

      const ixs = xs | 0;
      const iys = ys | 0;

      if (ixs >= 0 && iys >= 0 && ixs < sw - 1 && iys < sh - 1) {
        const a = xs - ixs;
        const b = ys - iys;
        const off = iys * sw + ixs;
        const p0 = sd[off] + a * (sd[off + 1] - sd[off]);
        const p1 = sd[off + sw] + a * (sd[off + sw + 1] - sd[off + sw]);
        dd[dptr] = (p0 + b * (p1 - p0)) | 0;
      } else {
        dd[dptr] = fillValue;
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 *  Mouse event handlers
 * ------------------------------------------------------------------ */

function onMouseDown(e: MouseEvent): void {
  if (!canvasRef) return;
  const rect = canvasRef.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvasRef.width / rect.width);
  const my = (e.clientY - rect.top) * (canvasRef.height / rect.height);

  draggingIdx = -1;
  for (let i = 0; i < 4; i++) {
    const dx = mx - corners[i].x;
    const dy = my - corners[i].y;
    if (dx * dx + dy * dy < HANDLE_RADIUS * HANDLE_RADIUS * 4) {
      draggingIdx = i;
      break;
    }
  }
}

function onMouseMove(e: MouseEvent): void {
  if (draggingIdx < 0 || !canvasRef) return;
  const rect = canvasRef.getBoundingClientRect();
  corners[draggingIdx].x = (e.clientX - rect.left) * (canvasRef.width / rect.width);
  corners[draggingIdx].y = (e.clientY - rect.top) * (canvasRef.height / rect.height);
}

function onMouseUp(): void {
  draggingIdx = -1;
}

function onTouchStart(e: TouchEvent): void {
  if (!canvasRef || e.touches.length === 0) return;
  const touch = e.touches[0];
  const rect = canvasRef.getBoundingClientRect();
  const mx = (touch.clientX - rect.left) * (canvasRef.width / rect.width);
  const my = (touch.clientY - rect.top) * (canvasRef.height / rect.height);

  draggingIdx = -1;
  for (let i = 0; i < 4; i++) {
    const dx = mx - corners[i].x;
    const dy = my - corners[i].y;
    if (dx * dx + dy * dy < HANDLE_RADIUS * HANDLE_RADIUS * 9) {
      draggingIdx = i;
      e.preventDefault();
      break;
    }
  }
}

function onTouchMove(e: TouchEvent): void {
  if (draggingIdx < 0 || !canvasRef || e.touches.length === 0) return;
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvasRef.getBoundingClientRect();
  corners[draggingIdx].x = (touch.clientX - rect.left) * (canvasRef.width / rect.width);
  corners[draggingIdx].y = (touch.clientY - rect.top) * (canvasRef.height / rect.height);
}

function onTouchEnd(): void {
  draggingIdx = -1;
}

function resetCorners(w: number, h: number): void {
  const margin = 60;
  corners = [
    { x: margin, y: margin },
    { x: w - margin, y: margin },
    { x: w - margin, y: h - margin },
    { x: margin, y: h - margin },
  ];
}

const demo: Demo = {
  title: 'Warp Perspective',
  category: 'Transforms',
  description:
    'Drag the 4 corner handles to define a perspective warp. The image is warped in real-time using a homography.',

  controls: [
    {
      type: 'button',
      label: 'Reset Corners',
      action: 'resetCorners',
    },
  ],

  setup(canvas: HTMLCanvasElement, _video: HTMLVideoElement, _params: Record<string, unknown>) {
    const w = canvas.width;
    const h = canvas.height;
    gray = new Matrix(w, h, U8C1);
    warped = new Matrix(w, h, U8C1);
    homoMat = new Matrix(3, 3, DataType.F32 | Channel.C1);
    canvasRef = canvas;

    resetCorners(w, h);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
  },

  process(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    w: number,
    h: number,
    profiler: Profiler,
  ) {
    if (!gray || !warped || !homoMat) return;

    profiler.frameStart();

    profiler.start('capture');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    profiler.end('capture');

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);
    profiler.end('grayscale');

    // Compute homography from image corners to dragged corners
    // Source: full image rectangle, Destination: user-defined corners
    profiler.start('homography');
    perspective4PointTransform(
      homoMat,
      corners[0].x, corners[0].y, 0, 0,
      corners[1].x, corners[1].y, w, 0,
      corners[2].x, corners[2].y, w, h,
      corners[3].x, corners[3].y, 0, h,
    );
    profiler.end('homography');

    profiler.start('warp');
    warpPerspectiveInline(gray, warped, homoMat, 0);
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

    // Draw corner handles and connecting lines
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#00ccff';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(corners[i].x, corners[i].y, HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText(`${i}`, corners[i].x - 4, corners[i].y + 4);
      ctx.fillStyle = '#00ccff';
    }
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key: string) {
    if (key === 'resetCorners' && canvasRef) {
      resetCorners(canvasRef.width, canvasRef.height);
    }
  },

  cleanup() {
    if (canvasRef) {
      canvasRef.removeEventListener('mousedown', onMouseDown);
      canvasRef.removeEventListener('mousemove', onMouseMove);
      canvasRef.removeEventListener('mouseup', onMouseUp);
      canvasRef.removeEventListener('touchstart', onTouchStart);
      canvasRef.removeEventListener('touchmove', onTouchMove);
      canvasRef.removeEventListener('touchend', onTouchEnd);
    }
    gray = null;
    warped = null;
    homoMat = null;
    canvasRef = null;
    corners = [];
    draggingIdx = -1;
  },
};

export default demo;
