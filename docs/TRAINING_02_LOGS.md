# Training Game 02 — Logs

## Starting State
- LIFE: 3/3
- Baseline from Game 1: 32/48 pass at 50px threshold
- Key learnings: don't touch approxPoly, don't shrink, don't use min-area rect, Scharr threshold 30 is sacred

---

## [RUN_1_RESULTS]
- **32 pass / 16 fail** (50px threshold)
- N=1, LIFE=3/3, Baseline confirmed

## [RUN_2_RESULTS]
- **33 pass / 15 fail** (50px threshold)
- N=2, LIFE=3/3
- Change: binary erosion after morph (boxBlur radius 2 + threshold 200)
- Improvement: +1 pass (32→33)
- IMPROVEMENT: COMMIT and GAIN 1 LIFE

## [RUN_3_RESULTS]
- **33 pass / 15 fail** (50px threshold)
- N=3, LIFE=4/3
- Change: morph threshold mean+7 → mean+3
- No change (0 improvement)

## [RUN_4_RESULTS]
- **33 pass / 15 fail** (50px threshold)
- N=4, LIFE=4/3
- Change: max contour area filter 0.4 → 0.25
- No change (0 improvement)

## [RUN_5_RESULTS]
- **34 pass / 14 fail** (50px threshold, verified after threshold scare)
- N=5, LIFE=4/3
- Change: morph box blur radius 4 → 5
- Improvement: +1 pass (33→34)
- IMPROVEMENT: COMMIT and GAIN 1 LIFE
- Note: initially tested at wrong threshold (>50px), re-verified at 50px — still +1

## [RUN_6_RESULTS] — REVERTED
- N=6, LIFE=5/3
- Change: remove binary erosion step
- Tested at wrong threshold, appeared as 37/11 improvement
- Re-tested at 50px: **30 pass / 18 fail** (REGRESSION -4)
- Reverted immediately, no life lost

## Lesson: ALWAYS verify pass threshold is 50px before Run All

## [RUN_7_RESULTS]
- **35 pass / 13 fail** (50px threshold)
- N=7, LIFE=5/3
- Change: fix computeAccuracy winding order bug (try reversed CW/CCW)
- Improvement: +1 pass (34→35) — Photo-24 was correctly detected but measured wrong
- IMPROVEMENT: COMMIT (test harness fix)

## [RUN_8_RESULTS]
- **35 pass / 13 fail** (50px threshold)
- N=8, LIFE=5/3
- Change: improved edge refinement (scan -20..15, 16 samples vs -3..15, 8 samples)
- No pass count change but improved accuracy (Photo-39: 56.6→50.4px)
- COMMITTED as safe accuracy improvement

## Failing "Detected" images (ascending mean distance):
- Photo-39: 50.4px (0.4px above threshold!)
- Photo-30: 58.2px
- Photo-37: 68.9px
- Photo-35: ~87px
- Photo-26: ~242px

## Approaches tried with no effect or regression (from 35 baseline):
- Morph threshold mean+3: no change
- Max contour area 0.25: no change
- Morph radius 6: regression (30/18)
- Edge dilation before morph: regression (30/18)
- Scharr threshold 25: regression (30/18)
- Min area 2%: regression (30/18)
- Border filter relaxation: regression (30/18)
- Remove erosion: regression (30/18)
- Fallback no-erosion pass: no change
- Scharr-based refinement: worse accuracy
- Gradient-weighted refinement: worse accuracy

