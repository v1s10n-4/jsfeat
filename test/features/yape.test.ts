import { describe, it, expect } from 'vitest';
import { yape06Detect } from '../../src/features/yape06';
import { yapeDetect, yapeInit } from '../../src/features/yape';
import { Matrix } from '../../src/core/matrix';
import { Keypoint } from '../../src/core/keypoint';
import { U8C1 } from '../../src/core/types';
import { filled } from '../helpers/synthetic';

function allocatePoints(n: number): Keypoint[] {
  const arr: Keypoint[] = [];
  for (let i = 0; i < n; i++) {
    arr.push(new Keypoint());
  }
  return arr;
}

/** Create a U8C1 image with Gaussian blobs (produces strong Laplacian responses). */
function gaussBlobImage(cols: number, rows: number): Matrix {
  const m = new Matrix(cols, rows, U8C1);
  const centers = [
    { x: 40, y: 40, sigma: 8 },
    { x: 90, y: 40, sigma: 6 },
    { x: 60, y: 90, sigma: 10 },
  ];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let val = 0;
      for (const c of centers) {
        const dx = col - c.x, dy = row - c.y;
        val += 200 * Math.exp(-(dx * dx + dy * dy) / (2 * c.sigma * c.sigma));
      }
      (m.data as Uint8Array)[row * cols + col] = Math.min(255, Math.round(val));
    }
  }
  return m;
}

// ---------------------------------------------------------------------------
// YAPE06
// ---------------------------------------------------------------------------

describe('yape06Detect', () => {
  it('detects keypoints in a blob image', () => {
    const src = gaussBlobImage(128, 128);
    const points = allocatePoints(2000);
    const count = yape06Detect(src, points);
    expect(count).toBeGreaterThan(0);
  });

  it('finds 0 keypoints in a uniform image', () => {
    const src = filled(128, 128, 128);
    const points = allocatePoints(2000);
    const count = yape06Detect(src, points);
    expect(count).toBe(0);
  });

  it('keypoint coordinates are within image bounds', () => {
    const w = 128, h = 128;
    const src = gaussBlobImage(w, h);
    const points = allocatePoints(2000);
    const count = yape06Detect(src, points);
    for (let i = 0; i < count; i++) {
      expect(points[i].x).toBeGreaterThanOrEqual(0);
      expect(points[i].x).toBeLessThan(w);
      expect(points[i].y).toBeGreaterThanOrEqual(0);
      expect(points[i].y).toBeLessThan(h);
    }
  });
});

// ---------------------------------------------------------------------------
// YAPE
// ---------------------------------------------------------------------------

describe('yapeDetect', () => {
  it('detects keypoints in a blob image', () => {
    const w = 128, h = 128;
    const src = gaussBlobImage(w, h);
    yapeInit(w, h, 5, 1);
    const points = allocatePoints(2000);
    const count = yapeDetect(src, points);
    expect(count).toBeGreaterThan(0);
  });

  it('finds 0 keypoints in a uniform image', () => {
    const w = 128, h = 128;
    const src = filled(w, h, 128);
    yapeInit(w, h, 5, 1);
    const points = allocatePoints(2000);
    const count = yapeDetect(src, points);
    expect(count).toBe(0);
  });
});
