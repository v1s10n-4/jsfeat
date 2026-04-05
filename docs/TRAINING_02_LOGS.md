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

