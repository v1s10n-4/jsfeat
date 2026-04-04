/**
 * Keypoint -- a detected interest-point with position, score, level, and angle.
 *
 * Ported from `keypoint_t` in legacy/jsfeat_struct.js (lines 168-183).
 */

/**
 * Represents a detected interest point in an image.
 *
 * Used by feature detectors (FAST, YAPE, ORB) and the optical flow tracker.
 */
export class Keypoint {
  /** Horizontal pixel coordinate. */
  x: number;
  /** Vertical pixel coordinate. */
  y: number;
  /** Detection score / response strength. */
  score: number;
  /** Pyramid level at which this keypoint was detected. */
  level: number;
  /** Orientation angle in radians (-1 if uncomputed). */
  angle: number;

  /**
   * Create a new Keypoint.
   *
   * @param x - Horizontal pixel coordinate (default 0).
   * @param y - Vertical pixel coordinate (default 0).
   * @param score - Detection score (default 0).
   * @param level - Pyramid level (default 0).
   * @param angle - Orientation angle in radians (default -1.0, meaning uncomputed).
   */
  constructor(
    x = 0,
    y = 0,
    score = 0,
    level = 0,
    angle = -1.0,
  ) {
    this.x     = x;
    this.y     = y;
    this.score = score;
    this.level = level;
    this.angle = angle;
  }
}
