# Training Game 01 — Logs

## Starting State
- LIFE: 3/3
- Baseline: 16 pass / 32 fail at 50px threshold
- Detection pipeline: Canny + morph edge density with adaptive threshold, temporal smoothing, persistence bias

---

## [RUN_1_RESULTS]
- **16 pass / 32 fail** (50px threshold)
- N=1, LIFE=3/3
- This is the baseline. No previous results to compare.

### Analysis of failures
The 32 failing images all share the same root cause: the detection produces an **axis-aligned bounding rectangle** (from `buildCardCorners`) instead of a **perspective-following quad** from `approxPoly`. For cards that are nearly upright, the axis-aligned rect happens to be close to the ground truth. For tilted/rotated cards, the rect is way off.

The core fix needed: **make the detection produce perspective-adaptive quads that follow the card's actual borders**, not axis-aligned rectangles.

Looking at the pipeline:
1. The morph blob contour IS perspective-aware (follows the tilted card shape)
2. `approxPoly` CAN produce 4 perspective corners
3. BUT the side ratio check (`minS > maxS * 0.5`) is too strict — it rejects the polygon and falls back to `buildCardCorners` (axis-aligned rect)
4. The axis-aligned rect doesn't match the tilted card borders

**Plan for improvement:**
- Lower the side ratio threshold to accept more perspective quads from approxPoly
- For the buildCardCorners fallback, try to preserve the contour's orientation instead of axis-aligning

---


## [RUN_2_RESULTS]
- **24 pass / 24 fail** (50px threshold)
- N=2, LIFE=3/3
- Change: lowered side ratio threshold from 0.5 to 0.2 in approxPoly validation
- Improvement: +8 passes (16→24), no regressions visible
- IMPROVEMENT confirmed: all previous 16 passes still pass, 8 new passes
- **COMMIT and GAIN 1 LIFE → LIFE=4/4 (capped at MAX_LIFE=3)**


## [RUN_3_RESULTS]
- **24 pass / 24 fail** (50px threshold)
- N=3, LIFE=3/3
- Change: reduced morph blur radius 4→3
- No difference from RUN_2. The morph radius change alone doesnt fix the overshooting corners.
- Continue to step 5: need a different approach.

### Analysis
The morph blob shape is the problem, not just its size. The blob follows the card art edge density, not the card border. approxPoly on this irregular blob gives corners that overshoot.

The real fix: need to use the Canny edges at the card border for corner positions, not the morph blob contour. The morph blob should only identify WHERE the card is, not define its EXACT corners.


## [RUN_4_RESULTS]
- **28 pass / 20 fail** (50px threshold)
- N=4, LIFE=3/3
- Change: added convex hull (Graham scan) before approxPoly to eliminate contour concavities
- Improvement: +4 passes (24→28), need to verify no regressions
- IMPROVEMENT confirmed: ratio of new passes to new fails is positive (+4, -0)
- **COMMIT and GAIN 1 LIFE → LIFE=3/3 (capped at MAX)**


## [RUN_5_RESULTS]
- **28 pass / 20 fail** (50px threshold)
- N=5, LIFE=3/3
- Change: increased edge refinement scan samples (8→12) and range (-3..15 → -10..40)
- No net change in pass/fail count. The wider scan helps some images but doesnt flip any.
- Continue to step 5: need a fundamentally different approach for the remaining 20.

### Failure analysis
The remaining 20 failures fall into patterns:
1. Morph blob merges with background edges (wood grain) → oversized contour
2. Card detected but corners offset 50-150px from ground truth
3. Wrong contour selected (background feature instead of card)

The morph approach is reaching its limit. Need to research alternative detection strategies.


## [RUN_5_RESULTS]
- **27 pass / 21 fail** (50px threshold)
- N=5, LIFE=2/3 (LOST 1 LIFE — regression from 28→27)
- Change: added 3% centroid shrink before edge refinement
- REGRESSION: one previously passing image now fails. The uniform shrink helps some but hurts others.
- Reverted the change immediately.
- Need to find a targeted fix that doesnt regress existing passes.


## [RUN_6_RESULTS]
- **28 pass / 20 fail** (50px threshold)
- N=6, LIFE=2/3
- Changes: extended approxPoly epsilon 0.12→0.15, raised morph threshold mean+5→mean+7
- No difference from previous best (28 pass). No regression either.
- The epsilon and threshold tweaks have no effect on the pass/fail boundary.
- The 20 remaining failures need a fundamentally different approach to corner detection.


### Deep analysis — why 20 images still fail

The morph blob + convex hull + approxPoly approach has reached its ceiling at 28/48.
The remaining 20 failures are images where the morph blob shape doesnt match the card well enough.

Key realization: the morph blob is a REGION detector (finds where the card IS), but its SHAPE
is not accurate enough for corner positions. The actual card BORDER is defined by the Canny edges,
not the morph blob boundary.

**New strategy: use approxPoly corners as INITIAL estimate, then refine EACH CORNER independently
by scanning from the corner toward the card center, looking for a strong Canny edge intersection.**

This is different from the current edge refinement which shifts entire edges.
Corner-specific refinement can handle cases where one corner overshoots 100px while others are fine.


## [RUN_7_RESULTS]
- **28 pass / 20 fail** (50px threshold)
- N=7, LIFE=2/3
- Change: replaced edge-based refinement with corner-specific Canny scan (each corner scans toward center)
- No net change. The corner refinement finds internal card edges (art, text) before reaching the card border.
- The Canny edges INSIDE the card are hit before the actual card border edge.

### Key insight
The corner-to-center scan hits INTERNAL card edges first (art details, text boundaries). These are NOT
the card border. The scan cant distinguish internal edges from the card border edge.

The original edge-perpendicular scan was actually better for finding the card border because it samples
along the edge (not toward center), and the median filters out internal edge hits.

**Reverting to the original edge-perpendicular refinement.**


## [RUN_8_RESULTS]
- **32 pass / 16 fail** (50px threshold)
- N=8, LIFE=2/3
- Change: merged Scharr gradient magnitude with Canny edges before morph
- Improvement: +4 passes (28→32), no regressions visible
- Scharr produces broader edge responses at card borders, improving morph blob shape
- Morph density thumbnail (right panel) shows cleaner, more defined card shape
- Note: morph step now takes 15.5ms (was 7ms) due to Scharr computation
- IMPROVEMENT confirmed: 28→32 passes
- **COMMIT and GAIN 1 LIFE → LIFE=3/3**

