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

