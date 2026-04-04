import { describe, it, expect } from 'vitest';
import { orbDescribe } from '../../src/features/orb';
import { fastCorners } from '../../src/features/fast';
import { Matrix } from '../../src/core/matrix';
import { Keypoint } from '../../src/core/keypoint';
import { U8C1, S32C1 } from '../../src/core/types';

/** Create a U8C1 image with white circles on black background. */
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

function allocateCorners(n: number): Keypoint[] {
  const arr: Keypoint[] = [];
  for (let i = 0; i < n; i++) {
    arr.push(new Keypoint());
  }
  return arr;
}

describe('orbDescribe', () => {
  it('computes descriptors for FAST corners with non-zero output', () => {
    const src = circlesImage(128, 128);
    const corners = allocateCorners(500);
    const count = fastCorners(src, corners, 20, 3);
    expect(count).toBeGreaterThan(0);

    // Set angles for each corner (ORB needs angles)
    for (let i = 0; i < count; i++) {
      corners[i].angle = 0;
    }

    const descriptors = new Matrix(32, count, U8C1);
    orbDescribe(src, corners, count, descriptors);

    // Check that descriptors is valid
    expect(descriptors.cols).toBe(32);
    expect(descriptors.rows).toBe(count);

    // At least some descriptor bytes should be non-zero
    let nonZero = 0;
    for (let i = 0; i < count * 32; i++) {
      if (descriptors.data[i] !== 0) nonZero++;
    }
    expect(nonZero).toBeGreaterThan(0);
  });

  it('resizes descriptors matrix to U8 type if needed', () => {
    const src = circlesImage(128, 128);
    const corners = allocateCorners(500);
    const count = fastCorners(src, corners, 20, 3);
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      corners[i].angle = 0;
    }

    // Pass S32C1 descriptor matrix -- should be retyped to U8
    const descriptors = new Matrix(1, 1, S32C1);
    orbDescribe(src, corners, count, descriptors);
    expect(descriptors.cols).toBe(32);
    expect(descriptors.rows).toBe(count);
  });
});
