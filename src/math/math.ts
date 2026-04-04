/**
 * Math utilities -- Gaussian kernels, perspective transforms, quicksort, median.
 *
 * Ported from legacy/jsfeat_math.js.
 */

import { pool } from '../core/cache';
import { DataType } from '../core/types';
import type { Matrix } from '../core/matrix';
import type { TypedArrayUnion } from '../core/types';

// Module-level stack for qsort (matches legacy)
const qsortStack = new Int32Array(48 * 2);

/**
 * Generate a 1-D Gaussian kernel.
 *
 * For small odd sizes (1..7) and sigma <= 0, hardcoded kernels are used.
 * Otherwise the kernel is computed via the Gaussian formula.
 *
 * @param size - Kernel size (should be odd).
 * @param sigma - Gaussian sigma (<=0 triggers auto-compute from size).
 * @param kernel - Output array to fill with kernel values.
 * @param dataType - Data-type flag -- if U8, kernel is scaled to integer sum ~256.
 */
export function getGaussianKernel(
  size: number,
  sigma: number,
  kernel: TypedArrayUnion | number[],
  dataType: number,
): void {
  let i = 0;
  let x = 0.0;
  let t = 0.0;
  let sigma_x = 0.0;
  let scale_2x = 0.0;
  let sum = 0.0;
  const kernNode = pool.get(size << 2);
  const _kernel = kernNode.f32;

  if ((size & 1) === 1 && size <= 7 && sigma <= 0) {
    switch (size >> 1) {
      case 0:
        _kernel[0] = 1.0;
        sum = 1.0;
        break;
      case 1:
        _kernel[0] = 0.25;
        _kernel[1] = 0.5;
        _kernel[2] = 0.25;
        sum = 0.25 + 0.5 + 0.25;
        break;
      case 2:
        _kernel[0] = 0.0625;
        _kernel[1] = 0.25;
        _kernel[2] = 0.375;
        _kernel[3] = 0.25;
        _kernel[4] = 0.0625;
        sum = 0.0625 + 0.25 + 0.375 + 0.25 + 0.0625;
        break;
      case 3:
        _kernel[0] = 0.03125;
        _kernel[1] = 0.109375;
        _kernel[2] = 0.21875;
        _kernel[3] = 0.28125;
        _kernel[4] = 0.21875;
        _kernel[5] = 0.109375;
        _kernel[6] = 0.03125;
        sum =
          0.03125 + 0.109375 + 0.21875 + 0.28125 + 0.21875 + 0.109375 + 0.03125;
        break;
    }
  } else {
    sigma_x = sigma > 0 ? sigma : ((size - 1) * 0.5 - 1.0) * 0.3 + 0.8;
    scale_2x = -0.5 / (sigma_x * sigma_x);

    for (; i < size; ++i) {
      x = i - (size - 1) * 0.5;
      t = Math.exp(scale_2x * x * x);

      _kernel[i] = t;
      sum += t;
    }
  }

  if (dataType & DataType.U8) {
    // int based kernel
    sum = 256.0 / sum;
    for (i = 0; i < size; ++i) {
      kernel[i] = (_kernel[i] * sum + 0.5) | 0;
    }
  } else {
    // classic kernel
    sum = 1.0 / sum;
    for (i = 0; i < size; ++i) {
      kernel[i] = _kernel[i] * sum;
    }
  }

  pool.release(kernNode);
}

/**
 * Compute a 3x3 perspective (homography) transform from 4 point pairs.
 *
 * The result is written into the provided 3x3 Matrix.
 *
 * @param model - 3x3 Matrix to receive the homography result.
 * @param srcX0 - Source point 0 x coordinate.
 * @param srcY0 - Source point 0 y coordinate.
 * @param dstX0 - Destination point 0 x coordinate.
 * @param dstY0 - Destination point 0 y coordinate.
 * @param srcX1 - Source point 1 x coordinate.
 * @param srcY1 - Source point 1 y coordinate.
 * @param dstX1 - Destination point 1 x coordinate.
 * @param dstY1 - Destination point 1 y coordinate.
 * @param srcX2 - Source point 2 x coordinate.
 * @param srcY2 - Source point 2 y coordinate.
 * @param dstX2 - Destination point 2 x coordinate.
 * @param dstY2 - Destination point 2 y coordinate.
 * @param srcX3 - Source point 3 x coordinate.
 * @param srcY3 - Source point 3 y coordinate.
 * @param dstX3 - Destination point 3 x coordinate.
 * @param dstY3 - Destination point 3 y coordinate.
 */
export function perspective4PointTransform(
  model: Matrix,
  srcX0: number,
  srcY0: number,
  dstX0: number,
  dstY0: number,
  srcX1: number,
  srcY1: number,
  dstX1: number,
  dstY1: number,
  srcX2: number,
  srcY2: number,
  dstX2: number,
  dstY2: number,
  srcX3: number,
  srcY3: number,
  dstX3: number,
  dstY3: number,
): void {
  let t1 = srcX0;
  let t2 = srcX2;
  let t4 = srcY1;
  let t5 = t1 * t2 * t4;
  let t6 = srcY3;
  let t7 = t1 * t6;
  let t8 = t2 * t7;
  let t9 = srcY2;
  let t10 = t1 * t9;
  let t11 = srcX1;
  let t14 = srcY0;
  let t15 = srcX3;
  let t16 = t14 * t15;
  let t18 = t16 * t11;
  let t20 = t15 * t11 * t9;
  let t21 = t15 * t4;
  let t24 = t15 * t9;
  let t25 = t2 * t4;
  let t26 = t6 * t2;
  let t27 = t6 * t11;
  let t28 = t9 * t11;
  let t30 = 1.0 / (t21 - t24 - t25 + t26 - t27 + t28);
  let t32 = t1 * t15;
  let t35 = t14 * t11;
  let t41 = t4 * t1;
  let t42 = t6 * t41;
  let t43 = t14 * t2;
  let t46 = t16 * t9;
  let t48 = t14 * t9 * t11;
  let t51 = t4 * t6 * t2;
  let t55 = t6 * t14;
  const Hr0 =
    -(t8 - t5 + t10 * t11 - t11 * t7 - t16 * t2 + t18 - t20 + t21 * t2) *
    t30;
  const Hr1 =
    (t5 - t8 - t32 * t4 + t32 * t9 + t18 - t2 * t35 + t27 * t2 - t20) * t30;
  const Hr2 = t1;
  const Hr3 =
    (-t9 * t7 + t42 + t43 * t4 - t16 * t4 + t46 - t48 + t27 * t9 - t51) *
    t30;
  const Hr4 =
    (-t42 + t41 * t9 - t55 * t2 + t46 - t48 + t55 * t11 + t51 - t21 * t9) *
    t30;
  const Hr5 = t14;
  const Hr6 = (-t10 + t41 + t43 - t35 + t24 - t21 - t26 + t27) * t30;
  const Hr7 = (-t7 + t10 + t16 - t43 + t27 - t28 - t21 + t25) * t30;

  t1 = dstX0;
  t2 = dstX2;
  t4 = dstY1;
  t5 = t1 * t2 * t4;
  t6 = dstY3;
  t7 = t1 * t6;
  t8 = t2 * t7;
  t9 = dstY2;
  t10 = t1 * t9;
  t11 = dstX1;
  t14 = dstY0;
  t15 = dstX3;
  t16 = t14 * t15;
  t18 = t16 * t11;
  t20 = t15 * t11 * t9;
  t21 = t15 * t4;
  t24 = t15 * t9;
  t25 = t2 * t4;
  t26 = t6 * t2;
  t27 = t6 * t11;
  t28 = t9 * t11;
  t30 = 1.0 / (t21 - t24 - t25 + t26 - t27 + t28);
  t32 = t1 * t15;
  t35 = t14 * t11;
  t41 = t4 * t1;
  t42 = t6 * t41;
  t43 = t14 * t2;
  t46 = t16 * t9;
  t48 = t14 * t9 * t11;
  t51 = t4 * t6 * t2;
  t55 = t6 * t14;
  const Hl0 =
    -(t8 - t5 + t10 * t11 - t11 * t7 - t16 * t2 + t18 - t20 + t21 * t2) *
    t30;
  const Hl1 =
    (t5 - t8 - t32 * t4 + t32 * t9 + t18 - t2 * t35 + t27 * t2 - t20) * t30;
  const Hl2 = t1;
  const Hl3 =
    (-t9 * t7 + t42 + t43 * t4 - t16 * t4 + t46 - t48 + t27 * t9 - t51) *
    t30;
  const Hl4 =
    (-t42 + t41 * t9 - t55 * t2 + t46 - t48 + t55 * t11 + t51 - t21 * t9) *
    t30;
  const Hl5 = t14;
  const Hl6 = (-t10 + t41 + t43 - t35 + t24 - t21 - t26 + t27) * t30;
  const Hl7 = (-t7 + t10 + t16 - t43 + t27 - t28 - t21 + t25) * t30;

  // the following code computes R = Hl * inverse Hr
  t2 = Hr4 - Hr7 * Hr5;
  t4 = Hr0 * Hr4;
  t5 = Hr0 * Hr5;
  t7 = Hr3 * Hr1;
  t8 = Hr2 * Hr3;
  t10 = Hr1 * Hr6;
  const t12 = Hr2 * Hr6;
  t15 =
    1.0 / (t4 - t5 * Hr7 - t7 + t8 * Hr7 + t10 * Hr5 - t12 * Hr4);
  t18 = -Hr3 + Hr5 * Hr6;
  const t23 = -Hr3 * Hr7 + Hr4 * Hr6;
  t28 = -Hr1 + Hr2 * Hr7;
  const t31 = Hr0 - t12;
  t35 = Hr0 * Hr7 - t10;
  t41 = -Hr1 * Hr5 + Hr2 * Hr4;
  const t44 = t5 - t8;
  const t47 = t4 - t7;
  t48 = t2 * t15;
  const t49 = t28 * t15;
  const t50 = t41 * t15;
  const mat = model.data;
  mat[0] = Hl0 * t48 + Hl1 * (t18 * t15) - Hl2 * (t23 * t15);
  mat[1] = Hl0 * t49 + Hl1 * (t31 * t15) - Hl2 * (t35 * t15);
  mat[2] = -Hl0 * t50 - Hl1 * (t44 * t15) + Hl2 * (t47 * t15);
  mat[3] = Hl3 * t48 + Hl4 * (t18 * t15) - Hl5 * (t23 * t15);
  mat[4] = Hl3 * t49 + Hl4 * (t31 * t15) - Hl5 * (t35 * t15);
  mat[5] = -Hl3 * t50 - Hl4 * (t44 * t15) + Hl5 * (t47 * t15);
  mat[6] = Hl6 * t48 + Hl7 * (t18 * t15) - t23 * t15;
  mat[7] = Hl6 * t49 + Hl7 * (t31 * t15) - t35 * t15;
  mat[8] = -Hl6 * t50 - Hl7 * (t44 * t15) + t47 * t15;
}

/**
 * BSD-derived quicksort with insertion-sort fallback.
 *
 * Sorts `array[low..high]` in-place using the provided comparator.
 *
 * @param array - Array to sort in-place.
 * @param low - Start index (inclusive).
 * @param high - End index (inclusive).
 * @param cmp - Comparator: returns true when a \< b (strict less-than).
 */
export function qsort<T>(
  array: T[],
  low: number,
  high: number,
  cmp: (a: T, b: T) => boolean,
): void {
  const isort_thresh = 7;
  let t: T;
  let ta: T, tb: T, tc: T;
  let sp = 0,
    left = 0,
    right = 0,
    i = 0,
    n = 0,
    m = 0,
    ptr = 0,
    ptr2 = 0,
    d = 0;
  let left0 = 0,
    left1 = 0,
    right0 = 0,
    right1 = 0,
    pivot = 0,
    a = 0,
    b = 0,
    c = 0,
    swap_cnt = 0;

  const stack = qsortStack;

  if (high - low + 1 <= 1) return;

  stack[0] = low;
  stack[1] = high;

  while (sp >= 0) {
    left = stack[sp << 1];
    right = stack[(sp << 1) + 1];
    sp--;

    for (;;) {
      n = right - left + 1;

      if (n <= isort_thresh) {
        //insert_sort:
        for (ptr = left + 1; ptr <= right; ptr++) {
          for (
            ptr2 = ptr;
            ptr2 > left && cmp(array[ptr2], array[ptr2 - 1]);
            ptr2--
          ) {
            t = array[ptr2];
            array[ptr2] = array[ptr2 - 1];
            array[ptr2 - 1] = t;
          }
        }
        break;
      } else {
        swap_cnt = 0;

        left0 = left;
        right0 = right;
        pivot = left + (n >> 1);

        if (n > 40) {
          d = n >> 3;
          (a = left), (b = left + d), (c = left + (d << 1));
          (ta = array[a]), (tb = array[b]), (tc = array[c]);
          left = cmp(ta, tb)
            ? cmp(tb, tc)
              ? b
              : cmp(ta, tc)
                ? c
                : a
            : cmp(tc, tb)
              ? b
              : cmp(ta, tc)
                ? a
                : c;

          (a = pivot - d), (b = pivot), (c = pivot + d);
          (ta = array[a]), (tb = array[b]), (tc = array[c]);
          pivot = cmp(ta, tb)
            ? cmp(tb, tc)
              ? b
              : cmp(ta, tc)
                ? c
                : a
            : cmp(tc, tb)
              ? b
              : cmp(ta, tc)
                ? a
                : c;

          (a = right - (d << 1)), (b = right - d), (c = right);
          (ta = array[a]), (tb = array[b]), (tc = array[c]);
          right = cmp(ta, tb)
            ? cmp(tb, tc)
              ? b
              : cmp(ta, tc)
                ? c
                : a
            : cmp(tc, tb)
              ? b
              : cmp(ta, tc)
                ? a
                : c;
        }

        (a = left), (b = pivot), (c = right);
        (ta = array[a]), (tb = array[b]), (tc = array[c]);
        pivot = cmp(ta, tb)
          ? cmp(tb, tc)
            ? b
            : cmp(ta, tc)
              ? c
              : a
          : cmp(tc, tb)
            ? b
            : cmp(ta, tc)
              ? a
              : c;
        if (pivot !== left0) {
          t = array[pivot];
          array[pivot] = array[left0];
          array[left0] = t;
          pivot = left0;
        }
        left = left1 = left0 + 1;
        right = right1 = right0;

        ta = array[pivot];
        for (;;) {
          while (left <= right && !cmp(ta, array[left])) {
            if (!cmp(array[left], ta)) {
              if (left > left1) {
                t = array[left1];
                array[left1] = array[left];
                array[left] = t;
              }
              swap_cnt = 1;
              left1++;
            }
            left++;
          }

          while (left <= right && !cmp(array[right], ta)) {
            if (!cmp(ta, array[right])) {
              if (right < right1) {
                t = array[right1];
                array[right1] = array[right];
                array[right] = t;
              }
              swap_cnt = 1;
              right1--;
            }
            right--;
          }

          if (left > right) break;

          t = array[left];
          array[left] = array[right];
          array[right] = t;
          swap_cnt = 1;
          left++;
          right--;
        }

        if (swap_cnt === 0) {
          (left = left0), (right = right0);
          //goto insert_sort;
          for (ptr = left + 1; ptr <= right; ptr++) {
            for (
              ptr2 = ptr;
              ptr2 > left && cmp(array[ptr2], array[ptr2 - 1]);
              ptr2--
            ) {
              t = array[ptr2];
              array[ptr2] = array[ptr2 - 1];
              array[ptr2 - 1] = t;
            }
          }
          break;
        }

        n = Math.min(left1 - left0, left - left1);
        m = (left - n) | 0;
        for (i = 0; i < n; ++i, ++m) {
          t = array[left0 + i];
          array[left0 + i] = array[m];
          array[m] = t;
        }

        n = Math.min(right0 - right1, right1 - right);
        m = (right0 - n + 1) | 0;
        for (i = 0; i < n; ++i, ++m) {
          t = array[left + i];
          array[left + i] = array[m];
          array[m] = t;
        }
        n = left - left1;
        m = right1 - right;
        if (n > 1) {
          if (m > 1) {
            if (n > m) {
              ++sp;
              stack[sp << 1] = left0;
              stack[(sp << 1) + 1] = left0 + n - 1;
              (left = right0 - m + 1), (right = right0);
            } else {
              ++sp;
              stack[sp << 1] = right0 - m + 1;
              stack[(sp << 1) + 1] = right0;
              (left = left0), (right = left0 + n - 1);
            }
          } else {
            (left = left0), (right = left0 + n - 1);
          }
        } else if (m > 1) {
          (left = right0 - m + 1), (right = right0);
        } else {
          break;
        }
      }
    }
  }
}

/**
 * Quickselect-based median finder.
 *
 * Partially sorts `array` in-place and returns the median value.
 *
 * @param array - Numeric array (mutated in-place).
 * @param low - Start index (inclusive).
 * @param high - End index (inclusive).
 * @returns The median value.
 */
export function median(array: number[], low: number, high: number): number {
  let w: number;
  let middle = 0,
    ll = 0,
    hh = 0;
  const medianIdx = (low + high) >> 1;
  for (;;) {
    if (high <= low) return array[medianIdx];
    if (high === low + 1) {
      if (array[low] > array[high]) {
        w = array[low];
        array[low] = array[high];
        array[high] = w;
      }
      return array[medianIdx];
    }
    middle = (low + high) >> 1;
    if (array[middle] > array[high]) {
      w = array[middle];
      array[middle] = array[high];
      array[high] = w;
    }
    if (array[low] > array[high]) {
      w = array[low];
      array[low] = array[high];
      array[high] = w;
    }
    if (array[middle] > array[low]) {
      w = array[middle];
      array[middle] = array[low];
      array[low] = w;
    }
    ll = low + 1;
    w = array[middle];
    array[middle] = array[ll];
    array[ll] = w;
    hh = high;
    for (;;) {
      do ++ll;
      while (array[low] > array[ll]);
      do --hh;
      while (array[hh] > array[low]);
      if (hh < ll) break;
      w = array[ll];
      array[ll] = array[hh];
      array[hh] = w;
    }
    w = array[low];
    array[low] = array[hh];
    array[hh] = w;
    if (hh <= medianIdx) low = ll;
    else if (hh >= medianIdx) high = hh - 1;
  }
  return 0;
}
