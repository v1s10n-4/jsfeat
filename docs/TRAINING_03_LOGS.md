# Training Game 03 — Logs

## Starting State
- LIFE: 3/3
- Baseline from Game 2: 35/48 pass at 50px threshold
- Key learnings from Games 1-2:
  - Don't touch approxPoly, Scharr threshold 30 is sacred
  - Morph radius 5 + erosion is optimal for current approach
  - Single-parameter morph tweaks cause same 4 marginal images to regress
  - Photo-39 is 0.4px above threshold (50.4px)
  - 8 "No Card" failures: morph blob doesn't form on wood backgrounds
  - 5 "Detected but inaccurate" failures: blob shape overshoots
- Strategy: try adaptive threshold for morph blob instead of global threshold

---

## [RUN_1_RESULTS]
- **29 pass / 19 fail** (50px threshold)
- N=1, LIFE=2/3
- Change: Gaussian blur (kernel 11) instead of box blur (radius 5) for morph
- REGRESSION: -6 from baseline (35→29), LOSE 1 LIFE
- Reason: Gaussian kernel produces different blob shapes, breaks 6 previously passing images
- Also tried: adaptive threshold blockSize=101 (20/28), blockSize=301 (26/22) — both worse
- Reverted to committed state

## [RUN_2_RESULTS] — REGRESSION
- **35 pass / 13 fail** (50px threshold)
- N=2, LIFE=2/3
- Change: two-stage morph (binary blob closing: box blur radius 4, threshold 50)
- REGRESSION: -1 from baseline (36→35), LOSE 1 LIFE
- Reason: blob closing expands existing detections too much, causing 1 pass→fail
- Reverted

## [RUN_3_RESULTS] — REGRESSION
- **35 pass / 13 fail** (50px threshold)
- N=3, LIFE=2/3
- Change: two-stage morph (blob closing radius 4, threshold 50)
- REGRESSION: -1 from baseline, LOSE 1 LIFE
- Reverted

## [RUN_4_RESULTS]
- **34 pass / 14 fail** (50px threshold)
- N=4, LIFE=2/3
- Change: gentler blob closing (radius 3, threshold 80)
- Photo-32 went from "No Card" to PASS (49.9px!) but lost 3 others
- Not improvement (1 gain / 3 loss), not pure regression (has new pass)
- Reverted

## [RUN_5_RESULTS]
- **36 pass / 12 fail** (50px threshold)
- N=5, LIFE=2/3
- Change: line-fitting corner refinement on hull segments
- No pass count change but improved accuracy:
  - Photo-39: 47.5→46.8, Photo-30: 58.4→56.6, Photo-37: 62.6→55.9
- COMMITTED as safe accuracy improvement

## [RUN_6_RESULTS]
- **36 pass / 12 fail** (50px threshold)
- N=6, LIFE=2/3
- Change: line fitting factor 0.7→0.9/1.0, tested individually
- Photo-37: 55.9→53.0 (0.9 best), Photo-30: 56.6→56.8 (slightly worse)
- Hull shape accuracy is the fundamental limit
- Reverted to 0.7 factor (safe committed state)

## [RUN_7_RESULTS]
- **37 pass / 11 fail** (50px threshold)
- N=7, LIFE=3/3
- Changes: R-B warmth gradient edges + conditional histogram equalization for dark images
- Improvement: +1 pass (36→37)
- IMPROVEMENT: COMMIT and GAIN 1 LIFE

## [RUN_8_RESULTS]
- N=8, LIFE=2/3
- Tried: brightness filter on warmth edges + border penalty
- REGRESSION (35/13), LOSE 1 LIFE. Reverted.
- Reason: brightness filter breaks dark card detection (Photo-43/44/45)

## Remaining 11 failures:
- Photo-25: No Card (near border, blob merges with desk)
- Photo-26: 86px (extreme angle)
- Photo-27: No Card (extreme angle)
- Photo-30: 57px (close)
- Photo-35: 76px
- Others: need investigation

## [RUN_9_RESULTS]
- **31 pass / 17 fail** (50px threshold)
- N=9, LIFE=1/3
- Change: Gaussian blur kernel 15→11
- REGRESSION: -6 from baseline (37→31), LOSE 1 LIFE
- Reason: smaller blur lets wood grain through, fragments morph blobs
- Gaussian kernel 15 is SACRED — do not reduce
- Reverted


- **36 pass / 12 fail** (50px threshold)
- N=2, LIFE=3/3
- Change: extend edge refinement outward scan from -20 to -40px
- Improvement: +1 pass (35→36), Photo-39: 50.4→47.5px
- IMPROVEMENT: COMMIT and GAIN 1 LIFE

