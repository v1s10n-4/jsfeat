# Training Game Memory — Lessons Learned

## Game 1: 16/48 → 32/48 (67%) — GAME OVER at N=11

### What Worked (+16 passes total)
1. **Side ratio threshold 0.5 → 0.2** (+8 passes): Accepts perspective-following quads from approxPoly instead of falling back to axis-aligned buildCardCorners. Cards at any angle get proper perspective detection.
2. **Convex hull before approxPoly** (+4 passes): Graham scan smooths out contour concavities, giving cleaner 4-point polygons that better match card shape.
3. **Scharr gradient merge with Canny** (+4 passes): Merging Scharr gradient magnitude (threshold > 30, right-shifted by 3) with Canny edges produces denser, stronger edge map at card borders. Better morph blobs.

### What Caused Regressions (lost 3 lives)
1. **3% centroid shrink** (-1 pass, -1 life): Uniform shrinkage toward center helps some corners but hurts others. The shrinkage direction doesn't align with the actual error direction for all corners.
2. **Scharr threshold 30 → 50** (-4 passes, -1 life): Higher threshold removes useful Scharr edges that the 4 gained passes relied on. The threshold 30 is the sweet spot.
3. **Minimum area rotated bounding box replacing approxPoly** (-13 passes, -1 life): SEVERE REGRESSION. The min-area rect of the convex hull encloses the ENTIRE hull tightly, including all overshooting edges. It's a worse fit than approxPoly which at least tries to find meaningful corner positions.

### What Had No Effect
- Morph blur radius 4 → 3 (no change)
- Edge refinement scan range -3..15 → -10..40 (no change)
- Corner-specific Canny scan toward center (hits internal card edges before border)
- approxPoly epsilon 0.12 → 0.15 (no change)
- Morph threshold mean+5 → mean+7 (no change — already harmless, kept)

### Test Harness Issues Discovered
- **Run All timing**: React state updates + useEffect don't guarantee deterministic processing order. Fixed with offscreen canvas direct processing.
- **Temporal state leakage**: `_cardSmoothedCorners`, grace period, and `_cardPrevThreshold` carry over between images during batch runs. Fixed with `resetCardTemporalState()`.
- **Offscreen vs visible canvas**: Offscreen canvas may produce slightly different pixel values than visible canvas, causing marginal detections to flip pass/fail.
- **Rotation-invariant accuracy**: `computeAccuracy` must try all 4 rotations of detected corners against ground truth, since `sortCorners` assigns TL/TR/BR/BL differently for rotated cards.

### Key Technical Insights
1. The morph blob approach has a ceiling. The blob shape follows edge DENSITY, not the card BORDER. On busy backgrounds (wood grain), the blob merges with background edges.
2. Convex hull helps with concavities but can't fix overshooting — if the blob extends beyond the card, the hull extends too.
3. The Scharr gradient at threshold 30 adds exactly the right amount of edge information. Too low adds noise, too high removes useful data.
4. approxPoly on convex hull is BETTER than minimum area rotated bounding box — approxPoly finds meaningful inflection points while min-area rect just encloses everything.
5. Edge refinement (scanning perpendicular to edges for Canny borders) has limited effect because:
   - Internal card edges (art, text) are hit before the card border
   - The scan range is bounded and might not reach the actual border for large overshoots

### For Next Training Game
1. **Don't touch approxPoly** — it's the best available polygon simplification.
2. **Don't try global shrinkage** — it helps some corners and hurts others.
3. **Don't replace approxPoly with min-area rect** — catastrophic regression.
4. **Research needed**: gradient-based line fitting (find 4 dominant lines from Scharr gradients, intersect for corners).
5. **Research needed**: adaptive morph threshold per-region (higher threshold in areas with more background edges).
6. **Always test with Run All before committing** — never trust individual Retest for batch metrics.
7. **The Scharr threshold at 30 is sacred** — don't change it.
8. **Start each training iteration by checking the EXACT current score** before making changes.
