// Example: HAAR Cascade Face Detection
// Demonstrates: haarDetectMultiScale(), groupRectangles() from jsfeat/detect,
//               computeIntegralImage(), grayscale(), cannyEdges() from jsfeat/imgproc,
//               frontalface cascade from jsfeat/cascades

import { Matrix, U8C1 } from 'jsfeat/core';
import { grayscale, computeIntegralImage, equalizeHistogram, cannyEdges } from 'jsfeat/imgproc';
import { haarDetectMultiScale, groupRectangles } from 'jsfeat/detect';
import { frontalface } from 'jsfeat/cascades';

// --- Setup ---

const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const WIDTH = 320;  // Use smaller resolution for detection performance
const HEIGHT = 240;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// Pre-allocate matrices
const grayMatrix = new Matrix(WIDTH, HEIGHT, U8C1);
const eqMatrix = new Matrix(WIDTH, HEIGHT, U8C1);
const cannyMatrix = new Matrix(WIDTH, HEIGHT, U8C1);

// Integral images: size = (w+1) * (h+1)
const integralSize = (WIDTH + 1) * (HEIGHT + 1);
const integralSum = new Int32Array(integralSize);
const integralSqSum = new Int32Array(integralSize);
const integralTilted = new Int32Array(integralSize);
const integralCanny = new Int32Array(integralSize);

// Detection parameters
const SCALE_FACTOR = 1.2;
const MIN_NEIGHBORS = 3;

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

  // Convert to grayscale and equalize histogram for better detection
  grayscale(imageData.data as unknown as Uint8Array, WIDTH, HEIGHT, grayMatrix);
  equalizeHistogram(grayMatrix, eqMatrix);

  // Compute integral images needed by the HAAR detector
  computeIntegralImage(eqMatrix, integralSum, integralSqSum, integralTilted);

  // Compute Canny edges for pruning (speeds up detection)
  cannyEdges(eqMatrix, cannyMatrix, 10, 50);
  computeIntegralImage(cannyMatrix, integralCanny);

  // Run multi-scale detection
  const rawRects = haarDetectMultiScale(
    integralSum, integralSqSum, integralTilted, integralCanny,
    WIDTH, HEIGHT,
    frontalface,
    SCALE_FACTOR,
  );

  // Group overlapping detections
  const faces = groupRectangles(rawRects, MIN_NEIGHBORS);

  // Draw the original frame
  ctx.putImageData(imageData, 0, 0);

  // Draw face rectangles
  ctx.strokeStyle = 'lime';
  ctx.lineWidth = 2;
  for (const face of faces) {
    ctx.strokeRect(face.x, face.y, face.width, face.height);
  }

  // Display detection count
  ctx.fillStyle = 'white';
  ctx.font = '14px monospace';
  ctx.fillText(`Faces: ${faces.length}`, 10, 20);

  requestAnimationFrame(processFrame);
}

startWebcam().catch(console.error);
