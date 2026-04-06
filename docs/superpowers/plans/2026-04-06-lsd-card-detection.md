# LSD Card Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Line Segment Detector (LSD) as a fallback card detector that finds card edges via gradient orientation, breaking through the 37/48 detection ceiling.

**Architecture:** New `detectLineSegments()` function in `src/imgproc/lsd.ts` uses Scharr gradient orientation to grow line-support regions and fit line segments. A `findCardQuadrilateral()` helper groups segments into rectangles. Both integrate as a fallback in `demo/src/lib/demos.ts` after the morph blob detection fails.

**Tech Stack:** Pure TypeScript, jsfeat Matrix/pool system, existing Scharr derivatives.

---

### Task 1: Create LSD core — `detectLineSegments()` function

**Files:**
- Create: `src/imgproc/lsd.ts`

This is the core LSD algorithm. It takes a Scharr gradient matrix (S32C2 with interleaved [gx, gy] pairs) and returns an array of detected line segments.

- [ ] **Step 1: Create the file with types and function signature**

```typescript
// src/imgproc/lsd.ts

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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/konect/WebstormProjects/jsfeat && npx tsc --noEmit`
Expected: No errors (the file is standalone, no imports needed from jsfeat internals).

- [ ] **Step 3: Commit**

```bash
git add src/imgproc/lsd.ts
git commit -m "feat(imgproc): add Line Segment Detector (LSD) core algorithm

Implements detectLineSegments() which finds line segments by growing
regions of consistent gradient orientation from Scharr derivatives.
Works on gradient direction rather than magnitude, enabling detection
of low-contrast edges (dark card on dark wood)."
```

---

### Task 2: Export LSD from imgproc module

**Files:**
- Modify: `src/imgproc/index.ts`

- [ ] **Step 1: Add exports for LSD types and function**

Add these lines to `src/imgproc/index.ts`:

```typescript
export { detectLineSegments } from './lsd';
export type { LineSegment } from './lsd';
```

Add them after the existing exports from `'./imgproc'`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/konect/WebstormProjects/jsfeat && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/imgproc/index.ts
git commit -m "feat(imgproc): export detectLineSegments and LineSegment type"
```

---

### Task 3: Add quadrilateral grouping helper to demos.ts

**Files:**
- Modify: `demo/src/lib/demos.ts`

This adds a `findCardQuadrilateral()` helper function that takes line segments and finds the best card-shaped rectangle. Place it BEFORE the `cardDetectionDemo` definition (around line 2080).

- [ ] **Step 1: Add the import for detectLineSegments**

At the top of `demo/src/lib/demos.ts`, add `detectLineSegments` to the jsfeat/imgproc import:

```typescript
import {
  grayscale as jfGrayscale,
  boxBlurGray,
  gaussianBlur,
  pyrDown,
  equalizeHistogram,
  cannyEdges,
  sobelDerivatives,
  scharrDerivatives,
  warpAffine,
  findContours,
  approxPoly,
  adaptiveThreshold,
  AdaptiveMethod,
  detectLineSegments,  // ADD THIS
} from 'jsfeat/imgproc';
```

Also add the type import if not already present:

```typescript
import type { LineSegment } from 'jsfeat/imgproc';  // ADD THIS
```

- [ ] **Step 2: Add the findCardQuadrilateral helper function**

Insert this function BEFORE the `cardDetectionDemo` definition (around line 2080, after the `buildCardCorners` and `sortCorners` helper functions):

```typescript
// ---------------------------------------------------------------------------
// LSD-based card quadrilateral detection
// ---------------------------------------------------------------------------

/**
 * Find the best card-shaped quadrilateral from line segments.
 * Groups segments by angle into 2 perpendicular sets, then finds the
 * best 4-line combination forming a rectangle with card-like aspect ratio.
 *
 * @returns 4 sorted corners or null if no valid quadrilateral found.
 */
function findCardQuadrilateral(
  segments: LineSegment[],
  w: number,
  h: number,
): { x: number; y: number }[] | null {
  if (segments.length < 4) return null;

  const minArea = w * h * 0.03;
  const maxArea = w * h * 0.4;
  const margin = 10; // corners must be this far from image edges

  // --- 1. Group segments by angle (0-180°) ---
  interface AngleGroup {
    segments: LineSegment[];
    meanAngle: number;
    totalLength: number;
  }

  const groups: AngleGroup[] = [];
  const ANGLE_GROUP_TOL = (15 * Math.PI) / 180; // 15 degrees

  for (const seg of segments) {
    let placed = false;
    for (const g of groups) {
      let diff = Math.abs(seg.angle - g.meanAngle);
      if (diff > Math.PI / 2) diff = Math.PI - diff;
      if (diff < ANGLE_GROUP_TOL) {
        g.segments.push(seg);
        g.totalLength += seg.length;
        // Update mean angle (circular mean approximation)
        let sum = 0;
        for (const s of g.segments) sum += s.angle;
        g.meanAngle = sum / g.segments.length;
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push({
        segments: [seg],
        meanAngle: seg.angle,
        totalLength: seg.length,
      });
    }
  }

  // Sort groups by total line length descending
  groups.sort((a, b) => b.totalLength - a.totalLength);

  // --- 2. Find two largest roughly-perpendicular groups ---
  let group1: AngleGroup | null = null;
  let group2: AngleGroup | null = null;

  for (let i = 0; i < groups.length && !group2; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      let angleDiff = Math.abs(groups[i].meanAngle - groups[j].meanAngle);
      if (angleDiff > Math.PI / 2) angleDiff = Math.PI - angleDiff;
      // Roughly perpendicular: 70°-110°
      const perpDiff = Math.abs(angleDiff - Math.PI / 2);
      if (perpDiff < (20 * Math.PI) / 180) {
        group1 = groups[i];
        group2 = groups[j];
        break;
      }
    }
  }

  if (!group1 || !group2) return null;

  // Take top N longest segments from each group
  const MAX_PER_GROUP = 15;
  const lines1 = group1.segments.slice(0, MAX_PER_GROUP);
  const lines2 = group2.segments.slice(0, MAX_PER_GROUP);

  if (lines1.length < 2 || lines2.length < 2) return null;

  // --- 3. Try all 2-from-group1 × 2-from-group2 combinations ---
  let bestScore = 0;
  let bestCorners: { x: number; y: number }[] | null = null;

  for (let a = 0; a < lines1.length; a++) {
    for (let b = a + 1; b < lines1.length; b++) {
      for (let c = 0; c < lines2.length; c++) {
        for (let d = c + 1; d < lines2.length; d++) {
          const fourLines = [lines1[a], lines1[b], lines2[c], lines2[d]];

          // Compute all 4 intersections: each line from group1 with each from group2
          const corners: { x: number; y: number }[] = [];
          for (const la of [lines1[a], lines1[b]]) {
            for (const lb of [lines2[c], lines2[d]]) {
              const pt = intersectSegmentLines(la, lb);
              if (!pt) break;
              corners.push(pt);
            }
            if (corners.length < (corners.length === 2 ? 2 : 0)) break;
          }

          if (corners.length !== 4) continue;

          // Check all corners inside image with margin
          let inBounds = true;
          for (const c2 of corners) {
            if (c2.x < margin || c2.y < margin || c2.x >= w - margin || c2.y >= h - margin) {
              inBounds = false;
              break;
            }
          }
          if (!inBounds) continue;

          // Sort corners for consistent ordering
          const sorted = sortCorners(corners);

          // Check convexity
          if (!isConvexQuad(sorted)) continue;

          // Compute area
          const area = quadArea(sorted);
          if (area < minArea || area > maxArea) continue;

          // Compute aspect ratio
          const sides: number[] = [];
          for (let si = 0; si < 4; si++) {
            const sa = sorted[si], sb = sorted[(si + 1) % 4];
            sides.push(Math.sqrt((sb.x - sa.x) ** 2 + (sb.y - sa.y) ** 2));
          }
          const minSide = Math.min(...sides), maxSide = Math.max(...sides);
          if (minSide < maxSide * 0.15) continue; // too degenerate

          const aspect = Math.min(
            (sides[0] + sides[2]) / 2,
            (sides[1] + sides[3]) / 2,
          ) / Math.max(
            (sides[0] + sides[2]) / 2,
            (sides[1] + sides[3]) / 2,
          );
          const aspectMatch = 1 - Math.abs(aspect - 5 / 7) * 3;
          if (aspectMatch < -0.5) continue; // very far from card ratio

          // Score: area × aspect match × total line coverage
          const totalLen = fourLines.reduce((s2, l) => s2 + l.length, 0);
          const score = area * Math.max(0.1, aspectMatch) * totalLen;

          if (score > bestScore) {
            bestScore = score;
            bestCorners = sorted;
          }
        }
      }
    }
  }

  return bestCorners;
}

/** Intersect two lines defined by segment endpoints. */
function intersectSegmentLines(
  s1: LineSegment,
  s2: LineSegment,
): { x: number; y: number } | null {
  const d1x = s1.x2 - s1.x1, d1y = s1.y2 - s1.y1;
  const d2x = s2.x2 - s2.x1, d2y = s2.y2 - s2.y1;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-6) return null; // parallel
  const dx = s2.x1 - s1.x1, dy = s2.y1 - s1.y1;
  const t = (dx * d2y - dy * d2x) / cross;
  return { x: s1.x1 + t * d1x, y: s1.y1 + t * d1y };
}

/** Check if 4 sorted points form a convex quadrilateral. */
function isConvexQuad(pts: { x: number; y: number }[]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4], c = pts[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (sign === 0) sign = cross > 0 ? 1 : -1;
    else if ((cross > 0 ? 1 : -1) !== sign) return false;
  }
  return true;
}

/** Compute area of a quadrilateral using shoelace formula. */
function quadArea(pts: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/konect/WebstormProjects/jsfeat && cd demo && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add demo/src/lib/demos.ts
git commit -m "feat(demo): add LSD quadrilateral grouping helpers

Adds findCardQuadrilateral(), intersectSegmentLines(), isConvexQuad(),
and quadArea() helper functions for grouping LSD line segments into
card-shaped rectangles."
```

---

### Task 4: Integrate LSD fallback into card detection pipeline

**Files:**
- Modify: `demo/src/lib/demos.ts`

Insert the LSD fallback code right after `profiler.end('contour');` and before the "Refine quad" section. This code only runs when `detected` is false.

- [ ] **Step 1: Add the LSD fallback block**

Find the line `profiler.end('contour');` (around line 2429). Immediately after it, insert:

```typescript
    // -----------------------------------------------------------------------
    // FALLBACK: LSD line segment detection when morph blob contour fails
    // -----------------------------------------------------------------------
    if (!detected) {
      // Recompute Scharr on the blurred grayscale (may have been overwritten by color passes)
      scharrDerivatives(_cardBlurred!, _cardScharr!);

      const lsdSegments = detectLineSegments(_cardScharr!, 40, 5);

      const lsdCorners = findCardQuadrilateral(lsdSegments, w, h);
      if (lsdCorners) {
        detected = true;
        cardCorners = lsdCorners;
        _cardDebugInfo = `LSD segs=${lsdSegments.length}`;
      }
    }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/konect/WebstormProjects/jsfeat && cd demo && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Verify the workbench loads without errors**

Open the Detection Debug Workbench at `/#/dev`. Check browser console for any runtime errors. The pipeline should work exactly as before for passing images (LSD fallback never fires for them).

- [ ] **Step 4: Run All at 50px threshold**

Click "Run All" in the workbench. Verify:
- Baseline: at least 37/48 (must not regress)
- Target: 38+ (any improvement from LSD fallback)

- [ ] **Step 5: Commit**

```bash
git add demo/src/lib/demos.ts
git commit -m "feat(demo): integrate LSD fallback into card detection pipeline

When morph blob detection finds no card, falls back to LSD line segment
detection. Reuses existing Scharr derivatives, groups segments into
perpendicular line pairs, and finds card-shaped quadrilaterals.

Only fires for the 11 previously-failing images — zero cost for the
37 already-passing images."
```

---

### Task 5: Tune LSD parameters for failing test images

**Files:**
- Modify: `src/imgproc/lsd.ts` (if needed)
- Modify: `demo/src/lib/demos.ts` (if needed)

This task is iterative — use the workbench to test failing images individually, then adjust parameters.

- [ ] **Step 1: Test LSD on specific failing images**

Navigate to each previously-failing image (Photo-25, 26, 27, 30, 31, 33, 34, 35) and click "Retest". Note the detection result and accuracy for each.

Key parameters to tune if needed:
- `minLength` (currently 40) — lower to 20-30 if card edges are short
- `magnitudeThreshold` (currently 5) — lower to 2-3 if dark-on-dark edges are missed
- `ANGLE_TOL` in LSD (currently PI/8 = 22.5°) — widen to PI/6 (30°) for curved edges
- `ANGLE_GROUP_TOL` in grouping (currently 15°) — widen to 20° if card sides don't group
- `MAX_PER_GROUP` (currently 15) — increase if too many good segments are dropped

- [ ] **Step 2: Apply parameter adjustments**

Based on testing, update the relevant constants. Each change should be tested with "Run All" to verify no regressions.

- [ ] **Step 3: Commit final tuned parameters**

```bash
git add src/imgproc/lsd.ts demo/src/lib/demos.ts
git commit -m "feat(detection): tune LSD parameters for wood-bg test images

Adjusted [describe changes] based on individual image testing.
Score: XX/48 (up from 37/48)."
```
