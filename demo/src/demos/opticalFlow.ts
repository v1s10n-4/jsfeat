import { Matrix, U8C1, Keypoint, Pyramid, ColorCode } from 'jsfeat/core';
import { grayscale, pyrDown } from 'jsfeat/imgproc';
import { fastCorners } from 'jsfeat/features';
import { lucasKanade } from 'jsfeat/flow';

const MAX_POINTS = 500;
const PYRAMID_LEVELS = 3;
const REDETECT_INTERVAL = 30; // frames between re-detection

let prevPyr: Pyramid | null = null;
let currPyr: Pyramid | null = null;
let prevXY: Float32Array | null = null;
let currXY: Float32Array | null = null;
let status: Uint8Array | null = null;
let pointCount = 0;
let frameCount = 0;
let gray: Matrix | null = null;
let corners: Keypoint[] = [];

/**
 * Lucas-Kanade optical flow with feature tracking.
 */
export function setup(
  canvas: HTMLCanvasElement,
  _video: HTMLVideoElement,
  _ctx: CanvasRenderingContext2D,
): void {
  const w = canvas.width;
  const h = canvas.height;

  gray = new Matrix(w, h, U8C1);
  corners = Array.from({ length: MAX_POINTS }, () => new Keypoint());

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
}

function detectFeatures(w: number, h: number): void {
  if (!gray || !currXY) return;
  const count = fastCorners(gray, corners, 20);
  pointCount = Math.min(count, MAX_POINTS);
  for (let i = 0; i < pointCount; i++) {
    currXY[i * 2] = corners[i].x;
    currXY[i * 2 + 1] = corners[i].y;
  }
}

export function process(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
): void {
  if (!gray || !prevPyr || !currPyr || !prevXY || !currXY || !status) return;

  ctx.drawImage(video, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  grayscale(imageData.data, w, h, gray, ColorCode.RGBA2GRAY);

  // Swap pyramids
  const tmp = prevPyr;
  prevPyr = currPyr;
  currPyr = tmp;

  // Copy grayscale into level 0, build pyramid
  const lvl0 = currPyr.data[0];
  const n = w * h;
  for (let i = 0; i < n; i++) {
    lvl0.data[i] = gray.data[i];
  }
  currPyr.build(currPyr.data[0], true);

  // Periodically re-detect features
  if (frameCount === 0 || pointCount < 10 || frameCount % REDETECT_INTERVAL === 0) {
    detectFeatures(w, h);
  }

  if (pointCount > 0 && frameCount > 0) {
    // Copy currXY to prevXY before tracking
    for (let i = 0; i < pointCount * 2; i++) {
      prevXY[i] = currXY[i];
    }

    lucasKanade(prevPyr, currPyr, prevXY, currXY, pointCount, 20, 30, status, 0.01, 0.0001);

    // Draw video frame
    ctx.putImageData(imageData, 0, 0);

    // Draw flow vectors
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#ff4444';

    let newCount = 0;
    for (let i = 0; i < pointCount; i++) {
      if (status[i] === 1) {
        const px = prevXY[i * 2], py = prevXY[i * 2 + 1];
        const cx = currXY[i * 2], cy = currXY[i * 2 + 1];

        // Skip points that went out of bounds
        if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;

        // Draw line from prev to curr
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(cx, cy);
        ctx.stroke();

        // Draw point at current position
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();

        // Compact tracked points
        if (newCount !== i) {
          currXY[newCount * 2] = cx;
          currXY[newCount * 2 + 1] = cy;
        }
        newCount++;
      }
    }
    pointCount = newCount;
  } else {
    ctx.putImageData(imageData, 0, 0);
  }

  frameCount++;
}

export function cleanup(): void {
  prevPyr = null;
  currPyr = null;
  prevXY = null;
  currXY = null;
  status = null;
  gray = null;
  corners = [];
  pointCount = 0;
  frameCount = 0;
}
