/**
 * Geometric transforms -- affine (3-point), perspective (4-point), and inverses.
 *
 * Ported from legacy/jsfeat_transform.js.
 *
 * Note: perspective_4point_transform in the legacy code is algorithmically
 * identical to perspective4PointTransform in math.ts but writes to a plain
 * number array instead of a Matrix.  Both versions are preserved here:
 * - perspective4PointTransform (re-exported from math, Matrix-based)
 * - perspective4PointTransformArray (array-based, matching legacy transform.js)
 */

import { perspective4PointTransform } from '../math/math';

// Re-export the Matrix-based version from math
export { perspective4PointTransform };

/**
 * Compute a 3x3 perspective transform from 4 point pairs.
 * Writes result to a number array (9 elements).
 *
 * Ported line-by-line from legacy/jsfeat_transform.js perspective_4point_transform.
 */
export function perspective4PointTransformArray(
  mat: number[] | Float32Array | Float64Array,
  srcX0: number, srcY0: number, dstX0: number, dstY0: number,
  srcX1: number, srcY1: number, dstX1: number, dstY1: number,
  srcX2: number, srcY2: number, dstX2: number, dstY2: number,
  srcX3: number, srcY3: number, dstX3: number, dstY3: number,
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
  const Hr0 = -(t8 - t5 + t10 * t11 - t11 * t7 - t16 * t2 + t18 - t20 + t21 * t2) * t30;
  const Hr1 = (t5 - t8 - t32 * t4 + t32 * t9 + t18 - t2 * t35 + t27 * t2 - t20) * t30;
  const Hr2 = t1;
  const Hr3 = (-t9 * t7 + t42 + t43 * t4 - t16 * t4 + t46 - t48 + t27 * t9 - t51) * t30;
  const Hr4 = (-t42 + t41 * t9 - t55 * t2 + t46 - t48 + t55 * t11 + t51 - t21 * t9) * t30;
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
  const Hl0 = -(t8 - t5 + t10 * t11 - t11 * t7 - t16 * t2 + t18 - t20 + t21 * t2) * t30;
  const Hl1 = (t5 - t8 - t32 * t4 + t32 * t9 + t18 - t2 * t35 + t27 * t2 - t20) * t30;
  const Hl2 = t1;
  const Hl3 = (-t9 * t7 + t42 + t43 * t4 - t16 * t4 + t46 - t48 + t27 * t9 - t51) * t30;
  const Hl4 = (-t42 + t41 * t9 - t55 * t2 + t46 - t48 + t55 * t11 + t51 - t21 * t9) * t30;
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
  t15 = 1.0 / (t4 - t5 * Hr7 - t7 + t8 * Hr7 + t10 * Hr5 - t12 * Hr4);
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
 * Compute affine transform from 3 point pairs.
 *
 * Note: The legacy implementation was a stub ("we need linear algebra module
 * first"). This implementation solves the 6-parameter affine system directly:
 *
 *   | dstX |   | a  b  tx | | srcX |
 *   | dstY | = | c  d  ty | | srcY |
 *   |  1   |   | 0  0   1 | |  1   |
 *
 * @param model  Output array of at least 6 elements [a, b, tx, c, d, ty].
 */
export function affine3PointTransform(
  model: number[] | Float32Array | Float64Array,
  srcX0: number, srcY0: number, dstX0: number, dstY0: number,
  srcX1: number, srcY1: number, dstX1: number, dstY1: number,
  srcX2: number, srcY2: number, dstX2: number, dstY2: number,
): void {
  // Solve linear system:
  // [srcX0 srcY0 1] [a]   [dstX0]
  // [srcX1 srcY1 1] [b] = [dstX1]
  // [srcX2 srcY2 1] [tx]  [dstX2]
  // and similarly for c, d, ty

  const det = srcX0 * (srcY1 - srcY2) - srcY0 * (srcX1 - srcX2) + (srcX1 * srcY2 - srcX2 * srcY1);
  const inv_det = 1.0 / det;

  // Cramer's rule for first row (a, b, tx)
  model[0] = ((dstX0) * (srcY1 - srcY2) - (srcY0) * (dstX1 - dstX2) + (dstX1 * srcY2 - dstX2 * srcY1)) * inv_det;
  model[1] = ((srcX0) * (dstX1 - dstX2) - (dstX0) * (srcX1 - srcX2) + (srcX1 * dstX2 - srcX2 * dstX1)) * inv_det;
  model[2] = ((srcX0) * (srcY1 * dstX2 - srcY2 * dstX1) - (srcY0) * (srcX1 * dstX2 - srcX2 * dstX1) + (dstX0) * (srcX1 * srcY2 - srcX2 * srcY1)) * inv_det;

  // Cramer's rule for second row (c, d, ty)
  model[3] = ((dstY0) * (srcY1 - srcY2) - (srcY0) * (dstY1 - dstY2) + (dstY1 * srcY2 - dstY2 * srcY1)) * inv_det;
  model[4] = ((srcX0) * (dstY1 - dstY2) - (dstY0) * (srcX1 - srcX2) + (srcX1 * dstY2 - srcX2 * dstY1)) * inv_det;
  model[5] = ((srcX0) * (srcY1 * dstY2 - srcY2 * dstY1) - (srcY0) * (srcX1 * dstY2 - srcX2 * dstY1) + (dstY0) * (srcX1 * srcY2 - srcX2 * srcY1)) * inv_det;
}

/**
 * Invert a 2x3 affine transform.
 *
 * src: [a, b, tx, c, d, ty]  (6 elements)
 * dst: receives the inverse affine (6 elements)
 */
export function invertAffineTransform(
  src: number[] | Float32Array | Float64Array,
  dst: number[] | Float32Array | Float64Array,
): void {
  const m11 = src[0], m12 = src[1], m13 = src[2];
  const m21 = src[3], m22 = src[4], m23 = src[5];

  const det = 1.0 / (m11 * m22 - m12 * m21);

  dst[0] = det * m22;
  dst[1] = det * -m12;
  dst[2] = det * (m12 * m23 - m13 * m22);

  dst[3] = det * -m21;
  dst[4] = det * m11;
  dst[5] = det * (m13 * m21 - m11 * m23);
}

/**
 * Invert a 3x3 perspective transform.
 *
 * src: [m11..m33] (9 elements)
 * dst: receives the inverse (9 elements)
 */
export function invertPerspectiveTransform(
  src: number[] | Float32Array | Float64Array,
  dst: number[] | Float32Array | Float64Array,
): void {
  const m11 = src[0], m12 = src[1], m13 = src[2];
  const m21 = src[3], m22 = src[4], m23 = src[5];
  const m31 = src[6], m32 = src[7], m33 = src[8];

  const det = 1.0 / (m11 * (m22 * m33 - m23 * m32) - m12 * (m21 * m33 - m23 * m31) + m13 * (m21 * m32 - m22 * m31));

  dst[0] = det * (m22 * m33 - m23 * m32);
  dst[1] = det * (m13 * m32 - m12 * m33);
  dst[2] = det * (m12 * m23 - m13 * m22);

  dst[3] = det * (m23 * m31 - m21 * m33);
  dst[4] = det * (m11 * m33 - m13 * m31);
  dst[5] = det * (m13 * m21 - m11 * m23);

  dst[6] = det * (m21 * m32 - m22 * m31);
  dst[7] = det * (m12 * m31 - m11 * m32);
  dst[8] = det * (m11 * m22 - m12 * m21);
}
