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

## Game 2: 32/48 → 35/48 (73%) — continued after Game 1

### What Worked (+3 passes)
1. **Binary erosion after morph** (+1 pass): Box blur radius 2 + threshold 200 on binary mask shrinks overshooting blob edges.
2. **Morph box blur radius 4→5** (+1 pass): Slightly larger morph connects more nearby edge fragments into blobs.
3. **computeAccuracy winding order fix** (+1 pass): Try both CW/CCW winding when matching detected corners to ground truth.

### What Had No Effect
- Morph threshold mean+3 vs mean+7 (no change)
- Max contour area 0.25 vs 0.4 (no change)
- Canny thresholds 15/45 or 10/30 (no change — Gaussian kernel 15 dominates)
- Aspect ratio filter 0.25 vs 0.35 (no change — aspectMatch filter is stricter)
- Fallback detection without erosion (no change — contours don't form regardless)
- Adaptive threshold for morph blob (regression — wrong tool for edge density maps)
- Multi-epsilon approxPoly selection (no change)

### Accuracy Improvements (no pass change)
- Edge refinement: wider outward scan (-40 instead of -3), 16 samples instead of 8
- Line fitting on hull segments with 0.9 factor
- Photo-39: 56.6→47.5px (now passes)
- Photo-37: 62.6→42.2px (now passes)

## Game 3: 35/48 → 37/48 (77%) — GAME OVER at N=10

### What Worked (+2 passes)
1. **Extended edge refinement scan to -40px** (+1 pass, Photo-39): Wider outward scan finds card borders further from detected quad.
2. **Color-based edge detection** (+1 pass): R-B "warmth" gradient and chroma (max-min RGB) detect card borders invisible in grayscale. Combined with conditional histogram equalization for dark images (mean brightness < 100). Fixed Photo-43/44/45 (dark card on dark wood).

### What Caused Regressions (lost 3 lives)
1. **Gaussian morph kernel** (-6 passes, -1 life): Gaussian blur instead of box blur for morph produces different blob shapes.
2. **Blob closing (radius 4, threshold 50)** (-1 pass, -1 life): Too aggressive closing expands existing blobs beyond card borders.
3. **Gaussian blur kernel 15→11** (-6 passes, -1 life): Smaller blur lets wood grain through, fragments morph blobs. **Kernel 15 is SACRED.**
4. **Brightness filter on warmth edges** (-2 passes, -1 life): Restricting warmth edges to dark pixels (< 120) kills dark card detection.
5. **Erosion radius 2→3** (-2 passes, -1 life): Stronger erosion fragments valid blobs.

### What Had No Effect
- Border-touching filter relaxation (lets in huge background contours that outscore cards)
- Adaptive threshold segmentation fallback (cards don't segment cleanly from wood)
- Scharr-based refinement (worse than Canny-based for finding card borders)
- Gradient-weighted refinement (worse than simple median)

### Key Technical Insights
1. **Color information is powerful**: R-B warmth and chroma channels detect card borders invisible in grayscale. Critical for dark cards on dark backgrounds.
2. **Conditional equalization**: Only apply histogram equalization when mean brightness < 100. Higher threshold (120) breaks dark card detection.
3. **4 "marginal" images**: Every morph parameter change breaks the same 4 images. The morph blob approach has a ceiling at ~37/48.
4. **Line fitting on hull**: Using all hull points for least-squares line fitting per edge gives better corners than approxPoly alone.
5. **Edge refinement**: wider outward scan + more samples + median is the optimal strategy. Scharr/weighted approaches are worse.
6. **Border-touching cards**: Cards near image borders are fundamentally hard — can't relax border filter without letting in background contours.

### Sacred Parameters (DO NOT CHANGE)
- Scharr magnitude threshold: 30 (Game 1)
- Gaussian blur kernel: 15 (Game 3)
- Morph box blur radius: 5 (Game 2)
- Erosion: box blur radius 2, threshold 200 (Game 2)

### For Next Training Game
1. **Don't touch approxPoly** — it's the best available polygon simplification.
2. **Don't try global shrinkage** — it helps some corners and hurts others.
3. **Don't replace approxPoly with min-area rect** — catastrophic regression.
4. **Line fitting on hull is DONE** — implemented, gives good results at 0.9 factor.
5. **Color-based edge detection is DONE** — warmth + chroma channels implemented and working.
6. **Always test with Run All before committing** — never trust individual Retest for batch metrics.
7. **Always verify pass threshold is 50px** before Run All.
8. **Sacred parameters**: Scharr 30, Gaussian kernel 15, morph radius 5, erosion radius 2/threshold 200.
9. **Start each training iteration by checking the EXACT current score** before making changes.
10. **The morph blob approach has a ceiling at ~37/48** — further gains need architectural changes.
11. **Remaining 11 failures**: mostly "Detected but inaccurate" (blob overshoots), a few "No Card" (border-touching or extreme angles).
12. **Research needed**: Hough line detection, perspective-aware corner refinement, or ML-based detection for the remaining 11.

## LSD Experiment: Pure LSD & Hybrid Approaches — Ceiling Confirmed at 37/48

### What Was Tried
1. **LSD-only pipeline** (14/48): Replaced entire morph blob with LSD line segment detection on 3 channels (grayscale, warmth, chroma). Wood grain produces too many competing segments — quad grouping can't distinguish card lines from noise.
2. **Size penalty scoring** (+10 passes, 4→14): Gaussian-like penalty around ideal card area (12% of frame). Prevents large background quads from outscoring card-sized ones.
3. **Rectangularity checks** (no improvement): Opposite-side ratio and 90° angle checks filter bad quads but don't help find good ones.
4. **Hybrid: morph blob ROI + LSD corners** (24-33/48): Morph blob finds card region, LSD finds precise corners within ROI. LSD quads diverge from morph detection causing regressions unless strictly proximity-checked, which prevents improvements.
5. **Multi-radius fallback** (radius 8, 10 when no card found): Detects previously-missed cards but with 100-150px accuracy — not enough to pass 50px threshold.
6. **Gradient-peak refinement** (~1px improvement): Scanning for strongest Scharr gradient perpendicular to each edge. Wood grain peaks mask card border peaks.
7. **Centroid shrink** (regression): Pulling corners toward center moves good corners too.
8. **Parallelogram correction** (regression): Assumes parallel opposite sides — fails with perspective distortion.
9. **Extended scan range -80px** (regression): Finds noise Canny edges further out.
10. **Equalization threshold 130** (24/48 regression): Breaks moderately dark images.
11. **Lighter blur for color channels** (no change): Color edges are minor contribution.

### Key Insights from LSD Experiment
1. **LSD detects gradient ORIENTATION, not magnitude** — theoretically detects dark-on-dark edges. In practice, wood grain has equally consistent orientation, producing false segments.
2. **The quad grouping is the bottleneck**, not LSD itself. With 200+ segments, finding the right 4 from ~12,000 combinations is a needle-in-haystack problem.
3. **Morph blob gives WHERE the card is** (37/48), but wrong corners (50-170px off). LSD gives precise LINES but can't tell card lines from noise. Combining them requires solving the "which LSD lines are card borders" problem.
4. **MacBook bezel at image bottom** creates the strongest, longest line segments — always dominates unless explicitly excluded (18% bottom margin).
5. **Segment scoring by border-ness** (cross-edge contrast, isolation, position) is a promising direction (Option B branch exists but untested with morph ROI).
6. **Gradient density ROI** (Option C branch) could constrain LSD to card-like regions without needing the morph blob.

### The 11 Remaining Failures (detailed)
| Image | Type | Distance | Root Cause |
|-------|------|----------|------------|
| Photo-25 | No Card | - | Card near left border, blob touches border |
| Photo-26 | Detected | 86px | Extreme angle, blob overshoots |
| Photo-27 | No Card | - | Extreme angle, blob fragments |
| Photo-30 | Detected | 56px | BL corner 197px off — blob extends rightward |
| Photo-31 | Detected | 169px | Blob extends below card (connects with desk) |
| Photo-33 | Detected | 90px | Blob overshoots on wood |
| Photo-34 | No Card | - | Blob doesn't form |
| Photo-35 | Detected | 77px | Heavily rotated, blob overshoots |
| +3 more | Unknown | - | Need identification |

### What Would Actually Break Through 37/48
1. **Bilateral filtering** instead of Gaussian blur — preserves edges while smoothing texture. The biggest untried classical CV approach. Could produce tighter morph blobs because card borders are preserved while wood grain is smoothed.
2. **Segment scoring + morph ROI** — combine Option B (border-ness scoring of LSD segments) with the morph blob's ROI. Only consider high-border-score segments within the morph region.
3. **Adaptive morph with color segmentation** — use color information (not just edges) to segment card from background before morphing.
4. **ML-based corner refinement** — use a small CNN to refine corner positions from the detected region. Would need training data.
5. **Warp + re-detect** — after initial detection, warp the perspective-corrected card back to frontal view, re-run detection on the rectified image for better corners.
