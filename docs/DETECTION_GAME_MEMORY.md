# Card Detection Game - Lessons Learned

## Game Overview
Attempted to build a real-time trading card detection demo using jsfeat's edge-based CV primitives (Canny, Gaussian blur, flood-fill). The goal was to detect a trading card on a desk, draw a perspective-adaptive green quad around it, and show a color perspective-corrected preview.

## What Worked
- **Flood-fill enclosed region detection** — fundamentally sound approach for finding card-shaped regions bounded by Canny edges
- **Downsampled processing (4x)** — fast enough for 60 FPS at 640x480
- **Perspective warp with color bilinear interpolation** — produced good color previews when corners were correct
- **Convex hull + Douglas-Peucker simplification** — produced perspective-adaptive quads (not just rectangles)
- **Temporal smoothing with jump detection** — smoothed small movements, snapped on large jumps
- **Quality chart** — valuable debugging tool showing detection consistency over time
- **Quad validation** — falling back to bounding box when hull produced degenerate quads

## What Failed
1. **No single Canny threshold works for all cards** — The fundamental unsolved problem. Low thresholds (5-30) detect card art internal edges that fragment the interior. High thresholds (80+) miss the card border in poor lighting.
2. **Card art creates internal edges** — Detailed card art (text, images, borders within the card) creates Canny edges inside the enclosed region, splitting it into small fragments instead of one large card-shaped region.
3. **Blur vs edge trade-off** — Higher blur suppresses internal art edges BUT also weakens the card border edge, reducing detection area.
4. **Convex hull instability** — When the enclosed region is fragmented (many small blobs), the convex hull produces irregular shapes that cause the green quad to jitter and the perspective warp to fail.

## Key Mistakes
1. **Kept trying single-threshold approaches** instead of implementing multi-threshold detection early
2. **Removed the convex hull (regression)** — When the hull produced bad quads, I removed it entirely instead of fixing the validation. The user needed perspective adaptation.
3. **Didn't implement bounding box expansion** properly — The expansion through walls (to merge adjacent strips) was a good idea but the implementation wasn't robust enough
4. **Spent too long on each iteration** — Should have iterated faster with the screenshot-based testing loop
5. **Overconfidence in screenshots** — Claimed detection was working when zooming into the preview showed it was actually blurry/wrong
6. **Didn't use the quality chart early enough** — It was a late addition; should have been the first debugging tool

## What Should Have Been Done
1. **Multi-threshold Canny** — Run detection at 3 different Canny levels per frame (low: 20/60, medium: 50/150, high: 80/200). Pick the result with the highest quality score (rectFill * aspect * area). Cost: ~2ms extra.
2. **Adaptive thresholding** — Instead of fixed Canny thresholds, compute them relative to the image's gradient statistics (e.g., median gradient magnitude).
3. **Combined approaches** — Run flood-fill AND dark-blob detection in parallel, merge results. Dark cards detected by brightness thresholding, light cards by edge-enclosed regions.
4. **Better blur strategy** — Use a separate stronger blur specifically for the contour detection (not sharing with the display blur). This was tried but abandoned too early.
5. **Frame persistence** — Keep showing the last good detection for longer (5-10 frames grace period) to smooth over brief drops. Was implemented but needs longer grace.

## Technical Notes
- At 4x downscale (160x120), each cell is 4x4 pixels. A 1px Canny edge produces ~1 edge pixel per cell, so the expanded downsample (checking ds+2 area per cell) is essential.
- The flood-fill BFS uses pre-allocated Int32Array queues to avoid GC pauses.
- Color perspective warp with bilinear interpolation costs ~0.8-1.0ms at 125x175 output.
- The `getPerspectiveTransform` function computes an 8-parameter homography via Gaussian elimination.
- The `sortCorners` function orders 4 points as TL, TR, BR, BL using angle-from-center sorting.

## For Next Game
- Start with multi-threshold detection from the beginning
- Implement the quality chart immediately for real-time feedback
- Test with multiple card types early (dark art, light art, colorful, simple)
- Don't remove working features (convex hull) — fix them instead
- Zoom into the "Detected Card" preview before claiming success
