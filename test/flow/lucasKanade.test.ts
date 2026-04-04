import { describe, it, expect } from 'vitest';
import { lucasKanade } from '../../src/flow/lucasKanade';
import { Pyramid } from '../../src/core/pyramid';
import { Matrix } from '../../src/core/matrix';
import { U8C1 } from '../../src/core/types';
import { pyrDown } from '../../src/imgproc/imgproc';

/**
 * Create a U8C1 image with a white square at (x, y) of given size
 * on a mid-gray background.
 */
function makeFrame(
  cols: number,
  rows: number,
  sqX: number,
  sqY: number,
  sqSize: number,
): Matrix {
  const m = new Matrix(cols, rows, U8C1);
  // Fill with mid-gray background
  for (let i = 0; i < cols * rows; i++) {
    (m.data as Uint8Array)[i] = 80;
  }
  // Draw white square
  for (let r = sqY; r < Math.min(sqY + sqSize, rows); r++) {
    for (let c = sqX; c < Math.min(sqX + sqSize, cols); c++) {
      (m.data as Uint8Array)[r * cols + c] = 220;
    }
  }
  return m;
}

/**
 * Build a 2-level pyramid from an image.
 */
function buildPyramid(img: Matrix, levels: number = 2): Pyramid {
  const pyr = new Pyramid(levels);
  pyr.allocate(img.cols, img.rows, U8C1);
  pyr.pyrdown = pyrDown;
  // Copy level 0
  const n = img.cols * img.rows;
  for (let i = 0; i < n; i++) {
    pyr.data[0].data[i] = img.data[i];
  }
  // Build remaining levels
  if (levels > 1) {
    pyr.build(img, true);
  }
  return pyr;
}

describe('lucasKanade', () => {
  it('tracks a translated square corner to approximate offset', () => {
    const w = 128, h = 128;
    const sqSize = 30;
    const dx = 4, dy = 3;

    // Frame 1: square at (40, 40)
    const frame1 = makeFrame(w, h, 40, 40, sqSize);
    // Frame 2: square shifted by (dx, dy)
    const frame2 = makeFrame(w, h, 40 + dx, 40 + dy, sqSize);

    const prevPyr = buildPyramid(frame1, 2);
    const currPyr = buildPyramid(frame2, 2);

    // Track a corner of the square (where gradient is strong)
    const ptX = 40;
    const ptY = 40;
    const prevXY = new Float32Array([ptX, ptY]);
    const currXY = new Float32Array([0, 0]);
    const status = new Uint8Array(1);

    lucasKanade(prevPyr, currPyr, prevXY, currXY, 1, 10, 30, status, 0.01, 0.0001);

    expect(status[0]).toBe(1);
    // The tracked point should be near the expected new position
    expect(currXY[0]).toBeCloseTo(ptX + dx, 0);
    expect(currXY[1]).toBeCloseTo(ptY + dy, 0);
  });

  it('marks points as lost when outside bounds', () => {
    const w = 64, h = 64;
    const frame = makeFrame(w, h, 20, 20, 20);
    const prevPyr = buildPyramid(frame, 2);
    const currPyr = buildPyramid(frame, 2);

    // Point near edge
    const prevXY = new Float32Array([2, 2]);
    const currXY = new Float32Array([0, 0]);
    const status = new Uint8Array(1);

    lucasKanade(prevPyr, currPyr, prevXY, currXY, 1, 20, 30, status, 0.01, 0.0001);

    // Point should be lost due to being too close to border
    expect(status[0]).toBe(0);
  });

  it('tracks stationary corner point (no motion)', () => {
    const w = 128, h = 128;
    const frame = makeFrame(w, h, 40, 40, 30);
    const prevPyr = buildPyramid(frame, 2);
    const currPyr = buildPyramid(frame, 2);

    // Track a corner of the square (has gradient in both directions)
    const ptX = 40;
    const ptY = 40;
    const prevXY = new Float32Array([ptX, ptY]);
    const currXY = new Float32Array([0, 0]);
    const status = new Uint8Array(1);

    lucasKanade(prevPyr, currPyr, prevXY, currXY, 1, 10, 30, status, 0.01, 0.0001);

    expect(status[0]).toBe(1);
    expect(currXY[0]).toBeCloseTo(ptX, 0);
    expect(currXY[1]).toBeCloseTo(ptY, 0);
  });
});
