// Example: Lucas-Kanade Optical Flow
// Demonstrates: lucasKanade() from jsfeat/flow, Pyramid from jsfeat/core,
//               grayscale(), pyrDown() from jsfeat/imgproc,
//               fastCorners() from jsfeat/features

import { Matrix, Keypoint, Pyramid, U8C1 } from 'jsfeat/core';
import { grayscale, pyrDown } from 'jsfeat/imgproc';
import { fastCorners } from 'jsfeat/features';
import { lucasKanade } from 'jsfeat/flow';

// --- Setup ---

const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const WIDTH = 640;
const HEIGHT = 480;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// Pyramid levels for coarse-to-fine tracking
const PYRAMID_LEVELS = 3;

// Create two pyramids: one for the previous frame, one for the current
const prevPyr = new Pyramid(PYRAMID_LEVELS);
prevPyr.allocate(WIDTH, HEIGHT, U8C1);
prevPyr.pyrdown = pyrDown;

const currPyr = new Pyramid(PYRAMID_LEVELS);
currPyr.allocate(WIDTH, HEIGHT, U8C1);
currPyr.pyrdown = pyrDown;

// Temporary grayscale matrix
const grayMatrix = new Matrix(WIDTH, HEIGHT, U8C1);

// Tracking data
const MAX_POINTS = 200;
const WIN_SIZE = 20;
const MAX_ITER = 30;
let prevXY = new Float32Array(MAX_POINTS * 2);
let currXY = new Float32Array(MAX_POINTS * 2);
let status = new Uint8Array(MAX_POINTS);
let pointCount = 0;

// Corner detection for finding initial tracking points
const corners: Keypoint[] = [];
for (let i = 0; i < MAX_POINTS; i++) {
  corners.push(new Keypoint());
}

let initialized = false;

// --- Start webcam ---

async function startWebcam(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: WIDTH, height: HEIGHT },
  });
  video.srcObject = stream;
  await video.play();
  requestAnimationFrame(processFrame);
}

// --- Detect new tracking points using FAST corners ---

function detectPoints(): void {
  const count = fastCorners(currPyr.data[0], corners, 20);
  pointCount = Math.min(count, MAX_POINTS);
  for (let i = 0; i < pointCount; i++) {
    prevXY[i * 2] = corners[i].x;
    prevXY[i * 2 + 1] = corners[i].y;
  }
}

// --- Processing loop ---

function processFrame(): void {
  ctx.drawImage(video, 0, 0, WIDTH, HEIGHT);
  const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);

  // Convert to grayscale
  grayscale(imageData.data as unknown as Uint8Array, WIDTH, HEIGHT, grayMatrix);

  // Swap pyramids: current becomes previous
  const tempPyr = prevPyr;
  // Copy current data to previous (swap references)
  grayMatrix.copyTo(currPyr.data[0]);
  currPyr.build(currPyr.data[0], true);

  if (!initialized) {
    // First frame: just store grayscale and detect initial points
    grayMatrix.copyTo(prevPyr.data[0]);
    prevPyr.build(prevPyr.data[0], true);
    detectPoints();
    initialized = true;
    requestAnimationFrame(processFrame);
    return;
  }

  // Track points from previous to current frame
  if (pointCount > 0) {
    lucasKanade(prevPyr, currPyr, prevXY, currXY, pointCount, WIN_SIZE, MAX_ITER, status);
  }

  // Draw the original frame
  ctx.putImageData(imageData, 0, 0);

  // Visualize tracked points and motion vectors
  let activeCount = 0;
  ctx.strokeStyle = 'lime';
  ctx.fillStyle = 'red';
  ctx.lineWidth = 1;
  for (let i = 0; i < pointCount; i++) {
    if (status[i] === 1) {
      const px = prevXY[i * 2], py = prevXY[i * 2 + 1];
      const cx = currXY[i * 2], cy = currXY[i * 2 + 1];

      // Draw motion vector
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      // Draw current position
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, 2 * Math.PI);
      ctx.fill();

      activeCount++;
    }
  }

  // If too few points are tracked, re-detect
  if (activeCount < 30) {
    detectPoints();
  } else {
    // Carry forward tracked points as previous for next frame
    const tempXY = prevXY;
    prevXY = currXY;
    currXY = tempXY;
    pointCount = activeCount;
  }

  // Copy current pyramid to previous for next iteration
  currPyr.data[0].copyTo(prevPyr.data[0]);
  prevPyr.build(prevPyr.data[0], true);

  ctx.fillStyle = 'white';
  ctx.font = '16px monospace';
  ctx.fillText(`Tracked: ${activeCount}`, 10, 25);

  requestAnimationFrame(processFrame);
}

startWebcam().catch(console.error);
