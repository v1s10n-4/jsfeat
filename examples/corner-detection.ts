// Example: FAST Corner Detection
// Demonstrates: fastCorners() from jsfeat/features, grayscale() from jsfeat/imgproc

import { Matrix, Keypoint, U8C1 } from 'jsfeat/core';
import { grayscale } from 'jsfeat/imgproc';
import { fastCorners } from 'jsfeat/features';

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

// Pre-allocate grayscale matrix
const grayMatrix = new Matrix(WIDTH, HEIGHT, U8C1);

// Pre-allocate keypoint array (max corners we expect)
const MAX_CORNERS = 2000;
const corners: Keypoint[] = [];
for (let i = 0; i < MAX_CORNERS; i++) {
  corners.push(new Keypoint());
}

// Detection threshold -- higher = fewer but stronger corners
const THRESHOLD = 25;

// --- Start webcam ---

async function startWebcam(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: WIDTH, height: HEIGHT },
  });
  video.srcObject = stream;
  await video.play();
  requestAnimationFrame(processFrame);
}

// --- Processing loop ---

function processFrame(): void {
  // Draw video frame and convert to grayscale
  ctx.drawImage(video, 0, 0, WIDTH, HEIGHT);
  const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  grayscale(imageData.data as unknown as Uint8Array, WIDTH, HEIGHT, grayMatrix);

  // Detect FAST corners
  const count = fastCorners(grayMatrix, corners, THRESHOLD);

  // Draw the original video frame
  ctx.putImageData(imageData, 0, 0);

  // Overlay detected corners as green dots
  ctx.fillStyle = 'lime';
  for (let i = 0; i < count; i++) {
    const kp = corners[i];
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, 3, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Display corner count
  ctx.fillStyle = 'white';
  ctx.font = '16px monospace';
  ctx.fillText(`Corners: ${count}`, 10, 25);

  requestAnimationFrame(processFrame);
}

startWebcam().catch(console.error);
