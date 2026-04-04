/**
 * Robust motion estimation -- RANSAC and LMEDS.
 *
 * Ported from legacy/jsfeat_motion_estimator.js (motion_estimator section).
 */

import { Matrix } from '../core/matrix';
import { pool } from '../core/cache';
import { DataType, Channel, U8C1 } from '../core/types';
import { median } from '../math/math';
import type { MotionKernel } from './models';

/** Parameters for RANSAC and LMEDS robust estimation. */
export interface RansacParams {
  /** Minimum number of points needed to fit the model. */
  size: number;
  /** Inlier/outlier distance threshold. */
  thresh: number;
  /** Expected outlier ratio (0..1). */
  eps: number;
  /** Desired confidence probability (0..1). */
  prob: number;
}

/**
 * Create RANSAC/LMEDS parameters with sensible defaults.
 *
 * @param size - Minimum model points (default 0).
 * @param thresh - Inlier threshold (default 0.5).
 * @param eps - Expected outlier ratio (default 0.5).
 * @param prob - Desired confidence (default 0.99).
 * @returns A new RansacParams object.
 */
export function createRansacParams(
  size: number = 0,
  thresh: number = 0.5,
  eps: number = 0.5,
  prob: number = 0.99,
): RansacParams {
  return { size, thresh, eps, prob };
}

/**
 * Update the RANSAC iteration count based on the current outlier ratio.
 *
 * @param params - RANSAC parameters.
 * @param _eps - Current estimated outlier ratio.
 * @param maxIters - Maximum allowed iterations.
 * @returns Updated iteration count.
 */
export function updateIters(params: RansacParams, _eps: number, maxIters: number): number {
  const num = Math.log(1 - params.prob);
  const denom = Math.log(1 - Math.pow(1 - _eps, params.size));
  return (denom >= 0 || -num >= maxIters * (-denom) ? maxIters : Math.round(num / denom)) | 0;
}

function getSubset(
  kernel: MotionKernel,
  from: { x: number; y: number }[],
  to: { x: number; y: number }[],
  needCnt: number,
  maxCnt: number,
  fromSub: { x: number; y: number }[],
  toSub: { x: number; y: number }[],
): boolean {
  const max_try = 1000;
  const indices: number[] = [];
  let i = 0, j = 0, ssiter = 0, idx_i = 0, ok = false;
  for (; ssiter < max_try; ++ssiter) {
    i = 0;
    for (; i < needCnt && ssiter < max_try;) {
      ok = false;
      idx_i = 0;
      while (!ok) {
        ok = true;
        idx_i = indices[i] = Math.floor(Math.random() * maxCnt) | 0;
        for (j = 0; j < i; ++j) {
          if (idx_i == indices[j])
          { ok = false; break; }
        }
      }
      fromSub[i] = from[idx_i];
      toSub[i] = to[idx_i];
      if (!kernel.check_subset(fromSub, toSub, i + 1)) {
        ssiter++;
        continue;
      }
      ++i;
    }
    break;
  }

  return (i == needCnt && ssiter < max_try);
}

function findInliers(
  kernel: MotionKernel,
  model: Matrix,
  from: { x: number; y: number }[],
  to: { x: number; y: number }[],
  count: number,
  thresh: number,
  err: Float32Array,
  mask: Uint8Array,
): number {
  let numinliers = 0, i = 0, f = 0;
  const t = thresh * thresh;

  kernel.error(from, to, model, err, count);

  for (; i < count; ++i) {
    f = err[i] <= t ? 1 : 0;
    mask[i] = f;
    numinliers += f;
  }
  return numinliers;
}

/**
 * RANSAC (Random Sample Consensus) robust model estimation.
 *
 * Iteratively samples minimal subsets, fits models, and selects the
 * one with the most inliers.
 *
 * @param params - RANSAC parameters (size, threshold, epsilon, probability).
 * @param kernel - Motion kernel providing fit, error, and validation.
 * @param from - Source point array.
 * @param to - Destination point array.
 * @param count - Number of point correspondences.
 * @param model - Output matrix to receive the best model.
 * @param mask - Output mask matrix (1 = inlier, 0 = outlier), or null.
 * @param maxIters - Maximum iterations (default 1000).
 * @returns True if a valid model was found.
 */
export function ransac(
  params: RansacParams,
  kernel: MotionKernel,
  from: { x: number; y: number }[],
  to: { x: number; y: number }[],
  count: number,
  model: Matrix,
  mask: Matrix | null,
  maxIters: number = 1000,
): boolean {
  if (count < params.size) return false;

  const model_points = params.size;
  let niters = maxIters, iter = 0;
  let result = false;

  const subset0: { x: number; y: number }[] = [];
  const subset1: { x: number; y: number }[] = [];
  let found = false;

  const mc = model.cols, mr = model.rows;
  const dt = model.type | Channel.C1;

  const m_buff = pool.get((mc * mr) << 3);
  const ms_buff = pool.get(count);
  const err_buff = pool.get(count << 2);
  const M = new Matrix(mc, mr, dt, m_buff.data);
  const curr_mask = new Matrix(count, 1, U8C1, ms_buff.data);

  let inliers_max = -1, numinliers = 0;
  let nmodels = 0;

  const err = err_buff.f32;

  // special case
  if (count == model_points) {
    if (kernel.run(from, to, M, count) <= 0) {
      pool.release(m_buff);
      pool.release(ms_buff);
      pool.release(err_buff);
      return false;
    }

    M.copyTo(model);
    if (mask) {
      let c = count;
      while (--c >= 0) {
        mask.data[c] = 1;
      }
    }
    pool.release(m_buff);
    pool.release(ms_buff);
    pool.release(err_buff);
    return true;
  }

  for (; iter < niters; ++iter) {
    // generate subset
    found = getSubset(kernel, from, to, model_points, count, subset0, subset1);
    if (!found) {
      if (iter == 0) {
        pool.release(m_buff);
        pool.release(ms_buff);
        pool.release(err_buff);
        return false;
      }
      break;
    }

    nmodels = kernel.run(subset0, subset1, M, model_points);
    if (nmodels <= 0)
      continue;

    // TODO handle multimodel output

    numinliers = findInliers(kernel, M, from, to, count, params.thresh, err, curr_mask.data as Uint8Array);

    if (numinliers > Math.max(inliers_max, model_points - 1)) {
      M.copyTo(model);
      inliers_max = numinliers;
      if (mask) curr_mask.copyTo(mask);
      niters = updateIters(params, (count - numinliers) / count, niters);
      result = true;
    }
  }

  pool.release(m_buff);
  pool.release(ms_buff);
  pool.release(err_buff);

  return result;
}

/**
 * Least Median of Squares (LMEDS) robust model estimation.
 *
 * Selects the model that minimizes the median of squared reprojection
 * errors across all point correspondences.
 *
 * @param params - RANSAC parameters (size is used for minimum points).
 * @param kernel - Motion kernel providing fit, error, and validation.
 * @param from - Source point array.
 * @param to - Destination point array.
 * @param count - Number of point correspondences.
 * @param model - Output matrix to receive the best model.
 * @param mask - Output mask matrix (1 = inlier, 0 = outlier), or null.
 * @param maxIters - Maximum iterations (default 1000).
 * @returns True if a valid model was found.
 */
export function lmeds(
  params: RansacParams,
  kernel: MotionKernel,
  from: { x: number; y: number }[],
  to: { x: number; y: number }[],
  count: number,
  model: Matrix,
  mask: Matrix | null,
  maxIters: number = 1000,
): boolean {
  if (count < params.size) return false;

  const model_points = params.size;
  let niters = maxIters, iter = 0;
  let result = false;

  const subset0: { x: number; y: number }[] = [];
  const subset1: { x: number; y: number }[] = [];
  let found = false;

  const mc = model.cols, mr = model.rows;
  const dt = model.type | Channel.C1;

  const m_buff = pool.get((mc * mr) << 3);
  const ms_buff = pool.get(count);
  const err_buff = pool.get(count << 2);
  const M = new Matrix(mc, mr, dt, m_buff.data);
  const curr_mask = new Matrix(count, 1, DataType.U8 | Channel.C1, ms_buff.data);

  let numinliers = 0;
  let nmodels = 0;

  const err = err_buff.f32;
  let min_median = 1000000000.0, sigma = 0.0, med = 0.0;

  params.eps = 0.45;
  niters = updateIters(params, params.eps, niters);

  // special case
  if (count == model_points) {
    if (kernel.run(from, to, M, count) <= 0) {
      pool.release(m_buff);
      pool.release(ms_buff);
      pool.release(err_buff);
      return false;
    }

    M.copyTo(model);
    if (mask) {
      let c = count;
      while (--c >= 0) {
        mask.data[c] = 1;
      }
    }
    pool.release(m_buff);
    pool.release(ms_buff);
    pool.release(err_buff);
    return true;
  }

  for (; iter < niters; ++iter) {
    // generate subset
    found = getSubset(kernel, from, to, model_points, count, subset0, subset1);
    if (!found) {
      if (iter == 0) {
        pool.release(m_buff);
        pool.release(ms_buff);
        pool.release(err_buff);
        return false;
      }
      break;
    }

    nmodels = kernel.run(subset0, subset1, M, model_points);
    if (nmodels <= 0)
      continue;

    // TODO handle multimodel output

    kernel.error(from, to, M, err, count);
    // Need to copy to a regular number[] for the median function
    const errArr: number[] = [];
    for (let ei = 0; ei < count; ei++) {
      errArr[ei] = err[ei];
    }
    med = median(errArr, 0, count - 1);

    if (med < min_median) {
      min_median = med;
      M.copyTo(model);
      result = true;
    }
  }

  if (result) {
    sigma = 2.5 * 1.4826 * (1 + 5.0 / (count - model_points)) * Math.sqrt(min_median);
    sigma = Math.max(sigma, 0.001);

    numinliers = findInliers(kernel, model, from, to, count, sigma, err, curr_mask.data as Uint8Array);
    if (mask) curr_mask.copyTo(mask);

    result = numinliers >= model_points;
  }

  pool.release(m_buff);
  pool.release(ms_buff);
  pool.release(err_buff);

  return result;
}
