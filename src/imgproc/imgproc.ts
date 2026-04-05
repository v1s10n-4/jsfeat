/**
 * Image Processing module -- grayscale, blur, edges, derivatives, histogram.
 *
 * Ported from legacy/jsfeat_imgproc.js.
 */

import { pool } from '../core/cache';
import { Matrix } from '../core/matrix';
import { DataType, ColorCode, BOX_BLUR_NOSCALE, S32C2, U8C1 } from '../core/types';
import type { TypedArrayUnion } from '../core/types';
import { getGaussianKernel } from '../math/math';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function _resample_u8(src: Matrix, dst: Matrix, nw: number, nh: number): void {
  let xofs_count = 0;
  const ch = src.channel, w = src.cols, h = src.rows;
  const src_d = src.data, dst_d = dst.data;
  const scale_x = w / nw, scale_y = h / nh;
  const inv_scale_256 = (scale_x * scale_y * 0x10000) | 0;
  let dx = 0, dy = 0, sx = 0, sy = 0, sx1 = 0, sx2 = 0, i = 0, k = 0, fsx1 = 0.0, fsx2 = 0.0;
  let a = 0, b = 0, dxn = 0, alpha = 0, beta = 0, beta1 = 0;

  const buf_node = pool.get((nw * ch) << 2);
  const sum_node = pool.get((nw * ch) << 2);
  const xofs_node = pool.get((w * 2 * 3) << 2);

  const buf = buf_node.i32;
  const sum = sum_node.i32;
  const xofs = xofs_node.i32;

  for (; dx < nw; dx++) {
    fsx1 = dx * scale_x, fsx2 = fsx1 + scale_x;
    sx1 = (fsx1 + 1.0 - 1e-6) | 0, sx2 = fsx2 | 0;
    sx1 = Math.min(sx1, w - 1);
    sx2 = Math.min(sx2, w - 1);

    if (sx1 > fsx1) {
      xofs[k++] = (dx * ch) | 0;
      xofs[k++] = ((sx1 - 1) * ch) | 0;
      xofs[k++] = ((sx1 - fsx1) * 0x100) | 0;
      xofs_count++;
    }
    for (sx = sx1; sx < sx2; sx++) {
      xofs_count++;
      xofs[k++] = (dx * ch) | 0;
      xofs[k++] = (sx * ch) | 0;
      xofs[k++] = 256;
    }
    if (fsx2 - sx2 > 1e-3) {
      xofs_count++;
      xofs[k++] = (dx * ch) | 0;
      xofs[k++] = (sx2 * ch) | 0;
      xofs[k++] = ((fsx2 - sx2) * 256) | 0;
    }
  }

  for (dx = 0; dx < nw * ch; dx++) {
    buf[dx] = sum[dx] = 0;
  }
  dy = 0;
  for (sy = 0; sy < h; sy++) {
    a = w * sy;
    for (k = 0; k < xofs_count; k++) {
      dxn = xofs[k * 3];
      sx1 = xofs[k * 3 + 1];
      alpha = xofs[k * 3 + 2];
      for (i = 0; i < ch; i++) {
        buf[dxn + i] += src_d[a + sx1 + i] * alpha;
      }
    }
    if ((dy + 1) * scale_y <= sy + 1 || sy == h - 1) {
      beta = (Math.max(sy + 1 - (dy + 1) * scale_y, 0.0) * 256) | 0;
      beta1 = 256 - beta;
      b = nw * dy;
      if (beta <= 0) {
        for (dx = 0; dx < nw * ch; dx++) {
          dst_d[b + dx] = Math.min(Math.max((sum[dx] + buf[dx] * 256) / inv_scale_256, 0), 255);
          sum[dx] = buf[dx] = 0;
        }
      } else {
        for (dx = 0; dx < nw * ch; dx++) {
          dst_d[b + dx] = Math.min(Math.max((sum[dx] + buf[dx] * beta1) / inv_scale_256, 0), 255);
          sum[dx] = buf[dx] * beta;
          buf[dx] = 0;
        }
      }
      dy++;
    } else {
      for (dx = 0; dx < nw * ch; dx++) {
        sum[dx] += buf[dx] * 256;
        buf[dx] = 0;
      }
    }
  }

  pool.release(sum_node);
  pool.release(buf_node);
  pool.release(xofs_node);
}

function _resample(src: Matrix, dst: Matrix, nw: number, nh: number): void {
  let xofs_count = 0;
  const ch = src.channel, w = src.cols, h = src.rows;
  const src_d = src.data, dst_d = dst.data;
  const scale_x = w / nw, scale_y = h / nh;
  const scale = 1.0 / (scale_x * scale_y);
  let dx = 0, dy = 0, sx = 0, sy = 0, sx1 = 0, sx2 = 0, i = 0, k = 0, fsx1 = 0.0, fsx2 = 0.0;
  let a = 0, b = 0, dxn = 0, alpha = 0.0, beta = 0.0, beta1 = 0.0;

  const buf_node = pool.get((nw * ch) << 2);
  const sum_node = pool.get((nw * ch) << 2);
  const xofs_node = pool.get((w * 2 * 3) << 2);

  const buf = buf_node.f32;
  const sum = sum_node.f32;
  const xofs = xofs_node.f32;

  for (; dx < nw; dx++) {
    fsx1 = dx * scale_x, fsx2 = fsx1 + scale_x;
    sx1 = (fsx1 + 1.0 - 1e-6) | 0, sx2 = fsx2 | 0;
    sx1 = Math.min(sx1, w - 1);
    sx2 = Math.min(sx2, w - 1);

    if (sx1 > fsx1) {
      xofs_count++;
      xofs[k++] = ((sx1 - 1) * ch) | 0;
      xofs[k++] = (dx * ch) | 0;
      xofs[k++] = (sx1 - fsx1) * scale;
    }
    for (sx = sx1; sx < sx2; sx++) {
      xofs_count++;
      xofs[k++] = (sx * ch) | 0;
      xofs[k++] = (dx * ch) | 0;
      xofs[k++] = scale;
    }
    if (fsx2 - sx2 > 1e-3) {
      xofs_count++;
      xofs[k++] = (sx2 * ch) | 0;
      xofs[k++] = (dx * ch) | 0;
      xofs[k++] = (fsx2 - sx2) * scale;
    }
  }

  for (dx = 0; dx < nw * ch; dx++) {
    buf[dx] = sum[dx] = 0;
  }
  dy = 0;
  for (sy = 0; sy < h; sy++) {
    a = w * sy;
    for (k = 0; k < xofs_count; k++) {
      sx1 = xofs[k * 3] | 0;
      dxn = xofs[k * 3 + 1] | 0;
      alpha = xofs[k * 3 + 2];
      for (i = 0; i < ch; i++) {
        buf[dxn + i] += src_d[a + sx1 + i] * alpha;
      }
    }
    if ((dy + 1) * scale_y <= sy + 1 || sy == h - 1) {
      beta = Math.max(sy + 1 - (dy + 1) * scale_y, 0.0);
      beta1 = 1.0 - beta;
      b = nw * dy;
      if (Math.abs(beta) < 1e-3) {
        for (dx = 0; dx < nw * ch; dx++) {
          dst_d[b + dx] = sum[dx] + buf[dx];
          sum[dx] = buf[dx] = 0;
        }
      } else {
        for (dx = 0; dx < nw * ch; dx++) {
          dst_d[b + dx] = sum[dx] + buf[dx] * beta1;
          sum[dx] = buf[dx] * beta;
          buf[dx] = 0;
        }
      }
      dy++;
    } else {
      for (dx = 0; dx < nw * ch; dx++) {
        sum[dx] += buf[dx];
        buf[dx] = 0;
      }
    }
  }
  pool.release(sum_node);
  pool.release(buf_node);
  pool.release(xofs_node);
}

function _convol_u8(
  buf: Int32Array,
  src_d: TypedArrayUnion,
  dst_d: TypedArrayUnion,
  w: number,
  h: number,
  filter: Int32Array,
  kernel_size: number,
  half_kernel: number,
): void {
  let i = 0, j = 0, k = 0, sp = 0, dp = 0, sum = 0, sum1 = 0, sum2 = 0, sum3 = 0, fk = 0;
  const f0 = filter[0];
  const w2 = w << 1, w3 = w * 3, w4 = w << 2;
  // hor pass
  for (; i < h; ++i) {
    sum = src_d[sp];
    for (j = 0; j < half_kernel; ++j) {
      buf[j] = sum;
    }
    for (j = 0; j <= w - 2; j += 2) {
      buf[j + half_kernel] = src_d[sp + j];
      buf[j + half_kernel + 1] = src_d[sp + j + 1];
    }
    for (; j < w; ++j) {
      buf[j + half_kernel] = src_d[sp + j];
    }
    sum = src_d[sp + w - 1];
    for (j = w; j < half_kernel + w; ++j) {
      buf[j + half_kernel] = sum;
    }
    for (j = 0; j <= w - 4; j += 4) {
      sum = buf[j] * f0,
      sum1 = buf[j + 1] * f0,
      sum2 = buf[j + 2] * f0,
      sum3 = buf[j + 3] * f0;
      for (k = 1; k < kernel_size; ++k) {
        fk = filter[k];
        sum += buf[k + j] * fk;
        sum1 += buf[k + j + 1] * fk;
        sum2 += buf[k + j + 2] * fk;
        sum3 += buf[k + j + 3] * fk;
      }
      dst_d[dp + j] = Math.min(sum >> 8, 255);
      dst_d[dp + j + 1] = Math.min(sum1 >> 8, 255);
      dst_d[dp + j + 2] = Math.min(sum2 >> 8, 255);
      dst_d[dp + j + 3] = Math.min(sum3 >> 8, 255);
    }
    for (; j < w; ++j) {
      sum = buf[j] * f0;
      for (k = 1; k < kernel_size; ++k) {
        sum += buf[k + j] * filter[k];
      }
      dst_d[dp + j] = Math.min(sum >> 8, 255);
    }
    sp += w;
    dp += w;
  }

  // vert pass
  for (i = 0; i < w; ++i) {
    sum = dst_d[i];
    for (j = 0; j < half_kernel; ++j) {
      buf[j] = sum;
    }
    k = i;
    for (j = 0; j <= h - 2; j += 2, k += w2) {
      buf[j + half_kernel] = dst_d[k];
      buf[j + half_kernel + 1] = dst_d[k + w];
    }
    for (; j < h; ++j, k += w) {
      buf[j + half_kernel] = dst_d[k];
    }
    sum = dst_d[(h - 1) * w + i];
    for (j = h; j < half_kernel + h; ++j) {
      buf[j + half_kernel] = sum;
    }
    dp = i;
    for (j = 0; j <= h - 4; j += 4, dp += w4) {
      sum = buf[j] * f0,
      sum1 = buf[j + 1] * f0,
      sum2 = buf[j + 2] * f0,
      sum3 = buf[j + 3] * f0;
      for (k = 1; k < kernel_size; ++k) {
        fk = filter[k];
        sum += buf[k + j] * fk;
        sum1 += buf[k + j + 1] * fk;
        sum2 += buf[k + j + 2] * fk;
        sum3 += buf[k + j + 3] * fk;
      }
      dst_d[dp] = Math.min(sum >> 8, 255);
      dst_d[dp + w] = Math.min(sum1 >> 8, 255);
      dst_d[dp + w2] = Math.min(sum2 >> 8, 255);
      dst_d[dp + w3] = Math.min(sum3 >> 8, 255);
    }
    for (; j < h; ++j, dp += w) {
      sum = buf[j] * f0;
      for (k = 1; k < kernel_size; ++k) {
        sum += buf[k + j] * filter[k];
      }
      dst_d[dp] = Math.min(sum >> 8, 255);
    }
  }
}

function _convol(
  buf: Float32Array,
  src_d: TypedArrayUnion,
  dst_d: TypedArrayUnion,
  w: number,
  h: number,
  filter: Float32Array,
  kernel_size: number,
  half_kernel: number,
): void {
  let i = 0, j = 0, k = 0, sp = 0, dp = 0, sum = 0.0, sum1 = 0.0, sum2 = 0.0, sum3 = 0.0, fk = 0.0;
  const f0 = filter[0];
  const w2 = w << 1, w3 = w * 3, w4 = w << 2;
  // hor pass
  for (; i < h; ++i) {
    sum = src_d[sp];
    for (j = 0; j < half_kernel; ++j) {
      buf[j] = sum;
    }
    for (j = 0; j <= w - 2; j += 2) {
      buf[j + half_kernel] = src_d[sp + j];
      buf[j + half_kernel + 1] = src_d[sp + j + 1];
    }
    for (; j < w; ++j) {
      buf[j + half_kernel] = src_d[sp + j];
    }
    sum = src_d[sp + w - 1];
    for (j = w; j < half_kernel + w; ++j) {
      buf[j + half_kernel] = sum;
    }
    for (j = 0; j <= w - 4; j += 4) {
      sum = buf[j] * f0,
      sum1 = buf[j + 1] * f0,
      sum2 = buf[j + 2] * f0,
      sum3 = buf[j + 3] * f0;
      for (k = 1; k < kernel_size; ++k) {
        fk = filter[k];
        sum += buf[k + j] * fk;
        sum1 += buf[k + j + 1] * fk;
        sum2 += buf[k + j + 2] * fk;
        sum3 += buf[k + j + 3] * fk;
      }
      dst_d[dp + j] = sum;
      dst_d[dp + j + 1] = sum1;
      dst_d[dp + j + 2] = sum2;
      dst_d[dp + j + 3] = sum3;
    }
    for (; j < w; ++j) {
      sum = buf[j] * f0;
      for (k = 1; k < kernel_size; ++k) {
        sum += buf[k + j] * filter[k];
      }
      dst_d[dp + j] = sum;
    }
    sp += w;
    dp += w;
  }

  // vert pass
  for (i = 0; i < w; ++i) {
    sum = dst_d[i];
    for (j = 0; j < half_kernel; ++j) {
      buf[j] = sum;
    }
    k = i;
    for (j = 0; j <= h - 2; j += 2, k += w2) {
      buf[j + half_kernel] = dst_d[k];
      buf[j + half_kernel + 1] = dst_d[k + w];
    }
    for (; j < h; ++j, k += w) {
      buf[j + half_kernel] = dst_d[k];
    }
    sum = dst_d[(h - 1) * w + i];
    for (j = h; j < half_kernel + h; ++j) {
      buf[j + half_kernel] = sum;
    }
    dp = i;
    for (j = 0; j <= h - 4; j += 4, dp += w4) {
      sum = buf[j] * f0,
      sum1 = buf[j + 1] * f0,
      sum2 = buf[j + 2] * f0,
      sum3 = buf[j + 3] * f0;
      for (k = 1; k < kernel_size; ++k) {
        fk = filter[k];
        sum += buf[k + j] * fk;
        sum1 += buf[k + j + 1] * fk;
        sum2 += buf[k + j + 2] * fk;
        sum3 += buf[k + j + 3] * fk;
      }
      dst_d[dp] = sum;
      dst_d[dp + w] = sum1;
      dst_d[dp + w2] = sum2;
      dst_d[dp + w3] = sum3;
    }
    for (; j < h; ++j, dp += w) {
      sum = buf[j] * f0;
      for (k = 1; k < kernel_size; ++k) {
        sum += buf[k + j] * filter[k];
      }
      dst_d[dp] = sum;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert raw pixel data (RGBA/RGB/BGRA/BGR) to single-channel grayscale.
 *
 * Uses fixed-point BT.601 luminance coefficients.
 *
 * @param src - Raw pixel bytes (Uint8Array or Uint8ClampedArray from canvas).
 * @param w - Image width in pixels.
 * @param h - Image height in pixels.
 * @param dst - Destination Matrix (will be resized to w x h, 1 channel).
 * @param code - Color conversion code from ColorCode (default RGBA2GRAY).
 */
export function grayscale(
  src: Uint8Array | Uint8ClampedArray,
  w: number,
  h: number,
  dst: Matrix,
  code?: number,
): void {
  // this is default image data representation in browser
  if (typeof code === 'undefined') { code = ColorCode.RGBA2GRAY; }
  let x = 0, y = 0, i = 0, j = 0, ir = 0, jr = 0;
  let coeff_r = 4899, cn = 4;
  const coeff_g = 9617;
  let coeff_b = 1868;

  if (code == ColorCode.BGRA2GRAY || code == ColorCode.BGR2GRAY) {
    coeff_r = 1868;
    coeff_b = 4899;
  }
  if (code == ColorCode.RGB2GRAY || code == ColorCode.BGR2GRAY) {
    cn = 3;
  }
  const cn2 = cn << 1, cn3 = (cn * 3) | 0;

  dst.resize(w, h, 1);
  const dst_u8 = dst.data;

  for (y = 0; y < h; ++y, j += w, i += w * cn) {
    for (x = 0, ir = i, jr = j; x <= w - 4; x += 4, ir += cn << 2, jr += 4) {
      dst_u8[jr]     = (src[ir] * coeff_r + src[ir + 1] * coeff_g + src[ir + 2] * coeff_b + 8192) >> 14;
      dst_u8[jr + 1] = (src[ir + cn] * coeff_r + src[ir + cn + 1] * coeff_g + src[ir + cn + 2] * coeff_b + 8192) >> 14;
      dst_u8[jr + 2] = (src[ir + cn2] * coeff_r + src[ir + cn2 + 1] * coeff_g + src[ir + cn2 + 2] * coeff_b + 8192) >> 14;
      dst_u8[jr + 3] = (src[ir + cn3] * coeff_r + src[ir + cn3 + 1] * coeff_g + src[ir + cn3 + 2] * coeff_b + 8192) >> 14;
    }
    for (; x < w; ++x, ++jr, ir += cn) {
      dst_u8[jr] = (src[ir] * coeff_r + src[ir + 1] * coeff_g + src[ir + 2] * coeff_b + 8192) >> 14;
    }
  }
}

/**
 * Area-based image resampling (downscaling only).
 *
 * @param src - Source Matrix.
 * @param dst - Destination Matrix (resized to nw x nh).
 * @param nw - New width (must be smaller than src width).
 * @param nh - New height (must be smaller than src height).
 */
export function resample(src: Matrix, dst: Matrix, nw: number, nh: number): void {
  const h = src.rows, w = src.cols;
  if (h > nh && w > nw) {
    dst.resize(nw, nh, src.channel);
    // using the fast alternative (fix point scale, 0x100 to avoid overflow)
    if (src.type & DataType.U8 && dst.type & DataType.U8 && h * w / (nh * nw) < 0x100) {
      _resample_u8(src, dst, nw, nh);
    } else {
      _resample(src, dst, nw, nh);
    }
  }
}

/**
 * Pyramid downsampling via 2x2 block averaging.
 *
 * Produces an image at half the resolution of the source.
 *
 * @param src - Source Matrix.
 * @param dst - Destination Matrix (resized to w/2 x h/2).
 * @param sx - Horizontal start offset in pixels (default 0).
 * @param sy - Vertical start offset in pixels (default 0).
 */
export function pyrDown(src: Matrix, dst: Matrix, sx: number = 0, sy: number = 0): void {
  const w = src.cols, h = src.rows;
  const w2 = w >> 1, h2 = h >> 1;
  const _w2 = w2 - (sx << 1), _h2 = h2 - (sy << 1);
  let x = 0, y = 0, sptr = sx + sy * w, sline = 0, dptr = 0, dline = 0;

  dst.resize(w2, h2, src.channel);

  const src_d = src.data, dst_d = dst.data;

  for (y = 0; y < _h2; ++y) {
    sline = sptr;
    dline = dptr;
    for (x = 0; x <= _w2 - 2; x += 2, dline += 2, sline += 4) {
      dst_d[dline] = (src_d[sline] + src_d[sline + 1] +
                      src_d[sline + w] + src_d[sline + w + 1] + 2) >> 2;
      dst_d[dline + 1] = (src_d[sline + 2] + src_d[sline + 3] +
                          src_d[sline + w + 2] + src_d[sline + w + 3] + 2) >> 2;
    }
    for (; x < _w2; ++x, ++dline, sline += 2) {
      dst_d[dline] = (src_d[sline] + src_d[sline + 1] +
                      src_d[sline + w] + src_d[sline + w + 1] + 2) >> 2;
    }
    sptr += w << 1;
    dptr += w2;
  }
}

/**
 * Box blur for single-channel grayscale images.
 *
 * Applies a separable box filter with the given radius.
 *
 * @param src - Source Matrix (U8C1).
 * @param dst - Destination Matrix (resized to match src).
 * @param radius - Blur radius (window size = 2*radius + 1).
 * @param options - Optional flags (BOX_BLUR_NOSCALE to skip normalization).
 */
export function boxBlurGray(src: Matrix, dst: Matrix, radius: number, options: number = 0): void {
  const w = src.cols, h = src.rows, h2 = h << 1, w2 = w << 1;
  let i = 0, x = 0, y = 0, end = 0;
  const windowSize = ((radius << 1) + 1) | 0;
  const radiusPlusOne = (radius + 1) | 0, radiusPlus2 = (radiusPlusOne + 1) | 0;
  const scale = options & BOX_BLUR_NOSCALE ? 1 : (1.0 / (windowSize * windowSize));

  const tmp_buff = pool.get((w * h) << 2);

  let sum = 0, dstIndex = 0, srcIndex = 0, nextPixelIndex = 0, previousPixelIndex = 0;
  const data_i32 = tmp_buff.i32; // to prevent overflow
  let data_u8 = src.data;
  let hold = 0;

  dst.resize(w, h, src.channel);

  // first pass
  for (y = 0; y < h; ++y) {
    dstIndex = y;
    sum = radiusPlusOne * data_u8[srcIndex];

    for (i = (srcIndex + 1) | 0, end = (srcIndex + radius) | 0; i <= end; ++i) {
      sum += data_u8[i];
    }

    nextPixelIndex = (srcIndex + radiusPlusOne) | 0;
    previousPixelIndex = srcIndex;
    hold = data_u8[previousPixelIndex];
    for (x = 0; x < radius; ++x, dstIndex += h) {
      data_i32[dstIndex] = sum;
      sum += data_u8[nextPixelIndex] - hold;
      nextPixelIndex++;
    }
    for (; x < w - radiusPlus2; x += 2, dstIndex += h2) {
      data_i32[dstIndex] = sum;
      sum += data_u8[nextPixelIndex] - data_u8[previousPixelIndex];

      data_i32[dstIndex + h] = sum;
      sum += data_u8[nextPixelIndex + 1] - data_u8[previousPixelIndex + 1];

      nextPixelIndex += 2;
      previousPixelIndex += 2;
    }
    for (; x < w - radiusPlusOne; ++x, dstIndex += h) {
      data_i32[dstIndex] = sum;
      sum += data_u8[nextPixelIndex] - data_u8[previousPixelIndex];

      nextPixelIndex++;
      previousPixelIndex++;
    }

    hold = data_u8[nextPixelIndex - 1];
    for (; x < w; ++x, dstIndex += h) {
      data_i32[dstIndex] = sum;

      sum += hold - data_u8[previousPixelIndex];
      previousPixelIndex++;
    }

    srcIndex += w;
  }
  //
  // second pass
  srcIndex = 0;
  data_u8 = dst.data;

  // dont scale result
  if (scale == 1) {
    for (y = 0; y < w; ++y) {
      dstIndex = y;
      sum = radiusPlusOne * data_i32[srcIndex];

      for (i = (srcIndex + 1) | 0, end = (srcIndex + radius) | 0; i <= end; ++i) {
        sum += data_i32[i];
      }

      nextPixelIndex = srcIndex + radiusPlusOne;
      previousPixelIndex = srcIndex;
      hold = data_i32[previousPixelIndex];

      for (x = 0; x < radius; ++x, dstIndex += w) {
        data_u8[dstIndex] = sum;
        sum += data_i32[nextPixelIndex] - hold;
        nextPixelIndex++;
      }
      for (; x < h - radiusPlus2; x += 2, dstIndex += w2) {
        data_u8[dstIndex] = sum;
        sum += data_i32[nextPixelIndex] - data_i32[previousPixelIndex];

        data_u8[dstIndex + w] = sum;
        sum += data_i32[nextPixelIndex + 1] - data_i32[previousPixelIndex + 1];

        nextPixelIndex += 2;
        previousPixelIndex += 2;
      }
      for (; x < h - radiusPlusOne; ++x, dstIndex += w) {
        data_u8[dstIndex] = sum;

        sum += data_i32[nextPixelIndex] - data_i32[previousPixelIndex];
        nextPixelIndex++;
        previousPixelIndex++;
      }
      hold = data_i32[nextPixelIndex - 1];
      for (; x < h; ++x, dstIndex += w) {
        data_u8[dstIndex] = sum;

        sum += hold - data_i32[previousPixelIndex];
        previousPixelIndex++;
      }

      srcIndex += h;
    }
  } else {
    for (y = 0; y < w; ++y) {
      dstIndex = y;
      sum = radiusPlusOne * data_i32[srcIndex];

      for (i = (srcIndex + 1) | 0, end = (srcIndex + radius) | 0; i <= end; ++i) {
        sum += data_i32[i];
      }

      nextPixelIndex = srcIndex + radiusPlusOne;
      previousPixelIndex = srcIndex;
      hold = data_i32[previousPixelIndex];

      for (x = 0; x < radius; ++x, dstIndex += w) {
        data_u8[dstIndex] = sum * scale;
        sum += data_i32[nextPixelIndex] - hold;
        nextPixelIndex++;
      }
      for (; x < h - radiusPlus2; x += 2, dstIndex += w2) {
        data_u8[dstIndex] = sum * scale;
        sum += data_i32[nextPixelIndex] - data_i32[previousPixelIndex];

        data_u8[dstIndex + w] = sum * scale;
        sum += data_i32[nextPixelIndex + 1] - data_i32[previousPixelIndex + 1];

        nextPixelIndex += 2;
        previousPixelIndex += 2;
      }
      for (; x < h - radiusPlusOne; ++x, dstIndex += w) {
        data_u8[dstIndex] = sum * scale;

        sum += data_i32[nextPixelIndex] - data_i32[previousPixelIndex];
        nextPixelIndex++;
        previousPixelIndex++;
      }
      hold = data_i32[nextPixelIndex - 1];
      for (; x < h; ++x, dstIndex += w) {
        data_u8[dstIndex] = sum * scale;

        sum += hold - data_i32[previousPixelIndex];
        previousPixelIndex++;
      }

      srcIndex += h;
    }
  }

  pool.release(tmp_buff);
}

/**
 * Gaussian blur via separable convolution.
 *
 * Either kernel_size or sigma can be set to 0 and the other will be
 * computed automatically.
 *
 * @param src - Source Matrix.
 * @param dst - Destination Matrix (resized to match src).
 * @param kernel_size - Kernel size (odd number, 0 = auto from sigma).
 * @param sigma - Gaussian sigma (default 0.0 = auto from kernel_size).
 */
export function gaussianBlur(src: Matrix, dst: Matrix, kernel_size: number, sigma: number = 0.0): void {
  if (typeof kernel_size === 'undefined') { kernel_size = 0; }
  kernel_size = kernel_size == 0 ? ((Math.max(1, (4.0 * sigma + 1.0 - 1e-8)) * 2 + 1) | 0) : kernel_size;
  const half_kernel = kernel_size >> 1;
  const w = src.cols, h = src.rows;
  const data_type = src.type, is_u8 = data_type & DataType.U8;

  dst.resize(w, h, src.channel);

  const src_d = src.data, dst_d = dst.data;
  let buf: Int32Array | Float32Array;
  let filter: Int32Array | Float32Array;
  const buf_sz = (kernel_size + Math.max(h, w)) | 0;

  const buf_node = pool.get(buf_sz << 2);
  const filt_node = pool.get(kernel_size << 2);

  if (is_u8) {
    buf = buf_node.i32;
    filter = filt_node.i32;
  } else if (data_type & DataType.S32) {
    buf = buf_node.i32;
    filter = filt_node.f32;
  } else {
    buf = buf_node.f32;
    filter = filt_node.f32;
  }

  getGaussianKernel(kernel_size, sigma, filter, data_type);

  if (is_u8) {
    _convol_u8(buf as Int32Array, src_d, dst_d, w, h, filter as Int32Array, kernel_size, half_kernel);
  } else {
    _convol(buf as Float32Array, src_d, dst_d, w, h, filter as Float32Array, kernel_size, half_kernel);
  }

  pool.release(buf_node);
  pool.release(filt_node);
}

/**
 * Compute image gradients using the Scharr operator.
 *
 * Output is S32C2 with interleaved [gx, gy, ...] pairs.
 *
 * @param src - Source Matrix.
 * @param dst - Destination Matrix (resized to w x h, 2 channels).
 */
export function scharrDerivatives(src: Matrix, dst: Matrix): void {
  const w = src.cols, h = src.rows;
  const dstep = w << 1;
  let x = 0, y = 0, x1 = 0, a: number, b: number, c: number, d: number, e: number, f: number;
  let srow0 = 0, srow1 = 0, srow2 = 0, drow = 0;
  let trow0: Int32Array | Float32Array;
  let trow1: Int32Array | Float32Array;

  dst.resize(w, h, 2); // 2 channel output gx, gy

  const img = src.data, gxgy = dst.data;

  const buf0_node = pool.get((w + 2) << 2);
  const buf1_node = pool.get((w + 2) << 2);

  if (src.type & DataType.U8 || src.type & DataType.S32) {
    trow0 = buf0_node.i32;
    trow1 = buf1_node.i32;
  } else {
    trow0 = buf0_node.f32;
    trow1 = buf1_node.f32;
  }

  for (; y < h; ++y, srow1 += w) {
    srow0 = ((y > 0 ? y - 1 : 1) * w) | 0;
    srow2 = ((y < h - 1 ? y + 1 : h - 2) * w) | 0;
    drow = (y * dstep) | 0;
    // do vertical convolution
    for (x = 0, x1 = 1; x <= w - 2; x += 2, x1 += 2) {
      a = img[srow0 + x], b = img[srow2 + x];
      trow0[x1] = ((a + b) * 3 + (img[srow1 + x]) * 10);
      trow1[x1] = (b - a);
      //
      a = img[srow0 + x + 1], b = img[srow2 + x + 1];
      trow0[x1 + 1] = ((a + b) * 3 + (img[srow1 + x + 1]) * 10);
      trow1[x1 + 1] = (b - a);
    }
    for (; x < w; ++x, ++x1) {
      a = img[srow0 + x], b = img[srow2 + x];
      trow0[x1] = ((a + b) * 3 + (img[srow1 + x]) * 10);
      trow1[x1] = (b - a);
    }
    // make border
    x = (w + 1) | 0;
    trow0[0] = trow0[1]; trow0[x] = trow0[w];
    trow1[0] = trow1[1]; trow1[x] = trow1[w];
    // do horizontal convolution, interleave the results and store them
    for (x = 0; x <= w - 4; x += 4) {
      a = trow1[x + 2], b = trow1[x + 1], c = trow1[x + 3], d = trow1[x + 4],
      e = trow0[x + 2], f = trow0[x + 3];
      gxgy[drow++] = (e - trow0[x]);
      gxgy[drow++] = ((a + trow1[x]) * 3 + b * 10);
      gxgy[drow++] = (f - trow0[x + 1]);
      gxgy[drow++] = ((c + b) * 3 + a * 10);

      gxgy[drow++] = ((trow0[x + 4] - e));
      gxgy[drow++] = (((d + a) * 3 + c * 10));
      gxgy[drow++] = ((trow0[x + 5] - f));
      gxgy[drow++] = (((trow1[x + 5] + c) * 3 + d * 10));
    }
    for (; x < w; ++x) {
      gxgy[drow++] = ((trow0[x + 2] - trow0[x]));
      gxgy[drow++] = (((trow1[x + 2] + trow1[x]) * 3 + trow1[x + 1] * 10));
    }
  }
  pool.release(buf0_node);
  pool.release(buf1_node);
}

/**
 * Compute image gradients using the Sobel operator.
 *
 * Uses kernels [1 2 1] and [-1 0 1]. Output is S32C2 with
 * interleaved [gx, gy, ...] pairs.
 *
 * @param src - Source Matrix.
 * @param dst - Destination Matrix (resized to w x h, 2 channels).
 */
export function sobelDerivatives(src: Matrix, dst: Matrix): void {
  const w = src.cols, h = src.rows;
  const dstep = w << 1;
  let x = 0, y = 0, x1 = 0, a: number, b: number, c: number, d: number, e: number, f: number;
  let srow0 = 0, srow1 = 0, srow2 = 0, drow = 0;
  let trow0: Int32Array | Float32Array;
  let trow1: Int32Array | Float32Array;

  dst.resize(w, h, 2); // 2 channel output gx, gy

  const img = src.data, gxgy = dst.data;

  const buf0_node = pool.get((w + 2) << 2);
  const buf1_node = pool.get((w + 2) << 2);

  if (src.type & DataType.U8 || src.type & DataType.S32) {
    trow0 = buf0_node.i32;
    trow1 = buf1_node.i32;
  } else {
    trow0 = buf0_node.f32;
    trow1 = buf1_node.f32;
  }

  for (; y < h; ++y, srow1 += w) {
    srow0 = ((y > 0 ? y - 1 : 1) * w) | 0;
    srow2 = ((y < h - 1 ? y + 1 : h - 2) * w) | 0;
    drow = (y * dstep) | 0;
    // do vertical convolution
    for (x = 0, x1 = 1; x <= w - 2; x += 2, x1 += 2) {
      a = img[srow0 + x], b = img[srow2 + x];
      trow0[x1] = ((a + b) + (img[srow1 + x] * 2));
      trow1[x1] = (b - a);
      //
      a = img[srow0 + x + 1], b = img[srow2 + x + 1];
      trow0[x1 + 1] = ((a + b) + (img[srow1 + x + 1] * 2));
      trow1[x1 + 1] = (b - a);
    }
    for (; x < w; ++x, ++x1) {
      a = img[srow0 + x], b = img[srow2 + x];
      trow0[x1] = ((a + b) + (img[srow1 + x] * 2));
      trow1[x1] = (b - a);
    }
    // make border
    x = (w + 1) | 0;
    trow0[0] = trow0[1]; trow0[x] = trow0[w];
    trow1[0] = trow1[1]; trow1[x] = trow1[w];
    // do horizontal convolution, interleave the results and store them
    for (x = 0; x <= w - 4; x += 4) {
      a = trow1[x + 2], b = trow1[x + 1], c = trow1[x + 3], d = trow1[x + 4],
      e = trow0[x + 2], f = trow0[x + 3];
      gxgy[drow++] = (e - trow0[x]);
      gxgy[drow++] = (a + trow1[x] + b * 2);
      gxgy[drow++] = (f - trow0[x + 1]);
      gxgy[drow++] = (c + b + a * 2);

      gxgy[drow++] = (trow0[x + 4] - e);
      gxgy[drow++] = (d + a + c * 2);
      gxgy[drow++] = (trow0[x + 5] - f);
      gxgy[drow++] = (trow1[x + 5] + c + d * 2);
    }
    for (; x < w; ++x) {
      gxgy[drow++] = (trow0[x + 2] - trow0[x]);
      gxgy[drow++] = (trow1[x + 2] + trow1[x] + trow1[x + 1] * 2);
    }
  }
  pool.release(buf0_node);
  pool.release(buf1_node);
}

/**
 * Compute integral image (and optionally squared / tilted integrals).
 *
 * Integral images enable O(1) rectangle sum queries and are used
 * internally by the HAAR detector. Output arrays must have size
 * (cols+1) * (rows+1).
 *
 * @param src - Source Matrix.
 * @param dst_sum - Output integral sum array, or null/undefined to skip.
 * @param dst_sqsum - Output squared integral sum array, or null/undefined.
 * @param dst_tilted - Output tilted (45-degree rotated) integral array, or null/undefined.
 */
export function computeIntegralImage(
  src: Matrix,
  dst_sum?: Int32Array | Float32Array | Float64Array | null,
  dst_sqsum?: Int32Array | Float32Array | Float64Array | null,
  dst_tilted?: Int32Array | Float32Array | Float64Array | null,
): void {
  const w0 = src.cols | 0, h0 = src.rows | 0, src_d = src.data;
  const w1 = (w0 + 1) | 0;
  let s = 0, s2 = 0, p = 0, pup = 0, i = 0, j = 0, v = 0, k = 0;

  if (dst_sum && dst_sqsum) {
    // fill first row with zeros
    for (; i < w1; ++i) {
      dst_sum[i] = 0, dst_sqsum[i] = 0;
    }
    p = (w1 + 1) | 0, pup = 1;
    for (i = 0, k = 0; i < h0; ++i, ++p, ++pup) {
      s = s2 = 0;
      for (j = 0; j <= w0 - 2; j += 2, k += 2, p += 2, pup += 2) {
        v = src_d[k];
        s += v, s2 += v * v;
        dst_sum[p] = dst_sum[pup] + s;
        dst_sqsum[p] = dst_sqsum[pup] + s2;

        v = src_d[k + 1];
        s += v, s2 += v * v;
        dst_sum[p + 1] = dst_sum[pup + 1] + s;
        dst_sqsum[p + 1] = dst_sqsum[pup + 1] + s2;
      }
      for (; j < w0; ++j, ++k, ++p, ++pup) {
        v = src_d[k];
        s += v, s2 += v * v;
        dst_sum[p] = dst_sum[pup] + s;
        dst_sqsum[p] = dst_sqsum[pup] + s2;
      }
    }
  } else if (dst_sum) {
    // fill first row with zeros
    for (; i < w1; ++i) {
      dst_sum[i] = 0;
    }
    p = (w1 + 1) | 0, pup = 1;
    for (i = 0, k = 0; i < h0; ++i, ++p, ++pup) {
      s = 0;
      for (j = 0; j <= w0 - 2; j += 2, k += 2, p += 2, pup += 2) {
        s += src_d[k];
        dst_sum[p] = dst_sum[pup] + s;
        s += src_d[k + 1];
        dst_sum[p + 1] = dst_sum[pup + 1] + s;
      }
      for (; j < w0; ++j, ++k, ++p, ++pup) {
        s += src_d[k];
        dst_sum[p] = dst_sum[pup] + s;
      }
    }
  } else if (dst_sqsum) {
    // fill first row with zeros
    for (; i < w1; ++i) {
      dst_sqsum[i] = 0;
    }
    p = (w1 + 1) | 0, pup = 1;
    for (i = 0, k = 0; i < h0; ++i, ++p, ++pup) {
      s2 = 0;
      for (j = 0; j <= w0 - 2; j += 2, k += 2, p += 2, pup += 2) {
        v = src_d[k];
        s2 += v * v;
        dst_sqsum[p] = dst_sqsum[pup] + s2;
        v = src_d[k + 1];
        s2 += v * v;
        dst_sqsum[p + 1] = dst_sqsum[pup + 1] + s2;
      }
      for (; j < w0; ++j, ++k, ++p, ++pup) {
        v = src_d[k];
        s2 += v * v;
        dst_sqsum[p] = dst_sqsum[pup] + s2;
      }
    }
  }

  if (dst_tilted) {
    // fill first row with zeros
    for (i = 0; i < w1; ++i) {
      dst_tilted[i] = 0;
    }
    // diagonal
    p = (w1 + 1) | 0, pup = 0;
    for (i = 0, k = 0; i < h0; ++i, ++p, ++pup) {
      for (j = 0; j <= w0 - 2; j += 2, k += 2, p += 2, pup += 2) {
        dst_tilted[p] = src_d[k] + dst_tilted[pup];
        dst_tilted[p + 1] = src_d[k + 1] + dst_tilted[pup + 1];
      }
      for (; j < w0; ++j, ++k, ++p, ++pup) {
        dst_tilted[p] = src_d[k] + dst_tilted[pup];
      }
    }
    // diagonal
    p = (w1 + w0) | 0, pup = w0;
    for (i = 0; i < h0; ++i, p += w1, pup += w1) {
      dst_tilted[p] += dst_tilted[pup];
    }

    for (j = w0 - 1; j > 0; --j) {
      p = j + h0 * w1, pup = p - w1;
      for (i = h0; i > 0; --i, p -= w1, pup -= w1) {
        dst_tilted[p] += dst_tilted[pup] + dst_tilted[pup + 1];
      }
    }
  }
}

/**
 * Histogram equalization for single-channel grayscale images.
 *
 * Stretches the intensity distribution to improve contrast.
 *
 * @param src - Source Matrix (U8C1).
 * @param dst - Destination Matrix (resized to match src).
 */
export function equalizeHistogram(src: Matrix, dst: Matrix): void {
  const w = src.cols, h = src.rows, src_d = src.data;

  dst.resize(w, h, src.channel);

  const dst_d = dst.data, size = w * h;
  let i = 0, prev = 0;

  const hist0_node = pool.get(256 << 2);
  const hist0 = hist0_node.i32;
  for (; i < 256; ++i) hist0[i] = 0;
  for (i = 0; i < size; ++i) {
    ++hist0[src_d[i]];
  }

  prev = hist0[0];
  for (i = 1; i < 256; ++i) {
    prev = hist0[i] += prev;
  }

  const norm = 255 / size;
  for (i = 0; i < size; ++i) {
    dst_d[i] = (hist0[src_d[i]] * norm + 0.5) | 0;
  }
  pool.release(hist0_node);
}

/**
 * Canny edge detection with hysteresis thresholding.
 *
 * Detects edges using Sobel gradients and non-maximum suppression,
 * then applies hysteresis to connect strong and weak edges.
 *
 * @param src - Source Matrix (U8C1).
 * @param dst - Destination Matrix (edges as 0 or 255).
 * @param low_thresh - Low hysteresis threshold.
 * @param high_thresh - High hysteresis threshold.
 */
export function cannyEdges(src: Matrix, dst: Matrix, low_thresh: number, high_thresh: number): void {
  const w = src.cols, h = src.rows;

  dst.resize(w, h, src.channel);

  const dst_d = dst.data;
  let i = 0, j = 0, grad = 0, _grad = 0, suppress = 0, f = 0, x = 0, y = 0, s = 0;
  const w2 = w << 1;
  let tg22x = 0, tg67x = 0;

  // cache buffers
  const dxdy_node = pool.get((h * w2) << 2);
  const buf_node = pool.get((3 * (w + 2)) << 2);
  const map_node = pool.get(((h + 2) * (w + 2)) << 2);
  const stack_node = pool.get((h * w) << 2);

  const buf = buf_node.i32;
  const map = map_node.i32;
  const stack = stack_node.i32;
  const dxdy = dxdy_node.i32;
  const dxdy_m = new Matrix(w, h, S32C2, dxdy_node.data);
  const map_w = (w + 2) | 0;
  let row0 = 1, row1 = (w + 2 + 1) | 0, row2 = (2 * (w + 2) + 1) | 0, map_i = (map_w + 1) | 0, stack_i = 0;

  sobelDerivatives(src, dxdy_m);

  if (low_thresh > high_thresh) {
    i = low_thresh;
    low_thresh = high_thresh;
    high_thresh = i;
  }

  i = (3 * (w + 2)) | 0;
  while (--i >= 0) {
    buf[i] = 0;
  }

  i = ((h + 2) * (w + 2)) | 0;
  while (--i >= 0) {
    map[i] = 0;
  }

  for (; j < w; ++j, grad += 2) {
    x = dxdy[grad], y = dxdy[grad + 1];
    buf[row1 + j] = ((x ^ (x >> 31)) - (x >> 31)) + ((y ^ (y >> 31)) - (y >> 31));
  }

  for (i = 1; i <= h; ++i, grad += w2) {
    if (i == h) {
      j = row2 + w;
      while (--j >= row2) {
        buf[j] = 0;
      }
    } else {
      for (j = 0; j < w; j++) {
        x = dxdy[grad + (j << 1)], y = dxdy[grad + (j << 1) + 1];
        buf[row2 + j] = ((x ^ (x >> 31)) - (x >> 31)) + ((y ^ (y >> 31)) - (y >> 31));
      }
    }
    _grad = (grad - w2) | 0;
    map[map_i - 1] = 0;
    suppress = 0;
    for (j = 0; j < w; ++j, _grad += 2) {
      f = buf[row1 + j];
      if (f > low_thresh) {
        x = dxdy[_grad];
        y = dxdy[_grad + 1];
        s = x ^ y;
        // seems to be faster than Math.abs
        x = ((x ^ (x >> 31)) - (x >> 31)) | 0;
        y = ((y ^ (y >> 31)) - (y >> 31)) | 0;
        //x * tan(22.5) x * tan(67.5) == 2 * x + x * tan(22.5)
        tg22x = x * 13573;
        tg67x = tg22x + ((x + x) << 15);
        y <<= 15;
        if (y < tg22x) {
          if (f > buf[row1 + j - 1] && f >= buf[row1 + j + 1]) {
            if (f > high_thresh && !suppress && map[map_i + j - map_w] != 2) {
              map[map_i + j] = 2;
              suppress = 1;
              stack[stack_i++] = map_i + j;
            } else {
              map[map_i + j] = 1;
            }
            continue;
          }
        } else if (y > tg67x) {
          if (f > buf[row0 + j] && f >= buf[row2 + j]) {
            if (f > high_thresh && !suppress && map[map_i + j - map_w] != 2) {
              map[map_i + j] = 2;
              suppress = 1;
              stack[stack_i++] = map_i + j;
            } else {
              map[map_i + j] = 1;
            }
            continue;
          }
        } else {
          s = s < 0 ? -1 : 1;
          if (f > buf[row0 + j - s] && f > buf[row2 + j + s]) {
            if (f > high_thresh && !suppress && map[map_i + j - map_w] != 2) {
              map[map_i + j] = 2;
              suppress = 1;
              stack[stack_i++] = map_i + j;
            } else {
              map[map_i + j] = 1;
            }
            continue;
          }
        }
      }
      map[map_i + j] = 0;
      suppress = 0;
    }
    map[map_i + w] = 0;
    map_i += map_w;
    j = row0;
    row0 = row1;
    row1 = row2;
    row2 = j;
  }

  j = map_i - map_w - 1;
  for (i = 0; i < map_w; ++i, ++j) {
    map[j] = 0;
  }
  // path following
  while (stack_i > 0) {
    map_i = stack[--stack_i];
    map_i -= map_w + 1;
    if (map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
    map_i += 1;
    if (map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
    map_i += 1;
    if (map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
    map_i += map_w;
    if (map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
    map_i -= 2;
    if (map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
    map_i += map_w;
    if (map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
    map_i += 1;
    if (map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
    map_i += 1;
    if (map[map_i] == 1) map[map_i] = 2, stack[stack_i++] = map_i;
  }

  map_i = map_w + 1;
  let row0_out = 0;
  for (i = 0; i < h; ++i, map_i += map_w) {
    for (j = 0; j < w; ++j) {
      dst_d[row0_out++] = (map[map_i + j] == 2 ? 1 : 0) * 0xff;
    }
  }

  // free buffers
  pool.release(dxdy_node);
  pool.release(buf_node);
  pool.release(map_node);
  pool.release(stack_node);
}

/**
 * Warp image with a 2x3 affine transform using bilinear interpolation.
 *
 * Applies the given affine transform (first two rows of a 3x3 Matrix)
 * to map source pixels to destination coordinates.
 *
 * @param src - Source Matrix.
 * @param dst - Destination Matrix (dimensions define output size).
 * @param transform - 3x3 Matrix holding the affine transform (only first 2 rows used).
 * @param fillValue - Value for out-of-bounds pixels (default 0).
 */
export function warpAffine(src: Matrix, dst: Matrix, transform: Matrix, fillValue: number = 0): void {
  const src_width = src.cols, src_height = src.rows, dst_width = dst.cols, dst_height = dst.rows;
  const src_d = src.data, dst_d = dst.data;
  let x = 0, y = 0, off = 0, ixs = 0, iys = 0, xs = 0.0, ys = 0.0, a = 0.0, b = 0.0, p0 = 0.0, p1 = 0.0;
  const td = transform.data;
  const m00 = td[0], m01 = td[1], m02 = td[2],
        m10 = td[3], m11 = td[4], m12 = td[5];

  for (let dptr = 0; y < dst_height; ++y) {
    xs = m01 * y + m02;
    ys = m11 * y + m12;
    for (x = 0; x < dst_width; ++x, ++dptr, xs += m00, ys += m10) {
      ixs = xs | 0; iys = ys | 0;

      if (ixs >= 0 && iys >= 0 && ixs < (src_width - 1) && iys < (src_height - 1)) {
        a = xs - ixs;
        b = ys - iys;
        off = src_width * iys + ixs;

        p0 = src_d[off] + a * (src_d[off + 1] - src_d[off]);
        p1 = src_d[off + src_width] + a * (src_d[off + src_width + 1] - src_d[off + src_width]);

        dst_d[dptr] = p0 + b * (p1 - p0);
      }
      else dst_d[dptr] = fillValue;
    }
  }
}

// ---------------------------------------------------------------------------
// Adaptive thresholding
// ---------------------------------------------------------------------------

/**
 * Adaptive method for per-pixel thresholding.
 */
export enum AdaptiveMethod {
  /** Local mean computed via box blur. */
  MEAN = 0,
  /** Local mean computed via Gaussian blur. */
  GAUSSIAN = 1,
}

/**
 * Apply adaptive thresholding based on local neighborhood statistics.
 *
 * For each pixel, computes a local mean over a blockSize x blockSize neighborhood
 * and thresholds: dst[i] = (src[i] > localMean - constant) ? maxValue : 0.
 *
 * @param src - Input grayscale image (U8C1).
 * @param dst - Output binary image (U8C1).
 * @param maxValue - Value assigned to pixels passing the threshold (typically 255).
 * @param method - AdaptiveMethod.MEAN or AdaptiveMethod.GAUSSIAN.
 * @param blockSize - Size of local neighborhood (must be odd, >= 3).
 * @param constant - Value subtracted from local mean before comparison.
 */
export function adaptiveThreshold(
  src: Matrix,
  dst: Matrix,
  maxValue: number,
  method: AdaptiveMethod,
  blockSize: number,
  constant: number,
): void {
  const w = src.cols, h = src.rows;
  dst.resize(w, h, 1);

  // Ensure blockSize is odd and >= 3
  if (blockSize < 3) blockSize = 3;
  if ((blockSize & 1) === 0) blockSize += 1;

  // Compute local mean into a temp matrix
  const mean = new Matrix(w, h, U8C1);
  if (method === AdaptiveMethod.GAUSSIAN) {
    gaussianBlur(src, mean, blockSize, 0);
  } else {
    boxBlurGray(src, mean, (blockSize - 1) >> 1);
  }

  // Threshold: dst[i] = (src[i] > mean[i] - constant) ? maxValue : 0
  const sd = src.data, md = mean.data, dd = dst.data;
  const n = w * h;
  for (let i = 0; i < n; i++) {
    dd[i] = sd[i] > (md[i] - constant) ? maxValue : 0;
  }
}

// ---------------------------------------------------------------------------
// Perspective warp
// ---------------------------------------------------------------------------

/**
 * Warp an image using a 3x3 perspective (homography) transform.
 *
 * Supports single and multi-channel images. Uses backward mapping with
 * bilinear interpolation for sub-pixel accuracy.
 *
 * @param src - Source image (any type/channels).
 * @param dst - Destination image (pre-allocated with desired output dimensions).
 * @param transform - 3x3 homography matrix (F32C1 or F64C1). Maps source to destination.
 * @param fillValue - Value for out-of-bounds pixels (default 0).
 */
export function warpPerspective(
  src: Matrix,
  dst: Matrix,
  transform: Matrix,
  fillValue: number = 0,
): void {
  const sw = src.cols, sh = src.rows;
  const dw = dst.cols, dh = dst.rows;
  const ch = src.channel;
  const sd = src.data, dd = dst.data;
  const td = transform.data;

  const h0 = td[0], h1 = td[1], h2 = td[2];
  const h3 = td[3], h4 = td[4], h5 = td[5];
  const h6 = td[6], h7 = td[7], h8 = td[8];

  let dptr = 0;

  for (let dy = 0; dy < dh; dy++) {
    // Precompute row-level terms
    const ry = h1 * dy + h2;
    const ry2 = h4 * dy + h5;
    const rw = h7 * dy + h8;

    for (let dx = 0; dx < dw; dx++) {
      const w = h6 * dx + rw;

      if (Math.abs(w) < 1e-10) {
        // Degenerate -- fill
        for (let c = 0; c < ch; c++) dd[dptr++] = fillValue;
        continue;
      }

      const invW = 1.0 / w;
      const sx = (h0 * dx + ry) * invW;
      const sy = (h3 * dx + ry2) * invW;

      const ix = sx | 0;
      const iy = sy | 0;

      if (ix >= 0 && iy >= 0 && ix < sw - 1 && iy < sh - 1) {
        const a = sx - ix;
        const b = sy - iy;

        if (ch === 1) {
          // Single channel -- optimized scalar path
          const off = iy * sw + ix;
          const p0 = sd[off] + a * (sd[off + 1] - sd[off]);
          const p1 = sd[off + sw] + a * (sd[off + sw + 1] - sd[off + sw]);
          dd[dptr++] = (p0 + b * (p1 - p0)) | 0;
        } else {
          // Multi-channel
          const off = (iy * sw + ix) * ch;
          const stride = sw * ch;
          for (let c = 0; c < ch; c++) {
            const p0 = sd[off + c] + a * (sd[off + ch + c] - sd[off + c]);
            const p1 = sd[off + stride + c] + a * (sd[off + stride + ch + c] - sd[off + stride + c]);
            dd[dptr++] = (p0 + b * (p1 - p0)) | 0;
          }
        }
      } else {
        for (let c = 0; c < ch; c++) dd[dptr++] = fillValue;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Contour detection
// ---------------------------------------------------------------------------

/**
 * A detected contour (connected boundary) in a binary image.
 */
export interface Contour {
  /** Ordered array of boundary points tracing the contour. */
  points: { x: number; y: number }[];
  /** Contour area computed via the shoelace formula. */
  area: number;
  /** Contour perimeter (sum of point-to-point distances). */
  perimeter: number;
  /** Axis-aligned bounding rectangle. */
  boundingRect: { x: number; y: number; width: number; height: number };
}

/**
 * Contour retrieval mode.
 */
export enum ContourMode {
  /** Retrieve only the outermost contours. */
  EXTERNAL = 0,
  /** Retrieve all contours without hierarchy. */
  LIST = 1,
}

/**
 * Find contours (connected boundaries) in a binary image.
 *
 * Uses Moore boundary tracing (8-connectivity) to trace each contour.
 * Input must be a binary image (0 = background, non-zero = foreground).
 *
 * Based on: Suzuki, S. and Abe, K., "Topological Structural Analysis of
 * Digitized Binary Images by Border Following", CVGIP 30(1), 1985.
 *
 * @param src - Binary input image (U8C1, values 0 or non-zero).
 * @param mode - ContourMode.LIST (all contours) or ContourMode.EXTERNAL (outermost only).
 * @returns Array of Contour objects sorted by area descending.
 */
export function findContours(src: Matrix, mode: ContourMode = ContourMode.LIST): Contour[] {
  const w = src.cols, h = src.rows;
  const sd = src.data;

  // Work on a copy (border tracing modifies the image)
  const img = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) img[i] = sd[i] ? 1 : 0;

  const contours: Contour[] = [];

  // 8-connectivity neighbor offsets (clockwise from right)
  const ndx = [1, 1, 0, -1, -1, -1, 0, 1];
  const ndy = [0, 1, 1, 1, 0, -1, -1, -1];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (img[y * w + x] !== 1) continue;
      // Check if this is an outer border start (pixel to the left is 0 or border)
      if (x > 0 && img[y * w + x - 1] !== 0) continue;

      // Trace contour using Moore boundary tracing
      const points: { x: number; y: number }[] = [];
      let cx = x, cy = y;
      let dir = 0; // start searching to the right
      const startX = x, startY = y;
      let steps = 0;
      const maxSteps = w * h * 2;

      do {
        points.push({ x: cx, y: cy });
        img[cy * w + cx] = 2; // mark as traced

        // Find next boundary pixel
        let found = false;
        const searchStart = (dir + 5) % 8; // start 3 positions back
        for (let d = 0; d < 8; d++) {
          const nd = (searchStart + d) % 8;
          const nx = cx + ndx[nd], ny = cy + ndy[nd];
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && img[ny * w + nx] >= 1) {
            dir = nd;
            cx = nx;
            cy = ny;
            found = true;
            break;
          }
        }
        if (!found) break;
        steps++;
      } while ((cx !== startX || cy !== startY) && steps < maxSteps);

      if (points.length < 3) continue;

      // Compute contour properties
      let area = 0;
      let perimeter = 0;
      let minX = w, minY = h, maxX = 0, maxY = 0;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const q = points[(i + 1) % points.length];
        area += p.x * q.y - q.x * p.y;
        const ddx = q.x - p.x, ddy = q.y - p.y;
        perimeter += Math.sqrt(ddx * ddx + ddy * ddy);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      area = Math.abs(area / 2);

      contours.push({
        points,
        area,
        perimeter,
        boundingRect: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
      });

      // EXTERNAL mode: fill interior to skip inner contours
      if (mode === ContourMode.EXTERNAL) {
        for (let fy = minY; fy <= maxY; fy++) {
          for (let fx = minX; fx <= maxX; fx++) {
            if (img[fy * w + fx] === 1) img[fy * w + fx] = 2;
          }
        }
      }
    }
  }

  // Sort by area descending
  contours.sort((a, b) => b.area - a.area);
  return contours;
}

/**
 * Approximate a contour polygon using the Douglas-Peucker algorithm.
 *
 * Simplifies a contour to fewer points while preserving shape within
 * the specified epsilon tolerance. Useful for reducing a traced contour
 * to its essential vertices (e.g., 4 points for a rectangle).
 *
 * @param contour - Input contour from findContours.
 * @param epsilon - Maximum distance from the original contour (larger = fewer points).
 * @returns Simplified array of points.
 */
export function approxPoly(
  contour: Contour,
  epsilon: number,
): { x: number; y: number }[] {
  const pts = contour.points;
  if (pts.length <= 2) return pts.slice();

  // Close the contour for processing
  const closed = pts.concat([pts[0]]);

  function _dp(points: { x: number; y: number }[], eps: number): { x: number; y: number }[] {
    if (points.length <= 2) return points;
    let maxDist = 0, maxIdx = 0;
    const first = points[0], last = points[points.length - 1];
    const lx = last.x - first.x, ly = last.y - first.y;
    const lenSq = lx * lx + ly * ly;
    for (let i = 1; i < points.length - 1; i++) {
      let dist: number;
      if (lenSq === 0) {
        const ddx = points[i].x - first.x, ddy = points[i].y - first.y;
        dist = Math.sqrt(ddx * ddx + ddy * ddy);
      } else {
        const t = Math.max(0, Math.min(1,
          ((points[i].x - first.x) * lx + (points[i].y - first.y) * ly) / lenSq));
        const px = first.x + t * lx, py = first.y + t * ly;
        const ddx = points[i].x - px, ddy = points[i].y - py;
        dist = Math.sqrt(ddx * ddx + ddy * ddy);
      }
      if (dist > maxDist) { maxDist = dist; maxIdx = i; }
    }
    if (maxDist > eps) {
      const left = _dp(points.slice(0, maxIdx + 1), eps);
      const right = _dp(points.slice(maxIdx), eps);
      return left.slice(0, -1).concat(right);
    }
    return [first, last];
  }

  let result = _dp(closed, epsilon);
  // Remove duplicate closing point
  if (result.length > 1 &&
      result[0].x === result[result.length - 1].x &&
      result[0].y === result[result.length - 1].y) {
    result = result.slice(0, -1);
  }
  return result;
}
