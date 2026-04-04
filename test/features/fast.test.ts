import { describe, it, expect } from 'vitest';
import { fastCorners, setThreshold, detect } from '../../src/features/fast';
import { Matrix } from '../../src/core/matrix';
import { Keypoint } from '../../src/core/keypoint';
import { U8C1 } from '../../src/core/types';
import { filled } from '../helpers/synthetic';

function allocateCorners(n: number): Keypoint[] {
  const arr: Keypoint[] = [];
  for (let i = 0; i < n; i++) {
    arr.push(new Keypoint());
  }
  return arr;
}

/** Create a U8C1 image with white circles on black background (produces FAST corners). */
function circlesImage(cols: number, rows: number): Matrix {
  const m = new Matrix(cols, rows, U8C1);
  const centers = [
    { x: cols * 0.25, y: rows * 0.25, r: 15 },
    { x: cols * 0.75, y: rows * 0.25, r: 10 },
    { x: cols * 0.5,  y: rows * 0.75, r: 20 },
  ];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let val = 0;
      for (const c of centers) {
        const dx = col - c.x, dy = row - c.y;
        if (dx * dx + dy * dy < c.r * c.r) val = 255;
      }
      (m.data as Uint8Array)[row * cols + col] = val;
    }
  }
  return m;
}

describe('FAST corners', () => {
  it('detects corners on circles image', () => {
    const src = circlesImage(128, 128);
    const corners = allocateCorners(2000);
    const count = fastCorners(src, corners, 20, 3);
    expect(count).toBeGreaterThan(0);
  });

  it('finds 0 corners in a uniform image', () => {
    const src = filled(64, 64, 128);
    const corners = allocateCorners(1000);
    const count = fastCorners(src, corners, 20, 3);
    expect(count).toBe(0);
  });

  it('corner coordinates are within image bounds', () => {
    const w = 128, h = 128;
    const src = circlesImage(w, h);
    const corners = allocateCorners(2000);
    const count = fastCorners(src, corners, 20, 3);
    for (let i = 0; i < count; i++) {
      expect(corners[i].x).toBeGreaterThanOrEqual(0);
      expect(corners[i].x).toBeLessThan(w);
      expect(corners[i].y).toBeGreaterThanOrEqual(0);
      expect(corners[i].y).toBeLessThan(h);
    }
  });

  it('scores are positive', () => {
    const src = circlesImage(128, 128);
    const corners = allocateCorners(2000);
    const count = fastCorners(src, corners, 20, 3);
    for (let i = 0; i < count; i++) {
      expect(corners[i].score).toBeGreaterThan(0);
    }
  });

  it('setThreshold clamps to [0, 255]', () => {
    expect(setThreshold(-10)).toBe(0);
    expect(setThreshold(300)).toBe(255);
    expect(setThreshold(50)).toBe(50);
  });
});
