/**
 * Pyramid -- a multi-scale image pyramid.
 *
 * Ported from `pyramid_t` in legacy/jsfeat_struct.js (lines 131-166).
 */

import { Matrix } from './matrix';

/**
 * A multi-scale image pyramid where each level is half the resolution
 * of the previous one.
 *
 * Used by the Lucas-Kanade optical flow tracker and BBF detector.
 */
export class Pyramid {
  /** Number of pyramid levels. */
  levels: number;
  /** Array of Matrix instances, one per level. */
  data: Matrix[];
  /**
   * Down-sampling function. Initially `null`; set to `imgproc.pyrDown`
   * once the imgproc module is loaded.
   */
  pyrdown: ((src: Matrix, dst: Matrix) => void) | null;

  /**
   * Create a new Pyramid.
   *
   * @param levels - Number of pyramid levels.
   */
  constructor(levels: number) {
    this.levels  = levels | 0;
    this.data    = new Array<Matrix>(levels);
    this.pyrdown = null;
  }

  /**
   * Allocate a Matrix for every level. Level 0 has the original
   * dimensions; each subsequent level halves via right-shift.
   *
   * @param startW - Width at level 0.
   * @param startH - Height at level 0.
   * @param dataType - Composite type for each level's Matrix.
   */
  allocate(startW: number, startH: number, dataType: number): void {
    let i = this.levels;
    while (--i >= 0) {
      this.data[i] = new Matrix(startW >> i, startH >> i, dataType);
    }
  }

  /**
   * Build the pyramid from an input image by successive down-sampling.
   *
   * The `pyrdown` callback must be set before calling this method
   * (typically to `imgproc.pyrDown`).
   *
   * @param input - Source image (must match level-0 dimensions).
   * @param skipFirstLevel - If true (default), level 0 keeps its existing
   *   data; otherwise the input is copied into it.
   */
  build(input: Matrix, skipFirstLevel = true): void {
    let a: Matrix = input;
    const b0 = this.data[0];

    if (!skipFirstLevel) {
      const j = input.cols * input.rows;
      for (let k = j - 1; k >= 0; --k) {
        b0.data[k] = input.data[k];
      }
    }

    let b = this.data[1];
    this.pyrdown!(a, b);

    for (let i = 2; i < this.levels; ++i) {
      a = b;
      b = this.data[i];
      this.pyrdown!(a, b);
    }
  }
}
