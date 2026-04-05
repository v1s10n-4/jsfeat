# Quest 02 — Detection Game Round 3

## Game Start State
- 3/3 LIFE, LEVEL_1
- Previous game tools: `findContours`, `adaptiveThreshold`, `warpPerspective`, `approxPoly`
- Previous game learnings in DETECTION_GAME_MEMORY.md + QUEST_01_LOGS.md

## LEVEL_1 — Detection Pipeline Rewrite

### Key Insight: Edge Density Morphology
**Problem**: adaptiveThreshold fragments the card blob because card art has varying brightness (bright text boxes, dark borders, colorful art). No single threshold works.

**Solution**: Canny edges + box blur morphological closing.
- Cards have HIGH edge density (borders, art, text) everywhere.
- Desk has ZERO edge density (smooth surface).
- Box-blurring the Canny edge map creates an "edge density" map.
- Thresholding this density map → solid card blob (no internal fragmentation).

### Pipeline
1. Grayscale → Gaussian blur (kernel 9)
2. Canny edges (low=20, high=60)
3. **Save Canny edges** to _cardGray for later refinement
4. Box blur edge map (radius 3) → edge density
5. Threshold density (>10) → binary card mask
6. findContours → pick best contour by (area × rectFill × aspectMatch(5:7))
7. approxPoly → 4 corners (progressive epsilon 0.02→0.12, merge 5→4 points)
8. **Edge refinement**: scan perpendicular to each quad edge, find actual Canny border
9. Temporal smoothing with jump detection + grace period
10. Perspective warp for preview

### Refinement Details
- For each of the 4 quad edges, sample 8 points along the edge
- At each sample, scan perpendicular (from outside to inside) for nearest Canny edge pixel
- Compute median offset → shift edge to match actual border
- Each corner averages the shifts from its two adjacent edges

### Tuning Decisions
- Box blur radius 3 (not 6): tighter blob, less expansion beyond card
- Density threshold 10 (not 15): lower threshold compensates for smaller blur window
- Edge scan range -3 to +15: starts slightly outside blob, scans inward
- 5-point polygon merge: if approxPoly gives 5 pts, merge closest pair → 4

### What Works Well
- Edge density morph gives robust segmentation regardless of card art colors
- approxPoly preserves card orientation (not axis-aligned like bounding rect)
- Perpendicular edge refinement snaps quad edges to actual Canny borders
- Pipeline thumbnail shows morph result for debugging
- Quality chart (top-right) shows detection consistency
- 60 FPS at 640x480, total ~12.5ms/frame

### Remaining Issues
- Bottom edge extends ~3-5px below card (higher edge density from card text)
- Slider defaults don't auto-refresh via HMR (old values stick from previous session)
- Camera perspective makes the card's apparent ratio ≠ 5:7 (perspective distortion)
