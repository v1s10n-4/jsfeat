# imgproc New Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `adaptiveThreshold`, `warpPerspective`, and `findContours` (+ `approxPoly`) to the jsfeat core library with full tests and TSDoc.

**Architecture:** All functions are added to `src/imgproc/imgproc.ts` following existing conventions (src/dst Matrix, void return, BufferPool temps, pointer arithmetic). Tests follow existing patterns in `test/imgproc/imgproc.test.ts`. Each function is independent — no cross-dependencies between the three.

**Tech Stack:** TypeScript, Vitest, jsfeat core (Matrix, DataType, BufferPool)

**Spec:** `docs/superpowers/specs/2026-04-05-imgproc-new-features-design.md`

---

### Task 1: adaptiveThreshold

**Files:**
- Modify: `src/imgproc/imgproc.ts`
- Modify: `src/imgproc/index.ts`
- Modify: `test/imgproc/imgproc.test.ts`

The simplest of the three — builds on existing `boxBlurGray` and `gaussianBlur`.

- [ ] **Step 1: Write failing tests**

Add to `test/imgproc/imgproc.test.ts`:

```typescript
import { adaptiveThreshold, AdaptiveMethod } from '../../src/imgproc/imgproc';

describe('adaptiveThreshold', () => {
  it('sets all pixels to maxValue for uniform bright image', () => {
    const src = new Matrix(16, 16, U8C1);
    src.data.fill(200);
    const dst = new Matrix(16, 16, U8C1);
    adaptiveThreshold(src, dst, 255, AdaptiveMethod.MEAN, 5, 5);
    // All pixels are above local mean - constant, so all should be 255
    // (uniform image: mean = 200, 200 > 200 - 5 = 195 → true → 255)
    for (let i = 0; i < 256; i++) {
      expect(dst.data[i]).toBe(255);
    }
  });

  it('sets all pixels to 0 for uniform dark image with positive constant', () => {
    const src = new Matrix(16, 16, U8C1);
    src.data.fill(10);
    const dst = new Matrix(16, 16, U8C1);
    // constant = -20 means threshold = mean + 20 = 30, and 10 < 30 → 0
    adaptiveThreshold(src, dst, 255, AdaptiveMethod.MEAN, 5, -20);
    for (let i = 0; i < 256; i++) {
      expect(dst.data[i]).toBe(0);
    }
  });

  it('segments a bimodal image with MEAN method', () => {
    const src = new Matrix(32, 32, U8C1);
    // Left half bright (200), right half dark (50)
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        src.data[y * 32 + x] = x < 16 ? 200 : 50;
      }
    }
    const dst = new Matrix(32, 32, U8C1);
    adaptiveThreshold(src, dst, 255, AdaptiveMethod.MEAN, 7, 10);
    // Interior bright pixels should be 255, interior dark pixels should be 0
    expect(dst.data[8 * 32 + 4]).toBe(255);   // bright region interior
    expect(dst.data[8 * 32 + 28]).toBe(0);     // dark region interior
  });

  it('works with GAUSSIAN method', () => {
    const src = new Matrix(16, 16, U8C1);
    src.data.fill(128);
    const dst = new Matrix(16, 16, U8C1);
    adaptiveThreshold(src, dst, 255, AdaptiveMethod.GAUSSIAN, 5, 5);
    // Uniform → all above mean-constant → all 255
    for (let i = 0; i < 256; i++) {
      expect(dst.data[i]).toBe(255);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/imgproc/imgproc.test.ts`
Expected: FAIL — `adaptiveThreshold` and `AdaptiveMethod` not found.

- [ ] **Step 3: Implement adaptiveThreshold**

Add to `src/imgproc/imgproc.ts`:

```typescript
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
 * For each pixel, computes a local mean over a blockSize×blockSize neighborhood
 * and thresholds: dst[i] = (src[i] > localMean - constant) ? maxValue : 0.
 *
 * @param src - Input grayscale image (U8C1)
 * @param dst - Output binary image (U8C1)
 * @param maxValue - Value assigned to pixels passing the threshold (typically 255)
 * @param method - AdaptiveMethod.MEAN or AdaptiveMethod.GAUSSIAN
 * @param blockSize - Size of local neighborhood (must be odd, >= 3)
 * @param constant - Value subtracted from local mean before comparison
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
```

Note: This allocates a `new Matrix` instead of using the pool because `boxBlurGray` and `gaussianBlur` expect Matrix parameters. This is acceptable for the local mean buffer.

- [ ] **Step 4: Export from index.ts**

Add to `src/imgproc/index.ts`:
```typescript
export { adaptiveThreshold, AdaptiveMethod } from './imgproc';
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/imgproc/imgproc.test.ts`
Expected: All pass including new adaptiveThreshold tests.

- [ ] **Step 6: Commit**

```bash
git add src/imgproc/ test/imgproc/
git commit -m "feat(imgproc): add adaptiveThreshold with MEAN and GAUSSIAN methods"
```

---

### Task 2: warpPerspective

**Files:**
- Modify: `src/imgproc/imgproc.ts`
- Modify: `src/imgproc/index.ts`
- Modify: `test/imgproc/imgproc.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `test/imgproc/imgproc.test.ts`:

```typescript
import { warpPerspective } from '../../src/imgproc/imgproc';

describe('warpPerspective', () => {
  it('identity transform preserves image', () => {
    const src = new Matrix(8, 8, U8C1);
    for (let i = 0; i < 64; i++) src.data[i] = i * 4;
    const dst = new Matrix(8, 8, U8C1);
    const H = new Matrix(3, 3, F32C1);
    // Identity: [[1,0,0],[0,1,0],[0,0,1]]
    H.data[0] = 1; H.data[1] = 0; H.data[2] = 0;
    H.data[3] = 0; H.data[4] = 1; H.data[5] = 0;
    H.data[6] = 0; H.data[7] = 0; H.data[8] = 1;
    warpPerspective(src, dst, H);
    for (let i = 0; i < 64; i++) {
      expect(Math.abs(dst.data[i] - src.data[i])).toBeLessThanOrEqual(1);
    }
  });

  it('translation shifts pixels', () => {
    const src = new Matrix(16, 16, U8C1);
    src.data.fill(0);
    // Draw a 4x4 white square at (2,2)
    for (let y = 2; y < 6; y++)
      for (let x = 2; x < 6; x++)
        src.data[y * 16 + x] = 255;
    const dst = new Matrix(16, 16, U8C1);
    const H = new Matrix(3, 3, F32C1);
    // Translate by (3, 2): H = [[1,0,3],[0,1,2],[0,0,1]]
    H.data[0] = 1; H.data[1] = 0; H.data[2] = 3;
    H.data[3] = 0; H.data[4] = 1; H.data[5] = 2;
    H.data[6] = 0; H.data[7] = 0; H.data[8] = 1;
    warpPerspective(src, dst, H);
    // Square should now be at (5,4)
    expect(dst.data[6 * 16 + 7]).toBe(255);  // inside shifted square
    expect(dst.data[2 * 16 + 2]).toBe(0);    // original position now empty
  });

  it('fills out-of-bounds with fillValue', () => {
    const src = new Matrix(4, 4, U8C1);
    src.data.fill(100);
    const dst = new Matrix(4, 4, U8C1);
    const H = new Matrix(3, 3, F32C1);
    // Large translation — everything out of bounds
    H.data[0] = 1; H.data[1] = 0; H.data[2] = 100;
    H.data[3] = 0; H.data[4] = 1; H.data[5] = 100;
    H.data[6] = 0; H.data[7] = 0; H.data[8] = 1;
    warpPerspective(src, dst, H, 42);
    for (let i = 0; i < 16; i++) {
      expect(dst.data[i]).toBe(42);
    }
  });

  it('matches warpAffine for affine transforms', () => {
    const src = new Matrix(16, 16, U8C1);
    for (let i = 0; i < 256; i++) src.data[i] = (i * 7) & 255;
    const dstA = new Matrix(16, 16, U8C1);
    const dstP = new Matrix(16, 16, U8C1);
    // 2x3 affine: scale by 0.5
    const A = new Matrix(3, 3, F32C1);
    A.data[0] = 0.5; A.data[1] = 0; A.data[2] = 0;
    A.data[3] = 0; A.data[4] = 0.5; A.data[5] = 0;
    A.data[6] = 0; A.data[7] = 0; A.data[8] = 0;
    warpAffine(src, dstA, A, 0);
    // Same as 3x3 homography with H[8]=1
    const H = new Matrix(3, 3, F32C1);
    H.data[0] = 0.5; H.data[1] = 0; H.data[2] = 0;
    H.data[3] = 0; H.data[4] = 0.5; H.data[5] = 0;
    H.data[6] = 0; H.data[7] = 0; H.data[8] = 1;
    warpPerspective(src, dstP, H, 0);
    for (let i = 0; i < 256; i++) {
      expect(Math.abs(dstA.data[i] - dstP.data[i])).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/imgproc/imgproc.test.ts`
Expected: FAIL — `warpPerspective` not exported.

- [ ] **Step 3: Implement warpPerspective**

Add to `src/imgproc/imgproc.ts`:

```typescript
/**
 * Warp an image using a 3×3 perspective (homography) transform.
 *
 * Supports single and multi-channel images. Uses backward mapping with
 * bilinear interpolation for sub-pixel accuracy.
 *
 * @param src - Source image (any type/channels)
 * @param dst - Destination image (pre-allocated with desired output dimensions)
 * @param transform - 3×3 homography matrix (F32C1 or F64C1). Maps source → destination.
 * @param fillValue - Value for out-of-bounds pixels (default: 0)
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
        // Degenerate — fill
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
          // Single channel — optimized scalar path
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
```

- [ ] **Step 4: Export from index.ts**

Add to `src/imgproc/index.ts`:
```typescript
export { warpPerspective } from './imgproc';
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/imgproc/imgproc.test.ts`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/imgproc/ test/imgproc/
git commit -m "feat(imgproc): add warpPerspective with multi-channel bilinear interpolation"
```

---

### Task 3: findContours & approxPoly

**Files:**
- Modify: `src/imgproc/imgproc.ts`
- Modify: `src/imgproc/index.ts`
- Modify: `test/imgproc/imgproc.test.ts`

The most complex of the three. Implements border-following contour tracing.

- [ ] **Step 1: Write failing tests**

Add to `test/imgproc/imgproc.test.ts`:

```typescript
import { findContours, approxPoly, ContourMode } from '../../src/imgproc/imgproc';

describe('findContours', () => {
  it('returns empty array for blank image', () => {
    const src = new Matrix(16, 16, U8C1);
    src.data.fill(0);
    const contours = findContours(src);
    expect(contours).toHaveLength(0);
  });

  it('finds a single rectangle', () => {
    const src = new Matrix(32, 32, U8C1);
    src.data.fill(0);
    // Draw a filled white rectangle from (5,5) to (20,15)
    for (let y = 5; y <= 15; y++)
      for (let x = 5; x <= 20; x++)
        src.data[y * 32 + x] = 255;
    const contours = findContours(src);
    expect(contours.length).toBeGreaterThanOrEqual(1);
    const c = contours[0];
    expect(c.points.length).toBeGreaterThan(4);
    expect(c.boundingRect.x).toBeGreaterThanOrEqual(4);
    expect(c.boundingRect.x).toBeLessThanOrEqual(6);
    expect(c.boundingRect.width).toBeGreaterThanOrEqual(14);
    expect(c.area).toBeGreaterThan(100);
  });

  it('finds two separate rectangles sorted by area', () => {
    const src = new Matrix(64, 64, U8C1);
    src.data.fill(0);
    // Large rect
    for (let y = 5; y <= 25; y++)
      for (let x = 5; x <= 30; x++)
        src.data[y * 64 + x] = 255;
    // Small rect
    for (let y = 35; y <= 45; y++)
      for (let x = 40; x <= 55; x++)
        src.data[y * 64 + x] = 255;
    const contours = findContours(src);
    expect(contours.length).toBeGreaterThanOrEqual(2);
    // Sorted by area descending
    expect(contours[0].area).toBeGreaterThanOrEqual(contours[1].area);
  });

  it('EXTERNAL mode returns only outer contour for nested shapes', () => {
    const src = new Matrix(32, 32, U8C1);
    src.data.fill(0);
    // Outer rectangle
    for (let y = 2; y <= 28; y++)
      for (let x = 2; x <= 28; x++)
        src.data[y * 32 + x] = 255;
    // Inner hole (set to 0)
    for (let y = 8; y <= 22; y++)
      for (let x = 8; x <= 22; x++)
        src.data[y * 32 + x] = 0;
    const external = findContours(src, ContourMode.EXTERNAL);
    const all = findContours(src, ContourMode.LIST);
    expect(external.length).toBeLessThanOrEqual(all.length);
    expect(external.length).toBeGreaterThanOrEqual(1);
  });
});

describe('approxPoly', () => {
  it('simplifies a rectangle contour to ~4 points', () => {
    const src = new Matrix(32, 32, U8C1);
    src.data.fill(0);
    for (let y = 5; y <= 25; y++)
      for (let x = 5; x <= 25; x++)
        src.data[y * 32 + x] = 255;
    const contours = findContours(src);
    expect(contours.length).toBeGreaterThanOrEqual(1);
    const simplified = approxPoly(contours[0], contours[0].perimeter * 0.04);
    expect(simplified.length).toBeGreaterThanOrEqual(4);
    expect(simplified.length).toBeLessThanOrEqual(6);
  });

  it('returns fewer points with larger epsilon', () => {
    const src = new Matrix(32, 32, U8C1);
    src.data.fill(0);
    for (let y = 5; y <= 25; y++)
      for (let x = 5; x <= 25; x++)
        src.data[y * 32 + x] = 255;
    const contours = findContours(src);
    const fine = approxPoly(contours[0], 1);
    const coarse = approxPoly(contours[0], contours[0].perimeter * 0.1);
    expect(coarse.length).toBeLessThanOrEqual(fine.length);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/imgproc/imgproc.test.ts`
Expected: FAIL — `findContours`, `approxPoly`, `ContourMode` not found.

- [ ] **Step 3: Implement types and findContours**

Add to `src/imgproc/imgproc.ts`:

```typescript
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
 * @param src - Binary input image (U8C1, values 0 or non-zero)
 * @param mode - ContourMode.LIST (all contours) or ContourMode.EXTERNAL (outermost only)
 * @returns Array of Contour objects sorted by area descending
 */
export function findContours(src: Matrix, mode: ContourMode = ContourMode.LIST): Contour[] {
  const w = src.cols, h = src.rows;
  const sd = src.data;

  // Work on a copy (border tracing modifies the image)
  const img = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) img[i] = sd[i] ? 1 : 0;

  const contours: Contour[] = [];

  // 8-connectivity neighbor offsets (clockwise from right)
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

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
          const nx = cx + dx[nd], ny = cy + dy[nd];
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
```

- [ ] **Step 4: Implement approxPoly**

Add to `src/imgproc/imgproc.ts`:

```typescript
/**
 * Approximate a contour polygon using the Douglas-Peucker algorithm.
 *
 * Simplifies a contour to fewer points while preserving shape within
 * the specified epsilon tolerance. Useful for reducing a traced contour
 * to its essential vertices (e.g., 4 points for a rectangle).
 *
 * @param contour - Input contour from findContours
 * @param epsilon - Maximum distance from the original contour (larger = fewer points)
 * @returns Simplified array of points
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
```

- [ ] **Step 5: Export from index.ts**

Add to `src/imgproc/index.ts`:
```typescript
export { findContours, approxPoly, ContourMode, type Contour } from './imgproc';
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run test/imgproc/imgproc.test.ts`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/imgproc/ test/imgproc/
git commit -m "feat(imgproc): add findContours with Moore boundary tracing and approxPoly"
```

---

### Task 4: Documentation & Verification

**Files:**
- Modify: `typedoc.json` (no change needed — imgproc entry point already included)
- Regenerate: `docs/api.json`

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All 231+ tests pass (existing + new).

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 4: Regenerate TypeDoc JSON**

Run: `npm run docs`
Expected: `docs/api.json` updated with new function signatures and TSDoc comments.

- [ ] **Step 5: Build library**

Run: `npm run build`
Expected: Clean build, all modules in `dist/`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: verify build, tests, lint, and regenerate TypeDoc for new imgproc features"
```
