/**
 * YAPE keypoint detector.
 *
 * Ported from legacy/jsfeat_yape.js.
 *
 * Original author: Eugene Zatepyakin / http://inspirit.ru/
 * Copyright 2007 Computer Vision Lab,
 * Ecole Polytechnique Federale de Lausanne (EPFL), Switzerland.
 */

import type { Matrix } from '../core/matrix';
import type { Keypoint } from '../core/keypoint';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function precompute_directions(step: number, dirs: Int32Array, R: number): number {
  let i = 0;
  let x: number, y: number;

  x = R;
  for (y = 0; y < x; y++, i++) {
    x = (Math.sqrt(R * R - y * y) + 0.5) | 0;
    dirs[i] = x + step * y;
  }
  for (x--; x < y && x >= 0; x--, i++) {
    y = (Math.sqrt(R * R - x * x) + 0.5) | 0;
    dirs[i] = x + step * y;
  }
  for (; -x < y; x--, i++) {
    y = (Math.sqrt(R * R - x * x) + 0.5) | 0;
    dirs[i] = x + step * y;
  }
  for (y--; y >= 0; y--, i++) {
    x = (-Math.sqrt(R * R - y * y) - 0.5) | 0;
    dirs[i] = x + step * y;
  }
  for (; y > x; y--, i++) {
    x = (-Math.sqrt(R * R - y * y) - 0.5) | 0;
    dirs[i] = x + step * y;
  }
  for (x++; x <= 0; x++, i++) {
    y = (-Math.sqrt(R * R - x * x) - 0.5) | 0;
    dirs[i] = x + step * y;
  }
  for (; x < -y; x++, i++) {
    y = (-Math.sqrt(R * R - x * x) - 0.5) | 0;
    dirs[i] = x + step * y;
  }
  for (y++; y < 0; y++, i++) {
    x = (Math.sqrt(R * R - y * y) + 0.5) | 0;
    dirs[i] = x + step * y;
  }

  dirs[i] = dirs[0];
  dirs[i + 1] = dirs[1];
  return i;
}

function third_check(Sb: Int32Array, off: number, step: number): number {
  let n = 0;
  if (Sb[off + 1] != 0) n++;
  if (Sb[off - 1] != 0) n++;
  if (Sb[off + step] != 0) n++;
  if (Sb[off + step + 1] != 0) n++;
  if (Sb[off + step - 1] != 0) n++;
  if (Sb[off - step] != 0) n++;
  if (Sb[off - step + 1] != 0) n++;
  if (Sb[off - step - 1] != 0) n++;

  return n;
}

function is_local_maxima(
  p: Int32Array,
  off: number,
  v: number,
  step: number,
  neighborhood: number,
): boolean {
  let x: number, y: number;

  if (v > 0) {
    off -= step * neighborhood;
    for (y = -neighborhood; y <= neighborhood; ++y) {
      for (x = -neighborhood; x <= neighborhood; ++x) {
        if (p[off + x] > v) return false;
      }
      off += step;
    }
  } else {
    off -= step * neighborhood;
    for (y = -neighborhood; y <= neighborhood; ++y) {
      for (x = -neighborhood; x <= neighborhood; ++x) {
        if (p[off + x] < v) return false;
      }
      off += step;
    }
  }
  return true;
}

function perform_one_point(
  I: Uint8Array | Int32Array | Float32Array | Float64Array,
  x: number,
  Scores: Int32Array,
  Im: number,
  Ip: number,
  dirs: Int32Array,
  opposite: number,
  dirs_nb: number,
): void {
  let score = 0;
  let a = 0;
  let b = (opposite - 1) | 0;
  let A = 0, B0 = 0, B1 = 0, B2 = 0;
  let state = 0;

  // WE KNOW THAT NOT(A ~ I0 & B1 ~ I0):
  A = I[x + dirs[a]];
  if (A <= Ip) {
    if (A >= Im) { // A ~ I0
      B0 = I[x + dirs[b]];
      if (B0 <= Ip) {
        if (B0 >= Im) { Scores[x] = 0; return; }
        else {
          b++; B1 = I[x + dirs[b]];
          if (B1 > Ip) {
            b++; B2 = I[x + dirs[b]];
            if (B2 > Ip) state = 3;
            else if (B2 < Im) state = 6;
            else { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0
          }
          else/* if (B1 < Im)*/ {
            b++; B2 = I[x + dirs[b]];
            if (B2 > Ip) state = 7;
            else if (B2 < Im) state = 2;
            else { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0
          }
          //else { Scores[x] = 0; return; } // A ~ I0, B1 ~ I0
        }
      }
      else { // B0 < I0
        b++; B1 = I[x + dirs[b]];
        if (B1 > Ip) {
          b++; B2 = I[x + dirs[b]];
          if (B2 > Ip) state = 3;
          else if (B2 < Im) state = 6;
          else { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0
        }
        else if (B1 < Im) {
          b++; B2 = I[x + dirs[b]];
          if (B2 > Ip) state = 7;
          else if (B2 < Im) state = 2;
          else { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0
        }
        else { Scores[x] = 0; return; } // A ~ I0, B1 ~ I0
      }
    }
    else { // A > I0
      B0 = I[x + dirs[b]];
      if (B0 > Ip) { Scores[x] = 0; return; }
      b++; B1 = I[x + dirs[b]];
      if (B1 > Ip) { Scores[x] = 0; return; }
      b++; B2 = I[x + dirs[b]];
      if (B2 > Ip) { Scores[x] = 0; return; }
      state = 1;
    }
  }
  else // A < I0
  {
    B0 = I[x + dirs[b]];
    if (B0 < Im) { Scores[x] = 0; return; }
    b++; B1 = I[x + dirs[b]];
    if (B1 < Im) { Scores[x] = 0; return; }
    b++; B2 = I[x + dirs[b]];
    if (B2 < Im) { Scores[x] = 0; return; }
    state = 0;
  }

  for (a = 1; a <= opposite; a++) {
    A = I[x + dirs[a]];

    switch (state) {
      case 0:
        if (A > Ip) {
          B1 = B2; b++; B2 = I[x + dirs[b]];
          if (B2 < Im) { Scores[x] = 0; return; }
          { score -= A + B1; state = 0; break; }
        }
        if (A < Im) {
          if (B1 > Ip) { Scores[x] = 0; return; }
          if (B2 > Ip) { Scores[x] = 0; return; }
          B1 = B2; b++; B2 = I[x + dirs[b]];
          if (B2 > Ip) { Scores[x] = 0; return; }
          { score -= A + B1; state = 8; break; }
        }
        // A ~ I0
        if (B1 <= Ip) { Scores[x] = 0; return; }
        if (B2 <= Ip) { Scores[x] = 0; return; }
        B1 = B2; b++; B2 = I[x + dirs[b]];
        if (B2 > Ip) { score -= A + B1; state = 3; break; }
        if (B2 < Im) { score -= A + B1; state = 6; break; }
        { Scores[x] = 0; return; }

      case 1:
        if (A < Im) {
          B1 = B2; b++; B2 = I[x + dirs[b]];
          if (B2 > Ip) { Scores[x] = 0; return; }
          { score -= A + B1; state = 1; break; }
        }
        if (A > Ip) {
          if (B1 < Im) { Scores[x] = 0; return; }
          if (B2 < Im) { Scores[x] = 0; return; }
          B1 = B2; b++; B2 = I[x + dirs[b]];
          if (B2 < Im) { Scores[x] = 0; return; }
          { score -= A + B1; state = 9; break; }
        }
        // A ~ I0
        if (B1 >= Im) { Scores[x] = 0; return; }
        if (B2 >= Im) { Scores[x] = 0; return; }
        B1 = B2; b++; B2 = I[x + dirs[b]];
        if (B2 < Im) { score -= A + B1; state = 2; break; }
        if (B2 > Ip) { score -= A + B1; state = 7; break; }
        { Scores[x] = 0; return; }

      case 2:
        if (A > Ip) { Scores[x] = 0; return; }
        B1 = B2; b++; B2 = I[x + dirs[b]];
        if (A < Im) {
          if (B2 > Ip) { Scores[x] = 0; return; }
          { score -= A + B1; state = 4; break; }
        }
        // A ~ I0
        if (B2 > Ip) { score -= A + B1; state = 7; break; }
        if (B2 < Im) { score -= A + B1; state = 2; break; }
        { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0

      case 3:
        if (A < Im) { Scores[x] = 0; return; }
        B1 = B2; b++; B2 = I[x + dirs[b]];
        if (A > Ip) {
          if (B2 < Im) { Scores[x] = 0; return; }
          { score -= A + B1; state = 5; break; }
        }
        // A ~ I0
        if (B2 > Ip) { score -= A + B1; state = 3; break; }
        if (B2 < Im) { score -= A + B1; state = 6; break; }
        { Scores[x] = 0; return; }

      case 4:
        if (A > Ip) { Scores[x] = 0; return; }
        if (A < Im) {
          B1 = B2; b++; B2 = I[x + dirs[b]];
          if (B2 > Ip) { Scores[x] = 0; return; }
          { score -= A + B1; state = 1; break; }
        }
        if (B2 >= Im) { Scores[x] = 0; return; }
        B1 = B2; b++; B2 = I[x + dirs[b]];
        if (B2 < Im) { score -= A + B1; state = 2; break; }
        if (B2 > Ip) { score -= A + B1; state = 7; break; }
        { Scores[x] = 0; return; }

      case 5:
        if (A < Im) { Scores[x] = 0; return; }
        if (A > Ip) {
          B1 = B2; b++; B2 = I[x + dirs[b]];
          if (B2 < Im) { Scores[x] = 0; return; }
          { score -= A + B1; state = 0; break; }
        }
        // A ~ I0
        if (B2 <= Ip) { Scores[x] = 0; return; }
        B1 = B2; b++; B2 = I[x + dirs[b]];
        if (B2 > Ip) { score -= A + B1; state = 3; break; }
        if (B2 < Im) { score -= A + B1; state = 6; break; }
        { Scores[x] = 0; return; }

      case 7:
        if (A > Ip) { Scores[x] = 0; return; }
        if (A < Im) { Scores[x] = 0; return; }
        B1 = B2; b++; B2 = I[x + dirs[b]];
        // A ~ I0
        if (B2 > Ip) { score -= A + B1; state = 3; break; }
        if (B2 < Im) { score -= A + B1; state = 6; break; }
        { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0

      case 6:
        if (A > Ip) { Scores[x] = 0; return; }
        if (A < Im) { Scores[x] = 0; return; }
        B1 = B2; b++; B2 = I[x + dirs[b]];
        // A ~ I0
        if (B2 < Im) { score -= A + B1; state = 2; break; }
        if (B2 > Ip) { score -= A + B1; state = 7; break; }
        { Scores[x] = 0; return; } // A ~ I0, B2 ~ I0

      case 8:
        if (A > Ip) {
          if (B2 < Im) { Scores[x] = 0; return; }
          B1 = B2; b++; B2 = I[x + dirs[b]];
          if (B2 < Im) { Scores[x] = 0; return; }
          { score -= A + B1; state = 9; break; }
        }
        if (A < Im) {
          B1 = B2; b++; B2 = I[x + dirs[b]];
          if (B2 > Ip) { Scores[x] = 0; return; }
          { score -= A + B1; state = 1; break; }
        }
        { Scores[x] = 0; return; }

      case 9:
        if (A < Im) {
          if (B2 > Ip) { Scores[x] = 0; return; }
          B1 = B2; b++; B2 = I[x + dirs[b]];
          if (B2 > Ip) { Scores[x] = 0; return; }
          { score -= A + B1; state = 8; break; }
        }
        if (A > Ip) {
          B1 = B2; b++; B2 = I[x + dirs[b]];
          if (B2 < Im) { Scores[x] = 0; return; }
          { score -= A + B1; state = 0; break; }
        }
        { Scores[x] = 0; return; }

      default:
        //"PB default";
        break;
    } // switch(state)
  } // for(a...)

  Scores[x] = (score + dirs_nb * I[x]);
}

// ---------------------------------------------------------------------------
// Level table
// ---------------------------------------------------------------------------

class LevTable {
  dirs: Int32Array;
  dirs_count: number;
  scores: Int32Array;
  radius: number;

  constructor(w: number, h: number, r: number) {
    this.dirs = new Int32Array(1024);
    this.dirs_count = precompute_directions(w, this.dirs, r) | 0;
    this.scores = new Int32Array(w * h);
    this.radius = r | 0;
  }
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let _level_tables: LevTable[] = [];
let _tau = 7;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize YAPE detector tables.
 *
 * @param width         Image width.
 * @param height        Image height.
 * @param radius        Circle radius (clamped to [3, 7]).
 * @param pyramidLevels Number of pyramid levels (default 1).
 */
export function yapeInit(
  width: number,
  height: number,
  radius: number,
  pyramidLevels: number = 1,
): void {
  radius = Math.min(radius, 7);
  radius = Math.max(radius, 3);
  _level_tables = [];
  for (let i = 0; i < pyramidLevels; ++i) {
    _level_tables[i] = new LevTable(width >> i, height >> i, radius);
  }
}

/**
 * Set the tau (threshold) value for YAPE detection.
 */
export function yapeSetTau(tau: number): void {
  _tau = tau;
}

/**
 * Detect YAPE keypoints in a single-channel image.
 *
 * You must call `yapeInit` before calling this function.
 *
 * @param src     Source Matrix (U8C1).
 * @param points  Pre-allocated array of Keypoint objects.
 * @param border  Border to skip (default 4).
 * @returns Number of detected keypoints.
 */
export function yapeDetect(src: Matrix, points: Keypoint[], border: number = 4): number {
  const t = _level_tables[0];
  const R = t.radius | 0, Rm1 = (R - 1) | 0;
  const dirs = t.dirs;
  const dirs_count = t.dirs_count | 0;
  const opposite = dirs_count >> 1;
  const img = src.data, w = src.cols | 0, h = src.rows | 0, hw = w >> 1;
  const scores = t.scores;
  let x = 0, y = 0, row = 0, rowx = 0, ip = 0, im = 0, abs_score = 0, score = 0;
  const tau = _tau | 0;
  let number_of_points = 0, pt: Keypoint;

  const sx = Math.max(R + 1, border) | 0;
  const sy = Math.max(R + 1, border) | 0;
  const ex = Math.min(w - R - 2, w - border) | 0;
  const ey = Math.min(h - R - 2, h - border) | 0;

  row = (sy * w + sx) | 0;
  for (y = sy; y < ey; ++y, row += w) {
    for (x = sx, rowx = row; x < ex; ++x, ++rowx) {
      ip = img[rowx] + tau; im = img[rowx] - tau;

      if (im < img[rowx + R] && img[rowx + R] < ip && im < img[rowx - R] && img[rowx - R] < ip) {
        scores[rowx] = 0;
      } else {
        perform_one_point(img, rowx, scores, im, ip, dirs, opposite, dirs_count);
      }
    }
  }

  // local maxima
  row = (sy * w + sx) | 0;
  for (y = sy; y < ey; ++y, row += w) {
    for (x = sx, rowx = row; x < ex; ++x, ++rowx) {
      score = scores[rowx];
      abs_score = Math.abs(score);
      if (abs_score < 5) {
        // if this pixel is 0, the next one will not be good enough. Skip it.
        ++x; ++rowx;
      } else {
        if (third_check(scores, rowx, w) >= 3 && is_local_maxima(scores, rowx, score, hw, R)) {
          pt = points[number_of_points];
          pt.x = x; pt.y = y; pt.score = abs_score;
          ++number_of_points;

          x += Rm1; rowx += Rm1;
        }
      }
    }
  }

  return number_of_points;
}
