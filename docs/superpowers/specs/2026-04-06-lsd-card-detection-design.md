# LSD Line Segment Detection for Card Detection — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Break through the 37/48 detection ceiling by implementing a Line Segment Detector (LSD) that finds card edges directly from gradient orientation, bypassing Canny's magnitude dependency.

**Architecture:** Add LSD as a new jsfeat library function, then integrate it as a fallback detector in the card detection pipeline. The existing morph blob pipeline remains the primary detector for its proven 37/48 cases; LSD activates only when the primary fails.

**Tech Stack:** Pure TypeScript, no external dependencies. Leverages existing jsfeat `scharrDerivatives` for gradient computation.

---

## 1. Problem Statement

The current card detection pipeline uses Canny edge detection as its foundation. Canny requires **gradient magnitude** above a threshold to detect an edge. On wood backgrounds, dark cards have near-zero brightness contrast with the wood — Canny cannot detect these borders regardless of downstream processing (morph, contours, line tracing, multi-channel fusion).

After 3 training games and 4 parallel architectural experiments, all approaches built on Canny edges plateau at 37/48 (77%).

The 11 remaining failures break down as:
- **~4 "blob doesn't form"**: Edge density too low for morph blob to connect
- **~2 "border-touching"**: Card near image edge, contour rejected
- **~5 "detected but inaccurate"**: Blob overshoots, corners 50-170px off

## 2. LSD: The Key Insight

The Line Segment Detector (LSD) algorithm works on **gradient orientation**, not magnitude. Where Canny asks "is this gradient strong enough?", LSD asks "do neighboring pixels share a consistent gradient direction?" Even a barely-visible dark-on-dark card border creates a gradient with a consistent direction — LSD can detect it.

### How LSD works (simplified):

1. **Compute gradient field**: For each pixel, compute gradient magnitude and angle from Scharr/Sobel derivatives. Already available via `scharrDerivatives`.

2. **Sort pixels by gradient magnitude** (descending): Process strongest gradients first for efficiency. Use a bucketed pseudo-sort (256 buckets) for O(n) performance.

3. **Region growing**: Starting from each unvisited pixel (strongest first), grow a "line-support region" by adding neighboring pixels whose gradient angle is within a tolerance (e.g., ±22.5°, i.e., π/8) of the region's mean angle. This produces elongated regions of pixels with consistent gradient direction.

4. **Rectangle fitting**: Fit a minimum-width rectangle to each region. The rectangle's width, length, and the number of "aligned" pixels inside it determine whether it's a valid line segment. Use the **NFA (Number of False Alarms)** criterion: a segment is valid if the probability of its aligned pixel density occurring by chance is below a threshold (Helmholtz principle). Simplified: `alignedRatio > 0.7` and `length > minLength`.

5. **Output**: A list of line segments, each defined by two endpoints (x1,y1,x2,y2) and a width.

### Simplified LSD vs Full LSD

The full LSD algorithm (as described in the IPOL paper) includes multi-scale validation, NFA computation with log-gamma functions, and iterative rectangle refinement. For card detection, a **simplified version** suffices:

- Skip multi-scale (we already have a fixed-resolution pipeline)
- Replace NFA with a simple aligned-pixel ratio threshold
- Skip iterative refinement (card edges are straight enough)
- This reduces complexity from ~800 lines to ~250 lines

## 3. Quadrilateral Grouping

Once LSD produces line segments, we need to find 4 segments forming a card-shaped rectangle:

### Algorithm:

1. **Filter segments**: Keep segments longer than `minLength` (e.g., 40px at 1920x1080). Discard very short noise segments.

2. **Group by angle**: Compute each segment's angle (0-180°). Cluster into groups within ±15° tolerance. Find the **two largest groups** whose mean angles are roughly perpendicular (70°-110° apart).

3. **Select candidate lines**: From each of the two perpendicular groups, take the top N longest segments (N ≤ 15).

4. **Score quadrilaterals**: For each combination of 2 segments from group1 × 2 segments from group2:
   - Compute 4 intersection points
   - Check: all 4 points inside image (with margin)
   - Check: quadrilateral is convex
   - Check: area between 3% and 40% of frame
   - Score by: `area × aspectMatch × totalLineLength`
   - `aspectMatch = 1 - |aspect - 5/7| × 3` (card ratio)

5. **Best quadrilateral**: The highest-scoring valid quadrilateral gives the 4 card corners.

### Performance budget:
- Max 200 segments from LSD (take longest)
- Max 15 lines per angle group
- Max 15×15 × 15×15 / 4 = ~12,000 combinations (with pruning: ~500)
- Total: < 5ms for the grouping step

## 4. Integration into Card Detection Pipeline

```
┌─────────────────────────────────────────┐
│ PRIMARY: Morph Blob Pipeline (existing) │
│ Canny → Scharr → Color → Morph → Hull  │
│ Works for 37/48 images                  │
└──────────────┬──────────────────────────┘
               │ detected?
         ┌─────┴─────┐
         │ YES       │ NO
         ▼           ▼
    Use corners   ┌──────────────────────┐
                  │ FALLBACK: LSD + Quad │
                  │ Scharr grads → LSD   │
                  │ → Group → Rectangle  │
                  └──────────┬───────────┘
                             │ detected?
                       ┌─────┴─────┐
                       │ YES       │ NO
                       ▼           ▼
                  Use corners   No card
```

### Key integration points:

- **Input**: Reuse `_cardScharr` (already computed for the primary pipeline). LSD needs gradient dx/dy — `scharrDerivatives` produces exactly this in `S32C2` format.
- **Output**: Set `detected = true` and `cardCorners` to the 4 sorted intersection points.
- **Timing**: LSD fallback only runs when primary fails. For the 37 passing images, zero additional cost. For the 11 failing images, adds ~10-20ms.
- **Edge refinement**: The existing perpendicular Canny scan refinement may not help LSD detections (since Canny didn't detect the edges). Skip refinement for LSD-detected cards, or use a Scharr-magnitude-based refinement instead.

## 5. File Structure

### New library function:
- `src/imgproc/lsd.ts` — Line Segment Detector implementation (~250 lines)
  - `export function detectLineSegments(gradients: Matrix, minLength: number): LineSegment[]`
  - `LineSegment = { x1, y1, x2, y2, width, angle }`
  - Input: S32C2 matrix from `scharrDerivatives` (dx, dy per pixel)
  - Uses gradient magnitude for pixel ordering, gradient angle for region growing
  
- `src/imgproc/index.ts` — re-export `detectLineSegments`

### Pipeline integration:
- `demo/src/lib/demos.ts` — add LSD fallback after morph blob detection
  - `findCardQuadrilateral(segments, w, h)` helper function (~150 lines)
  - Groups segments, finds best rectangle, returns corners or null

### Total new code: ~400 lines

## 6. LSD Implementation Details

### Gradient angle computation:
```typescript
// From existing Scharr S32C2 data:
const dx = scharrData[i * 2];
const dy = scharrData[i * 2 + 1];
const magnitude = Math.sqrt(dx * dx + dy * dy);
const angle = Math.atan2(dy, dx); // -PI to PI, perpendicular to edge direction
```

### Region growing:
```typescript
// Angle tolerance: ±PI/8 (22.5°)
const ANGLE_TOLERANCE = Math.PI / 8;

function anglesAgree(a1: number, a2: number): boolean {
  let diff = Math.abs(a1 - a2);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff < ANGLE_TOLERANCE;
}
```

### Pseudo-sort by magnitude:
```typescript
// 1024-bucket sort for O(n) ordering
const BUCKETS = 1024;
const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);
for (let i = 0; i < n; i++) {
  const bucket = Math.min(BUCKETS - 1, (magnitude[i] * BUCKETS / maxMag) | 0);
  buckets[bucket].push(i);
}
// Process from highest bucket to lowest
```

### Rectangle fitting:
For each line-support region, compute the principal axis using the region's centroid and covariance matrix (or simply use the two farthest points). The rectangle is defined by the principal axis direction, the extent along and perpendicular to it.

### Validation:
```typescript
// Simplified NFA replacement:
const alignedCount = countAlignedPixels(rect, angles, regionAngle);
const totalInRect = rect.width * rect.length;
const ratio = alignedCount / totalInRect;
const valid = ratio > 0.5 && rect.length > minLength && rect.width < maxWidth;
```

## 7. Quadrilateral Grouping Details

### Line intersection:
```typescript
function intersectLines(
  p1: Point, d1: Point, // line 1: point + direction
  p2: Point, d2: Point  // line 2: point + direction
): Point | null {
  const cross = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(cross) < 1e-6) return null; // parallel
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / cross;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
}
```

### Convexity check:
```typescript
function isConvexQuad(pts: Point[]): boolean {
  // Check all cross products have same sign
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i+1)%4], c = pts[(i+2)%4];
    const cross = (b.x-a.x)*(c.y-b.y) - (b.y-a.y)*(c.x-b.x);
    if (cross < 0) return false;
  }
  return true;
}
```

## 8. Testing Strategy

### Unit tests for LSD:
- Synthetic image with known line segments (white lines on black background)
- Verify segment count, angles, endpoints within tolerance
- Test with low-contrast lines (gradient magnitude = 5) to verify orientation-based detection

### Integration tests:
- Run workbench "Run All" at 50px threshold
- Baseline: 37/48 (must not regress)
- Target: 42+/48 (the 5 "detected but inaccurate" cases should improve from LSD providing better initial corners)
- Stretch: 45+/48

### Specific test cases:
- Photo-43/44/45: dark card on dark wood (LSD should detect via orientation)
- Photo-25/27: border-touching cards (LSD finds partial edges)
- Photo-30/35: extreme angles (line-based detection handles perspective)

## 9. Performance Constraints

- LSD fallback must complete in < 30ms at 1920x1080
- Primary pipeline (morph blob) must remain unchanged — zero performance impact for the 37 passing images
- Total pipeline with fallback: < 150ms worst case

## 10. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Wood grain produces many short line segments | Filter by minimum length (40px). Wood grain segments are short and randomly oriented. |
| Rounded card corners break line continuity | LSD still detects the straight portions of each side. Corners are computed from line intersections, not segment endpoints. |
| Too many line combinations to evaluate | Cap at 15 lines per angle group, prune early by segment separation. |
| LSD corners less accurate than morph+refinement | For images where morph succeeds, morph is still used. LSD only handles failures. |
| Gradient orientation noise in flat regions | Skip pixels with gradient magnitude < threshold (e.g., 5). Flat regions have random orientations but near-zero magnitude. |
