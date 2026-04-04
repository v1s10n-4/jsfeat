import { describe, it, expect } from 'vitest';
import {
  getGaussianKernel,
  qsort,
  median,
} from '../../src/math/math';
import { DataType } from '../../src/core/types';

describe('getGaussianKernel', () => {
  it('generates a size-1 kernel with value 1', () => {
    const kernel = new Float32Array(1);
    getGaussianKernel(1, 0, kernel, DataType.F32);
    expect(kernel[0]).toBeCloseTo(1.0, 5);
  });

  it('generates a size-3 hardcoded kernel that sums to ~1', () => {
    const kernel = new Float32Array(3);
    getGaussianKernel(3, 0, kernel, DataType.F32);
    const sum = kernel[0] + kernel[1] + kernel[2];
    expect(sum).toBeCloseTo(1.0, 5);
    expect(kernel[0]).toBeCloseTo(0.25, 5);
    expect(kernel[1]).toBeCloseTo(0.5, 5);
    expect(kernel[2]).toBeCloseTo(0.25, 5);
  });

  it('generates a size-5 hardcoded kernel that sums to ~1', () => {
    const kernel = new Float32Array(5);
    getGaussianKernel(5, 0, kernel, DataType.F32);
    let sum = 0;
    for (let i = 0; i < 5; i++) sum += kernel[i];
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('generates a size-7 hardcoded kernel that sums to ~1', () => {
    const kernel = new Float32Array(7);
    getGaussianKernel(7, 0, kernel, DataType.F32);
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += kernel[i];
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('generates a computed kernel for size > 7', () => {
    const kernel = new Float32Array(9);
    getGaussianKernel(9, 1.5, kernel, DataType.F32);
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += kernel[i];
    expect(sum).toBeCloseTo(1.0, 4);
    // Should be symmetric
    expect(kernel[0]).toBeCloseTo(kernel[8], 5);
    expect(kernel[1]).toBeCloseTo(kernel[7], 5);
    expect(kernel[2]).toBeCloseTo(kernel[6], 5);
    expect(kernel[3]).toBeCloseTo(kernel[5], 5);
  });

  it('generates U8 kernel that sums to ~256', () => {
    const kernel = new Int32Array(5);
    getGaussianKernel(5, 0, kernel, DataType.U8);
    let sum = 0;
    for (let i = 0; i < 5; i++) sum += kernel[i];
    expect(sum).toBe(256);
  });

  it('uses auto-sigma for non-hardcoded even sizes', () => {
    const kernel = new Float32Array(8);
    getGaussianKernel(8, 0, kernel, DataType.F32);
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += kernel[i];
    expect(sum).toBeCloseTo(1.0, 4);
  });

  it('uses auto-sigma for non-hardcoded sizes > 7', () => {
    const kernel = new Float32Array(11);
    getGaussianKernel(11, -1, kernel, DataType.F32);
    let sum = 0;
    for (let i = 0; i < 11; i++) sum += kernel[i];
    expect(sum).toBeCloseTo(1.0, 4);
  });
});

describe('qsort', () => {
  it('sorts an array of numbers in ascending order', () => {
    const arr = [5, 3, 8, 1, 2, 7, 4, 6];
    qsort(arr, 0, arr.length - 1, (a, b) => a < b);
    expect(arr).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('sorts in descending order with reversed comparator', () => {
    const arr = [5, 3, 8, 1, 2, 7, 4, 6];
    qsort(arr, 0, arr.length - 1, (a, b) => a > b);
    expect(arr).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('handles already sorted array', () => {
    const arr = [1, 2, 3, 4, 5];
    qsort(arr, 0, arr.length - 1, (a, b) => a < b);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles array with duplicates', () => {
    const arr = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
    qsort(arr, 0, arr.length - 1, (a, b) => a < b);
    expect(arr).toEqual([1, 1, 2, 3, 3, 4, 5, 5, 5, 6, 9]);
  });

  it('handles single element', () => {
    const arr = [42];
    qsort(arr, 0, 0, (a, b) => a < b);
    expect(arr).toEqual([42]);
  });

  it('handles two elements', () => {
    const arr = [2, 1];
    qsort(arr, 0, 1, (a, b) => a < b);
    expect(arr).toEqual([1, 2]);
  });

  it('sorts a subrange only', () => {
    const arr = [9, 5, 3, 8, 1, 2, 7];
    qsort(arr, 2, 5, (a, b) => a < b);
    expect(arr).toEqual([9, 5, 1, 2, 3, 8, 7]);
  });

  it('sorts a large array', () => {
    const arr: number[] = [];
    for (let i = 0; i < 100; i++) arr.push(Math.floor(Math.random() * 1000));
    const expected = [...arr].sort((a, b) => a - b);
    qsort(arr, 0, arr.length - 1, (a, b) => a < b);
    expect(arr).toEqual(expected);
  });
});

describe('median', () => {
  it('finds the median of an odd-length array', () => {
    const arr = [5, 3, 1, 4, 2];
    const result = median(arr, 0, arr.length - 1);
    expect(result).toBe(3);
  });

  it('finds the median of an even-length array', () => {
    const arr = [4, 2, 1, 3];
    const result = median(arr, 0, arr.length - 1);
    // median index = (0+3)>>1 = 1, so it returns the element at index 1
    // after partial sort: 1,2,3,4 -> arr[1] = 2
    expect(result).toBe(2);
  });

  it('finds the median of a single-element array', () => {
    const arr = [42];
    const result = median(arr, 0, 0);
    expect(result).toBe(42);
  });

  it('finds the median of a two-element array', () => {
    const arr = [5, 1];
    const result = median(arr, 0, 1);
    // median index = (0+1)>>1 = 0
    expect(result).toBe(1);
  });

  it('finds the median of an already sorted array', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = median(arr, 0, arr.length - 1);
    expect(result).toBe(3);
  });

  it('finds the median of reverse-sorted array', () => {
    const arr = [5, 4, 3, 2, 1];
    const result = median(arr, 0, arr.length - 1);
    expect(result).toBe(3);
  });
});
