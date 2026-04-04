// Example: Grayscale Conversion
// Demonstrates: webcam capture, grayscale() from jsfeat/imgproc, Matrix from jsfeat/core

import { Matrix, U8C1 } from 'jsfeat/core';
import { grayscale } from 'jsfeat/imgproc';

// --- Setup canvas and video elements ---

const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const WIDTH = 640;
const HEIGHT = 480;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// Allocate a grayscale matrix once for reuse
const grayMatrix = new Matrix(WIDTH, HEIGHT, U8C1);

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
  // Draw the video frame to the canvas to get pixel data
  ctx.drawImage(video, 0, 0, WIDTH, HEIGHT);
  const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);

  // Convert RGBA pixel data to grayscale
  grayscale(imageData.data as unknown as Uint8Array, WIDTH, HEIGHT, grayMatrix);

  // Write the grayscale result back to the canvas
  const output = ctx.createImageData(WIDTH, HEIGHT);
  const grayData = grayMatrix.data;
  for (let i = 0, j = 0; i < grayData.length; i++, j += 4) {
    const v = grayData[i];
    output.data[j] = v;       // R
    output.data[j + 1] = v;   // G
    output.data[j + 2] = v;   // B
    output.data[j + 3] = 255; // A
  }
  ctx.putImageData(output, 0, 0);

  requestAnimationFrame(processFrame);
}

startWebcam().catch(console.error);
