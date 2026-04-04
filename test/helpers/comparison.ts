/**
 * Test helpers for comparing matrices and numeric arrays.
 */

import { expect } from 'vitest';
import { Matrix } from '../../src/core/matrix';

/**
 * Assert that two matrices have identical dimensions and that every element
 * is within `epsilon` of the corresponding element in the other matrix.
 */
export function expectMatricesClose(
  a: Matrix,
  b: Matrix,
  epsilon = 1e-6,
): void {
  expect(a.cols).toBe(b.cols);
  expect(a.rows).toBe(b.rows);
  expect(a.channel).toBe(b.channel);

  const n = a.cols * a.rows * a.channel;
  for (let i = 0; i < n; i++) {
    expect(Math.abs(a.data[i] - b.data[i])).toBeLessThanOrEqual(epsilon);
  }
}

/**
 * Assert that two numeric arrays (or typed arrays) are element-wise equal
 * within `epsilon`.
 */
export function expectArrayClose(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  epsilon = 1e-6,
): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(epsilon);
  }
}
