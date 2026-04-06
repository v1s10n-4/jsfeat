/**
 * Simplified Line Segment Detector (LSD).
 *
 * Finds line segments by growing regions of consistent gradient orientation.
 * Unlike Canny which needs strong gradient *magnitude*, LSD detects edges
 * where neighboring pixels share a consistent gradient *direction* — even
 * at very low contrast (e.g. dark card on dark wood).
 *
 * Based on: "LSD: a Line Segment Detector" (Grompone von Gioi et al., IPOL 2012).
 * This is a simplified version: no multi-scale, no NFA log-gamma, no iterative
 * rectangle refinement. Sufficient for detecting straight card borders.
 */

/** A detected line segment with endpoints and metadata. */
export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Length of the segment in pixels. */
  length: number;
  /** Angle of the segment in radians [0, PI). */
  angle: number;
  /** Width of the line-support region. */
  width: number;
}

/**
 * Detect line segments from a Scharr gradient field.
 *
 * @param gradients - S32C2 Matrix from `scharrDerivatives` with interleaved [gx, gy].
 * @param minLength - Minimum segment length in pixels (default 30).
 * @param magnitudeThreshold - Skip pixels with gradient magnitude below this (default 5).
 *                             Flat regions have random orientations; this filters them.
 * @returns Array of detected line segments, sorted by length descending.
 */
export function detectLineSegments(
  gradients: { data: Int32Array | Float32Array; cols: number; rows: number },
  minLength: number = 30,
  magnitudeThreshold: number = 5,
): LineSegment[] {
  const w = gradients.cols;
  const h = gradients.rows;
  const gdata = gradients.data;
  const n = w * h;

  // --- 1. Compute per-pixel magnitude and angle ---
  const magnitude = new Float32Array(n);
  const angle = new Float32Array(n);
  let maxMag = 0;
  for (let i = 0; i < n; i++) {
    const gx = gdata[i * 2];
    const gy = gdata[i * 2 + 1];
    const mag = Math.sqrt(gx * gx + gy * gy);
    magnitude[i] = mag;
    // Gradient angle (perpendicular to edge direction)
    angle[i] = Math.atan2(gy, gx);
    if (mag > maxMag) maxMag = mag;
  }

  // --- 2. Pseudo-sort pixels by magnitude (descending) using bucket sort ---
  const BUCKETS = 1024;
  const bucketList: number[][] = [];
  for (let b = 0; b < BUCKETS; b++) bucketList.push([]);
  for (let i = 0; i < n; i++) {
    if (magnitude[i] < magnitudeThreshold) continue;
    const bucket = Math.min(BUCKETS - 1, ((magnitude[i] / maxMag) * (BUCKETS - 1)) | 0);
    bucketList[bucket].push(i);
  }

  // Build ordered list from highest to lowest magnitude
  const ordered: number[] = [];
  for (let b = BUCKETS - 1; b >= 0; b--) {
    const bk = bucketList[b];
    for (let j = 0; j < bk.length; j++) ordered.push(bk[j]);
  }

  // --- 3. Region growing ---
  const ANGLE_TOL = Math.PI / 8; // ±22.5°
  const used = new Uint8Array(n);
  const segments: LineSegment[] = [];

  for (let oi = 0; oi < ordered.length; oi++) {
    const seed = ordered[oi];
    if (used[seed]) continue;

    // Grow region from seed
    const regionAngle = angle[seed];
    const region: number[] = [seed];
    used[seed] = 1;

    const stack: number[] = [seed];
    while (stack.length > 0) {
      const px = stack.pop()!;
      const x = px % w;
      const y = (px / w) | 0;

      // 8-connected neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const ni = ny * w + nx;
          if (used[ni]) continue;
          if (magnitude[ni] < magnitudeThreshold) continue;

          // Check angle agreement with region mean
          let adiff = Math.abs(angle[ni] - regionAngle);
          if (adiff > Math.PI) adiff = 2 * Math.PI - adiff;
          if (adiff < ANGLE_TOL) {
            used[ni] = 1;
            region.push(ni);
            stack.push(ni);
          }
        }
      }
    }

    // Skip tiny regions
    if (region.length < minLength) continue;

    // --- 4. Fit rectangle to region ---
    // Compute centroid
    let cx = 0, cy = 0;
    for (let ri = 0; ri < region.length; ri++) {
      cx += region[ri] % w;
      cy += (region[ri] / w) | 0;
    }
    cx /= region.length;
    cy /= region.length;

    // Compute principal axis via covariance matrix
    let cxx = 0, cyy = 0, cxy = 0;
    for (let ri = 0; ri < region.length; ri++) {
      const rx = (region[ri] % w) - cx;
      const ry = ((region[ri] / w) | 0) - cy;
      cxx += rx * rx;
      cyy += ry * ry;
      cxy += rx * ry;
    }

    // Eigenvalue decomposition for 2x2 covariance
    const trace = cxx + cyy;
    const det = cxx * cyy - cxy * cxy;
    const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det));
    const lambda1 = trace / 2 + disc;
    const lambda2 = trace / 2 - disc;

    // Principal direction (eigenvector of largest eigenvalue)
    let dirX: number, dirY: number;
    if (Math.abs(cxy) > 1e-6) {
      dirX = lambda1 - cyy;
      dirY = cxy;
    } else {
      dirX = cxx >= cyy ? 1 : 0;
      dirY = cxx >= cyy ? 0 : 1;
    }
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    dirX /= dirLen;
    dirY /= dirLen;

    // Project all region points onto principal axis
    let minProj = Infinity, maxProj = -Infinity;
    let maxPerp = 0;
    for (let ri = 0; ri < region.length; ri++) {
      const rx = (region[ri] % w) - cx;
      const ry = ((region[ri] / w) | 0) - cy;
      const proj = rx * dirX + ry * dirY;
      const perp = Math.abs(rx * (-dirY) + ry * dirX);
      if (proj < minProj) minProj = proj;
      if (proj > maxProj) maxProj = proj;
      if (perp > maxPerp) maxPerp = perp;
    }

    const segLength = maxProj - minProj;
    const segWidth = maxPerp * 2;

    // Validate: long enough, not too fat
    if (segLength < minLength) continue;
    if (segWidth > segLength * 0.5) continue; // reject blob-like regions

    // Compute endpoints
    const x1 = cx + dirX * minProj;
    const y1 = cy + dirY * minProj;
    const x2 = cx + dirX * maxProj;
    const y2 = cy + dirY * maxProj;

    // Compute segment angle [0, PI)
    let segAngle = Math.atan2(dirY, dirX);
    if (segAngle < 0) segAngle += Math.PI;

    segments.push({
      x1, y1, x2, y2,
      length: segLength,
      angle: segAngle,
      width: segWidth,
    });
  }

  // Sort by length descending
  segments.sort((a, b) => b.length - a.length);

  return segments;
}
