// Example: Canny Edge Detection
// Demonstrates: grayscale(), gaussianBlur(), cannyEdges() from jsfeat/imgproc

import { Matrix, U8C1 } from 'jsfeat/core';
import { grayscale, gaussianBlur, cannyEdges } from 'jsfeat/imgproc';

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

// Pre-allocate matrices for each processing step
const grayMatrix = new Matrix(WIDTH, HEIGHT, U8C1);
const blurMatrix = new Matrix(WIDTH, HEIGHT, U8C1);
const edgeMatrix = new Matrix(WIDTH, HEIGHT, U8C1);

// Canny parameters -- adjust these to tune edge sensitivity
const LOW_THRESHOLD = 20;
const HIGH_THRESHOLD = 50;
const BLUR_KERNEL_SIZE = 5;
const BLUR_SIGMA = 1.4;

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
  ctx.drawImage(video, 0, 0, WIDTH, HEIGHT);
  const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);

  // Step 1: Convert to grayscale
  grayscale(imageData.data as unknown as Uint8Array, WIDTH, HEIGHT, grayMatrix);

  // Step 2: Apply Gaussian blur to reduce noise
  gaussianBlur(grayMatrix, blurMatrix, BLUR_KERNEL_SIZE, BLUR_SIGMA);

  // Step 3: Run Canny edge detection
  cannyEdges(blurMatrix, edgeMatrix, LOW_THRESHOLD, HIGH_THRESHOLD);

  // Render edges as white on black background
  const output = ctx.createImageData(WIDTH, HEIGHT);
  const edgeData = edgeMatrix.data;
  for (let i = 0, j = 0; i < edgeData.length; i++, j += 4) {
    const v = edgeData[i];
    output.data[j] = v;
    output.data[j + 1] = v;
    output.data[j + 2] = v;
    output.data[j + 3] = 255;
  }
  ctx.putImageData(output, 0, 0);

  requestAnimationFrame(processFrame);
}

startWebcam().catch(console.error);
