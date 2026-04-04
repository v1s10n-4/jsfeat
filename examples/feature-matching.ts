// Example: ORB Feature Descriptors
// Demonstrates: fastCorners() and orbDescribe() from jsfeat/features,
//               grayscale(), gaussianBlur() from jsfeat/imgproc

import { Matrix, Keypoint, U8C1 } from 'jsfeat/core';
import { grayscale, gaussianBlur } from 'jsfeat/imgproc';
import { fastCorners, orbDescribe } from 'jsfeat/features';

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

// Pre-allocate processing matrices
const grayMatrix = new Matrix(WIDTH, HEIGHT, U8C1);
const blurMatrix = new Matrix(WIDTH, HEIGHT, U8C1);

// Pre-allocate keypoints
const MAX_CORNERS = 500;
const corners: Keypoint[] = [];
for (let i = 0; i < MAX_CORNERS; i++) {
  corners.push(new Keypoint());
}

// Descriptor output matrix (will be resized by orbDescribe)
const descriptors = new Matrix(32, MAX_CORNERS, U8C1);

// ORB needs keypoints with orientation; compute simple gradient angle
function computeOrientations(
  img: Matrix,
  keypoints: Keypoint[],
  count: number,
): void {
  const data = img.data;
  const w = img.cols;
  const patchRadius = 8;
  for (let i = 0; i < count; i++) {
    const kp = keypoints[i];
    const cx = kp.x | 0;
    const cy = kp.y | 0;

    // Simple intensity centroid for orientation
    let mx = 0, my = 0;
    for (let dy = -patchRadius; dy <= patchRadius; dy++) {
      for (let dx = -patchRadius; dx <= patchRadius; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px >= 0 && px < w && py >= 0 && py < img.rows) {
          const val = data[py * w + px];
          mx += dx * val;
          my += dy * val;
        }
      }
    }
    kp.angle = Math.atan2(my, mx);
  }
}

// Compute Hamming distance between two 32-byte descriptors
function hammingDistance(d1: Uint8Array, off1: number, d2: Uint8Array, off2: number): number {
  let dist = 0;
  for (let i = 0; i < 32; i++) {
    let xor = d1[off1 + i] ^ d2[off2 + i];
    while (xor) {
      dist++;
      xor &= xor - 1; // clear lowest set bit
    }
  }
  return dist;
}

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

  // Convert to grayscale and blur slightly
  grayscale(imageData.data as unknown as Uint8Array, WIDTH, HEIGHT, grayMatrix);
  gaussianBlur(grayMatrix, blurMatrix, 3, 1.0);

  // Detect FAST corners
  let count = fastCorners(blurMatrix, corners, 25);
  count = Math.min(count, MAX_CORNERS);

  // Filter out corners too close to the border (ORB needs a 16-pixel patch)
  let validCount = 0;
  for (let i = 0; i < count; i++) {
    if (corners[i].x >= 16 && corners[i].x < WIDTH - 16 &&
        corners[i].y >= 16 && corners[i].y < HEIGHT - 16) {
      if (validCount !== i) {
        corners[validCount].x = corners[i].x;
        corners[validCount].y = corners[i].y;
        corners[validCount].score = corners[i].score;
      }
      validCount++;
    }
  }

  // Compute keypoint orientations (needed by ORB)
  computeOrientations(blurMatrix, corners, validCount);

  // Compute ORB descriptors
  if (validCount > 0) {
    orbDescribe(blurMatrix, corners, validCount, descriptors);
  }

  // Draw original frame
  ctx.putImageData(imageData, 0, 0);

  // Visualize keypoints with orientation arrows
  ctx.strokeStyle = 'cyan';
  ctx.fillStyle = 'cyan';
  ctx.lineWidth = 1;
  const arrowLen = 10;
  for (let i = 0; i < validCount; i++) {
    const kp = corners[i];
    // Draw keypoint circle
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
    ctx.stroke();
    // Draw orientation arrow
    ctx.beginPath();
    ctx.moveTo(kp.x, kp.y);
    ctx.lineTo(
      kp.x + arrowLen * Math.cos(kp.angle),
      kp.y + arrowLen * Math.sin(kp.angle),
    );
    ctx.stroke();
  }

  ctx.fillStyle = 'white';
  ctx.font = '16px monospace';
  ctx.fillText(`Features: ${validCount} (32-byte ORB descriptors)`, 10, 25);

  requestAnimationFrame(processFrame);
}

startWebcam().catch(console.error);
