/**
 * Keypoint -- a detected interest-point with position, score, level, and angle.
 *
 * Ported from `keypoint_t` in legacy/jsfeat_struct.js (lines 168-183).
 */

export class Keypoint {
  x: number;
  y: number;
  score: number;
  level: number;
  angle: number;

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
