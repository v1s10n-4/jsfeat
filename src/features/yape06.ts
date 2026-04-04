/**
 * YAPE06 keypoint detector.
 *
 * Ported from legacy/jsfeat_yape06.js.
 *
 * Original author: Eugene Zatepyakin / http://inspirit.ru/
 * Copyright 2007 Computer Vision Lab,
 * Ecole Polytechnique Federale de Lausanne (EPFL), Switzerland.
 * @author Vincent Lepetit (http://cvlab.epfl.ch/~lepetit)
 */

import type { Matrix } from '../core/matrix';
import type { Keypoint } from '../core/keypoint';
import { pool } from '../core/cache';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function compute_laplacian(
  src: Uint8Array | Int32Array | Float32Array | Float64Array,
  dst: Int32Array,
  w: number,
  _h: number,
  Dxx: number,
  Dyy: number,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
): void {
  let y = 0, x = 0, yrow = (sy * w + sx) | 0, row = yrow;

  for (y = sy; y < ey; ++y, yrow += w, row = yrow) {
    for (x = sx; x < ex; ++x, ++row) {
      dst[row] = -4 * src[row] + src[row + Dxx] + src[row - Dxx] + src[row + Dyy] + src[row - Dyy];
    }
  }
}

function hessian_min_eigen_value(
  src: Uint8Array | Int32Array | Float32Array | Float64Array,
  off: number,
  tr: number,
  Dxx: number,
  Dyy: number,
  Dxy: number,
  Dyx: number,
): number {
  const Ixx = -2 * src[off] + src[off + Dxx] + src[off - Dxx];
  const Iyy = -2 * src[off] + src[off + Dyy] + src[off - Dyy];
  const Ixy = src[off + Dxy] + src[off - Dxy] - src[off + Dyx] - src[off - Dyx];
  const sqrt_delta = (Math.sqrt((Ixx - Iyy) * (Ixx - Iyy) + 4 * Ixy * Ixy)) | 0;

  return Math.min(Math.abs(tr - sqrt_delta), Math.abs(-(tr + sqrt_delta)));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect YAPE06 keypoints in a single-channel image.
 *
 * Uses Laplacian extrema with Hessian-based minimum eigenvalue filtering.
 *
 * Based on: YAPE by V. Lepetit, EPFL.
 *
 * @param src - Source Matrix (U8C1).
 * @param points - Pre-allocated array of Keypoint objects.
 * @param border - Border to skip in pixels (default 5).
 * @param laplacianThreshold - Threshold for Laplacian extrema (default 30).
 * @param minEigenThreshold - Minimum eigenvalue threshold (default 25).
 * @returns Number of detected keypoints.
 */
export function yape06Detect(
  src: Matrix,
  points: Keypoint[],
  border: number = 5,
  laplacianThreshold: number = 30,
  minEigenThreshold: number = 25,
): number {
  let x = 0, y = 0;
  const w = src.cols, h = src.rows, srd_d = src.data;
  const Dxx = 5, Dyy = (5 * w) | 0;
  const Dxy = (3 + 3 * w) | 0, Dyx = (3 - 3 * w) | 0;
  const lap_buf = pool.get((w * h) << 2);
  const laplacian = lap_buf.i32;
  let lv = 0, row = 0, rowx = 0, min_eigen_value = 0, pt: Keypoint;
  let number_of_points = 0;
  const lap_thresh = laplacianThreshold;
  const eigen_thresh = minEigenThreshold;

  const sx = Math.max(5, border) | 0;
  const sy = Math.max(3, border) | 0;
  const ex = Math.min(w - 5, w - border) | 0;
  const ey = Math.min(h - 3, h - border) | 0;

  x = w * h;
  while (--x >= 0) { laplacian[x] = 0; }
  compute_laplacian(srd_d, laplacian, w, h, Dxx, Dyy, sx, sy, ex, ey);

  row = (sy * w + sx) | 0;
  for (y = sy; y < ey; ++y, row += w) {
    for (x = sx, rowx = row; x < ex; ++x, ++rowx) {

      lv = laplacian[rowx];
      if (
        (lv < -lap_thresh &&
          lv < laplacian[rowx - 1] && lv < laplacian[rowx + 1] &&
          lv < laplacian[rowx - w] && lv < laplacian[rowx + w] &&
          lv < laplacian[rowx - w - 1] && lv < laplacian[rowx + w - 1] &&
          lv < laplacian[rowx - w + 1] && lv < laplacian[rowx + w + 1])
        ||
        (lv > lap_thresh &&
          lv > laplacian[rowx - 1] && lv > laplacian[rowx + 1] &&
          lv > laplacian[rowx - w] && lv > laplacian[rowx + w] &&
          lv > laplacian[rowx - w - 1] && lv > laplacian[rowx + w - 1] &&
          lv > laplacian[rowx - w + 1] && lv > laplacian[rowx + w + 1])
      ) {

        min_eigen_value = hessian_min_eigen_value(srd_d, rowx, lv, Dxx, Dyy, Dxy, Dyx);
        if (min_eigen_value > eigen_thresh) {
          pt = points[number_of_points];
          pt.x = x;
          pt.y = y;
          pt.score = min_eigen_value;
          ++number_of_points;
          ++x; ++rowx; // skip next pixel since this is maxima in 3x3
        }
      }
    }
  }

  pool.release(lap_buf);

  return number_of_points;
}
