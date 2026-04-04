// Example: RANSAC Homography Estimation
// Demonstrates: ransac(), homography2d, createRansacParams() from jsfeat/motion,
//               Matrix from jsfeat/core

import { Matrix, F32C1 } from 'jsfeat/core';
import { ransac, homography2d, createRansacParams } from 'jsfeat/motion';

// --- Setup ---

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = 640;
canvas.height = 480;

// --- Generate synthetic point correspondences ---
// Simulate a known homography with some outlier noise

// True homography: a slight rotation + translation
const trueH = [
  0.98, -0.17, 30.0,
  0.17,  0.98, 10.0,
  0.0001, 0.0002, 1.0,
];

// Generate source points on a grid
const NUM_POINTS = 50;
const NUM_OUTLIERS = 12; // ~24% outlier ratio
const srcPoints: { x: number; y: number }[] = [];
const dstPoints: { x: number; y: number }[] = [];

for (let i = 0; i < NUM_POINTS; i++) {
  const sx = 100 + Math.random() * 400;
  const sy = 100 + Math.random() * 300;
  srcPoints.push({ x: sx, y: sy });

  if (i < NUM_POINTS - NUM_OUTLIERS) {
    // Inlier: apply true homography
    const w = trueH[6] * sx + trueH[7] * sy + trueH[8];
    const dx = (trueH[0] * sx + trueH[1] * sy + trueH[2]) / w;
    const dy = (trueH[3] * sx + trueH[4] * sy + trueH[5]) / w;
    // Add small Gaussian noise
    dstPoints.push({
      x: dx + (Math.random() - 0.5) * 1.0,
      y: dy + (Math.random() - 0.5) * 1.0,
    });
  } else {
    // Outlier: random destination
    dstPoints.push({
      x: Math.random() * 640,
      y: Math.random() * 480,
    });
  }
}

// --- Run RANSAC to estimate the homography ---

// Output model: 3x3 homography matrix
const model = new Matrix(3, 3, F32C1);

// Inlier mask: 1 = inlier, 0 = outlier
const mask = new Matrix(NUM_POINTS, 1, 0x0100 | 0x01); // U8C1

// Configure RANSAC parameters
const params = createRansacParams(
  4,     // minimum 4 points for a homography
  3.0,   // reprojection error threshold in pixels
  0.5,   // initial expected outlier ratio
  0.99,  // desired confidence
);

const success = ransac(params, homography2d, srcPoints, dstPoints, NUM_POINTS, model, mask);

// --- Visualize results ---

// Clear canvas
ctx.fillStyle = '#222';
ctx.fillRect(0, 0, 640, 480);

// Draw correspondences
for (let i = 0; i < NUM_POINTS; i++) {
  const isInlier = mask.data[i] === 1;

  // Source point
  ctx.fillStyle = isInlier ? 'lime' : 'red';
  ctx.beginPath();
  ctx.arc(srcPoints[i].x, srcPoints[i].y, 4, 0, 2 * Math.PI);
  ctx.fill();

  // Destination point
  ctx.fillStyle = isInlier ? 'cyan' : 'orange';
  ctx.beginPath();
  ctx.arc(dstPoints[i].x, dstPoints[i].y, 4, 0, 2 * Math.PI);
  ctx.fill();

  // Line connecting src to dst
  ctx.strokeStyle = isInlier ? 'rgba(0,255,0,0.3)' : 'rgba(255,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(srcPoints[i].x, srcPoints[i].y);
  ctx.lineTo(dstPoints[i].x, dstPoints[i].y);
  ctx.stroke();
}

// Display the estimated homography
const md = model.data;
ctx.fillStyle = 'white';
ctx.font = '14px monospace';
ctx.fillText(`RANSAC ${success ? 'SUCCESS' : 'FAILED'}`, 10, 25);
ctx.fillText(`Estimated homography:`, 10, 50);
ctx.fillText(`[ ${md[0].toFixed(4)}  ${md[1].toFixed(4)}  ${md[2].toFixed(2)} ]`, 10, 70);
ctx.fillText(`[ ${md[3].toFixed(4)}  ${md[4].toFixed(4)}  ${md[5].toFixed(2)} ]`, 10, 90);
ctx.fillText(`[ ${md[6].toFixed(6)}  ${md[7].toFixed(6)}  ${md[8].toFixed(4)} ]`, 10, 110);

// Count inliers
let inlierCount = 0;
for (let i = 0; i < NUM_POINTS; i++) {
  if (mask.data[i] === 1) inlierCount++;
}
ctx.fillText(`Inliers: ${inlierCount} / ${NUM_POINTS}`, 10, 135);
ctx.fillText(`Legend: green/cyan = inlier, red/orange = outlier`, 10, 160);
