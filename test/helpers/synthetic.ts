/**
 * Synthetic image generators for testing.
 */

import { Matrix } from '../../src/core/matrix';
import { U8C1, Channel } from '../../src/core/types';

/**
 * Create a matrix filled with a uniform value.
 */
export function filled(
  cols: number,
  rows: number,
  value: number,
  type = U8C1,
): Matrix {
  const m = new Matrix(cols, rows, type);
  const n = cols * rows * m.channel;
  for (let i = 0; i < n; i++) {
    m.data[i] = value;
  }
  return m;
}

/**
 * Create a single-channel U8 image with a horizontal gradient:
 * 0 at the left edge, 255 at the right edge.
 */
export function horizontalGradient(cols: number, rows: number): Matrix {
  const m = new Matrix(cols, rows, U8C1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      m.data[r * cols + c] = Math.round((c / Math.max(cols - 1, 1)) * 255);
    }
  }
  return m;
}

/**
 * Create a single-channel U8 checkerboard pattern (alternating black/white blocks).
 */
export function checkerboard(
  cols: number,
  rows: number,
  blockSize: number,
): Matrix {
  const m = new Matrix(cols, rows, U8C1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bx = Math.floor(c / blockSize);
      const by = Math.floor(r / blockSize);
      m.data[r * cols + c] = (bx + by) % 2 === 0 ? 255 : 0;
    }
  }
  return m;
}

/**
 * Create a single-channel U8 image with a white square on a black background.
 *
 * @param cols  Image width.
 * @param rows  Image height.
 * @param x     Left edge of the square.
 * @param y     Top edge of the square.
 * @param size  Side length of the square.
 */
export function square(
  cols: number,
  rows: number,
  x: number,
  y: number,
  size: number,
): Matrix {
  const m = new Matrix(cols, rows, U8C1);
  // Background is already 0 (Uint8Array default)
  for (let r = y; r < Math.min(y + size, rows); r++) {
    for (let c = x; c < Math.min(x + size, cols); c++) {
      m.data[r * cols + c] = 255;
    }
  }
  return m;
}

/**
 * Convert a single-channel gray Matrix to an RGBA Uint8ClampedArray
 * (suitable for ImageData).
 */
export function rgbaFromGray(gray: Matrix): Uint8ClampedArray {
  if (gray.channel !== Channel.C1) {
    throw new Error('rgbaFromGray expects a single-channel matrix');
  }

  const n    = gray.cols * gray.rows;
  const rgba = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const v = gray.data[i];
    rgba[i * 4]     = v; // R
    rgba[i * 4 + 1] = v; // G
    rgba[i * 4 + 2] = v; // B
    rgba[i * 4 + 3] = 255; // A
  }
  return rgba;
}
