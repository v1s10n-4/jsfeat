/**
 * ORB descriptor — oriented BRIEF descriptors.
 *
 * Ported from legacy/jsfeat_orb.js.
 *
 * Original author: Eugene Zatepyakin / http://inspirit.ru/
 * Derived from OpenCV, @authors Ethan Rublee, Vincent Rabaud, Gary Bradski
 */

import { Matrix } from '../core/matrix';
import type { Keypoint } from '../core/keypoint';
import { DataType, F32C1, U8C1 } from '../core/types';
import { warpAffine } from '../imgproc/imgproc';

// ---------------------------------------------------------------------------
// Static lookup table (bit_pattern_31)
// ---------------------------------------------------------------------------

const bit_pattern_31_ = new Int32Array([
  8,-3, 9,5,
  4,2, 7,-12,
  -11,9, -8,2,
  7,-12, 12,-13,
  2,-13, 2,12,
  1,-7, 1,6,
  -2,-10, -2,-4,
  -13,-13, -11,-8,
  -13,-3, -12,-9,
  10,4, 11,9,
  -13,-8, -8,-9,
  -11,7, -9,12,
  7,7, 12,6,
  -4,-5, -3,0,
  -13,2, -12,-3,
  -9,0, -7,5,
  12,-6, 12,-1,
  -3,6, -2,12,
  -6,-13, -4,-8,
  11,-13, 12,-8,
  4,7, 5,1,
  5,-3, 10,-3,
  3,-7, 6,12,
  -8,-7, -6,-2,
  -2,11, -1,-10,
  -13,12, -8,10,
  -7,3, -5,-3,
  -4,2, -3,7,
  -10,-12, -6,11,
  5,-12, 6,-7,
  5,-6, 7,-1,
  1,0, 4,-5,
  9,11, 11,-13,
  4,7, 4,12,
  2,-1, 4,4,
  -4,-12, -2,7,
  -8,-5, -7,-10,
  4,11, 9,12,
  0,-8, 1,-13,
  -13,-2, -8,2,
  -3,-2, -2,3,
  -6,9, -4,-9,
  8,12, 10,7,
  0,9, 1,3,
  7,-5, 11,-10,
  -13,-6, -11,0,
  10,7, 12,1,
  -6,-3, -6,12,
  10,-9, 12,-4,
  -13,8, -8,-12,
  -13,0, -8,-4,
  3,3, 7,8,
  5,7, 10,-7,
  -1,7, 1,-12,
  3,-10, 5,6,
  2,-4, 3,-10,
  -13,0, -13,5,
  -13,-7, -12,12,
  -13,3, -11,8,
  -7,12, -4,7,
  6,-10, 12,8,
  -9,-1, -7,-6,
  -2,-5, 0,12,
  -12,5, -7,5,
  3,-10, 8,-13,
  -7,-7, -4,5,
  -3,-2, -1,-7,
  2,9, 5,-11,
  -11,-13, -5,-13,
  -1,6, 0,-1,
  5,-3, 5,2,
  -4,-13, -4,12,
  -9,-6, -9,6,
  -12,-10, -8,-4,
  10,2, 12,-3,
  7,12, 12,12,
  -7,-13, -6,5,
  -4,9, -3,4,
  7,-1, 12,2,
  -7,6, -5,1,
  -13,11, -12,5,
  -3,7, -2,-6,
  7,-8, 12,-7,
  -13,-7, -11,-12,
  1,-3, 12,12,
  2,-6, 3,0,
  -4,3, -2,-13,
  -1,-13, 1,9,
  7,1, 8,-6,
  1,-1, 3,12,
  9,1, 12,6,
  -1,-9, -1,3,
  -13,-13, -10,5,
  7,7, 10,12,
  12,-5, 12,9,
  6,3, 7,11,
  5,-13, 6,10,
  2,-12, 2,3,
  3,8, 4,-6,
  2,6, 12,-13,
  9,-12, 10,3,
  -8,4, -7,9,
  -11,12, -4,-6,
  1,12, 2,-8,
  6,-9, 7,-4,
  2,3, 3,-2,
  6,3, 11,0,
  3,-3, 8,-8,
  7,8, 9,3,
  -11,-5, -6,-4,
  -10,11, -5,10,
  -5,-8, -3,12,
  -10,5, -9,0,
  8,-1, 12,-6,
  4,-6, 6,-11,
  -10,12, -8,7,
  4,-2, 6,7,
  -2,0, -2,12,
  -5,-8, -5,2,
  7,-6, 10,12,
  -9,-13, -8,-8,
  -5,-13, -5,-2,
  8,-8, 9,-13,
  -9,-11, -9,0,
  1,-8, 1,-2,
  7,-4, 9,1,
  -2,1, -1,-4,
  11,-6, 12,-11,
  -12,-9, -6,4,
  3,7, 7,12,
  5,5, 10,8,
  0,-4, 2,8,
  -9,12, -5,-13,
  0,7, 2,12,
  -1,2, 1,7,
  5,11, 7,-9,
  3,5, 6,-8,
  -13,-4, -8,9,
  -5,9, -3,-3,
  -4,-7, -3,-12,
  6,5, 8,0,
  -7,6, -6,12,
  -13,6, -5,-2,
  1,-10, 3,10,
  4,1, 8,-4,
  -2,-2, 2,-13,
  2,-12, 12,12,
  -2,-13, 0,-6,
  4,1, 9,3,
  -6,-10, -3,-5,
  -3,-13, -1,1,
  7,5, 12,-11,
  4,-2, 5,-7,
  -13,9, -9,-5,
  7,1, 8,6,
  7,-8, 7,6,
  -7,-4, -7,1,
  -8,11, -7,-8,
  -13,6, -12,-8,
  2,4, 3,9,
  10,-5, 12,3,
  -6,-5, -6,7,
  8,-3, 9,-8,
  2,-12, 2,8,
  -11,-2, -10,3,
  -12,-13, -7,-9,
  -11,0, -10,-5,
  5,-3, 11,8,
  -2,-13, -1,12,
  -1,-8, 0,9,
  -13,-11, -12,-5,
  -10,-2, -10,11,
  -3,9, -2,-13,
  2,-3, 3,2,
  -9,-13, -4,0,
  -4,6, -3,-10,
  -4,12, -2,-7,
  -6,-11, -4,9,
  6,-3, 6,11,
  -13,11, -5,5,
  11,11, 12,6,
  7,-5, 12,-2,
  -1,12, 0,7,
  -4,-8, -3,-2,
  -7,1, -6,7,
  -13,-12, -8,-13,
  -7,-2, -6,-8,
  -8,5, -6,-9,
  -5,-1, -4,5,
  -13,7, -8,10,
  1,5, 5,-13,
  1,0, 10,-13,
  9,12, 10,-1,
  5,-8, 10,-9,
  -1,11, 1,-13,
  -9,-3, -6,2,
  -1,-10, 1,12,
  -13,1, -8,-10,
  8,-11, 10,-6,
  2,-13, 3,-6,
  7,-13, 12,-9,
  -10,-10, -5,-7,
  -10,-8, -8,-13,
  4,-6, 8,5,
  3,12, 8,-13,
  -4,2, -3,-3,
  5,-13, 10,-12,
  4,-13, 5,-1,
  -9,9, -4,3,
  0,3, 3,-9,
  -12,1, -6,1,
  3,2, 4,-8,
  -10,-10, -10,9,
  8,-13, 12,12,
  -8,-12, -6,-5,
  2,2, 3,7,
  10,6, 11,-8,
  6,8, 8,-12,
  -7,10, -6,5,
  -3,-9, -3,9,
  -1,-13, -1,5,
  -3,-7, -3,4,
  -8,-2, -8,3,
  4,2, 12,12,
  2,-5, 3,11,
  6,-9, 11,-13,
  3,-1, 7,12,
  11,-1, 12,4,
  -3,0, -3,6,
  4,-11, 4,12,
  2,-4, 2,1,
  -10,-6, -8,1,
  -13,7, -11,1,
  -13,12, -11,-13,
  6,0, 11,-13,
  0,-1, 1,4,
  -13,3, -9,-2,
  -9,8, -6,-3,
  -13,-6, -8,-2,
  5,-9, 8,10,
  2,7, 3,-9,
  -1,-6, -1,-1,
  9,5, 11,-2,
  11,-3, 12,-8,
  3,0, 3,5,
  -1,4, 0,10,
  3,-6, 4,5,
  -13,0, -10,5,
  5,8, 12,11,
  8,9, 9,-6,
  7,-4, 8,-12,
  -10,4, -10,9,
  7,3, 12,4,
  9,-7, 10,-2,
  7,0, 12,-2,
  -1,-6, 0,-11,
]);

// ---------------------------------------------------------------------------
// Module-level pre-allocated data
// ---------------------------------------------------------------------------

const H = new Matrix(3, 3, F32C1);
const patch_img = new Matrix(32, 32, U8C1);

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function rectify_patch(
  src: Matrix,
  dst: Matrix,
  angle: number,
  px: number,
  py: number,
  psize: number,
): void {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  H.data[0] = cosine;
  H.data[1] = -sine;
  H.data[2] = (-cosine + sine) * psize * 0.5 + px;
  H.data[3] = sine;
  H.data[4] = cosine;
  H.data[5] = (-sine - cosine) * psize * 0.5 + py;

  warpAffine(src, dst, H, 128);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute ORB (oriented BRIEF) descriptors for the given keypoints.
 *
 * @param src          Source image Matrix (U8C1).
 * @param corners      Array of Keypoints (must have angle set).
 * @param count        Number of keypoints to describe.
 * @param descriptors  Output Matrix, resized to (32, count, U8C1).
 */
export function orbDescribe(
  src: Matrix,
  corners: Keypoint[],
  count: number,
  descriptors: Matrix,
): void {
  const DESCR_SIZE = 32; // bytes
  let i = 0, b = 0, px = 0.0, py = 0.0, angle = 0.0;
  let t0 = 0, t1 = 0, val = 0;
  const patch_d = patch_img.data;
  const patch_off = 16 * 32 + 16; // center of patch
  let patt = 0;

  if (!(descriptors.type & DataType.U8)) {
    // relocate to U8 type
    descriptors.type = DataType.U8;
    descriptors.cols = DESCR_SIZE;
    descriptors.rows = count;
    descriptors.channel = 1;
    descriptors.allocate();
  } else {
    descriptors.resize(DESCR_SIZE, count, 1);
  }

  const descr_d = descriptors.data;
  let descr_off = 0;

  for (i = 0; i < count; ++i) {
    px = corners[i].x;
    py = corners[i].y;
    angle = corners[i].angle;

    rectify_patch(src, patch_img, angle, px, py, 32);

    // describe the patch
    patt = 0;
    for (b = 0; b < DESCR_SIZE; ++b) {

      t0 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      t1 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      val = (t0 < t1) ? 1 : 0;

      t0 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      t1 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      val |= ((t0 < t1) ? 1 : 0) << 1;

      t0 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      t1 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      val |= ((t0 < t1) ? 1 : 0) << 2;

      t0 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      t1 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      val |= ((t0 < t1) ? 1 : 0) << 3;

      t0 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      t1 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      val |= ((t0 < t1) ? 1 : 0) << 4;

      t0 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      t1 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      val |= ((t0 < t1) ? 1 : 0) << 5;

      t0 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      t1 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      val |= ((t0 < t1) ? 1 : 0) << 6;

      t0 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      t1 = patch_d[patch_off + bit_pattern_31_[patt + 1] * 32 + bit_pattern_31_[patt]]; patt += 2;
      val |= ((t0 < t1) ? 1 : 0) << 7;

      descr_d[descr_off + b] = val;
    }
    descr_off += DESCR_SIZE;
  }
}
