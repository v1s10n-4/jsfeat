/**
 * jsfeat math module -- utilities, matrix arithmetic, linear algebra.
 */

export {
  getGaussianKernel,
  perspective4PointTransform,
  qsort,
  median,
} from './math';

export {
  identity,
  transpose,
  multiply,
  multiplyABt,
  multiplyAtB,
  multiplyAAt,
  multiplyAtA,
  identity3x3,
  invert3x3,
  multiply3x3,
  mat3x3Determinant,
  determinant3x3,
} from './matmath';
