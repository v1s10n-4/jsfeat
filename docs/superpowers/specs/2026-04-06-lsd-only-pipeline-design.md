# LSD-Only Card Detection Pipeline — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the morph blob card detection pipeline with a pure LSD-based pipeline, and add debug visualization so LSD segments are visible in the workbench.

**Architecture:** Scharr gradients on 3 channels (grayscale, warmth, chroma) → LSD line segment detection → merge segments → quadrilateral grouping → temporal smoothing. No Canny, no morph blob, no findContours.

**Tech Stack:** Pure TypeScript, existing jsfeat `scharrDerivatives` + `detectLineSegments`, React workbench overlays.

---

## 1. New Pipeline Flow

```
RGBA Image
  → Grayscale
  → Conditional Histogram Equalization (mean brightness < 100)
  → Gaussian Blur (kernel 15)
  → Scharr Derivatives (grayscale)
  → LSD on grayscale Scharr → segments_gray
  → Compute warmth channel (128 + R - B), blur, Scharr
  → LSD on warmth Scharr → segments_warmth
  → Compute chroma channel (max-min RGB), blur, Scharr
  → LSD on chroma Scharr → segments_chroma
  → Merge all segments, sort by length
  → findCardQuadrilateral() → 4 corners or null
  → Temporal smoothing (EMA, grace frames)
  → Output: detected corners + debug buffers
```

### What stays from current pipeline:
- Grayscale conversion (`jfGrayscale`)
- Conditional histogram equalization (brightness < 100)
- Gaussian blur (kernel 15) 
- Scharr derivatives (`scharrDerivatives`)
- `sortCorners()`, `buildCardCorners()` helpers
- Temporal smoothing + grace frames (SMOOTHING constant, jump threshold 80px)
- `getCardDebugBuffers()` interface (extended with LSD data)
- `setCardPipelineOverlays()` flag
- `resetCardTemporalState()` 
- Pipeline HUD overlay (debug thumbnail, quality chart, status text)
- All `_cardParams` / controls (blur kernel, but remove Canny controls)

### What gets removed:
- Canny edge detection (`cannyEdges`)
- Morph blob (box blur + global threshold + erosion)
- `findContours` 
- Convex hull (Graham scan)
- `approxPoly`
- Edge refinement (perpendicular Canny scan)
- Line fitting on hull segments
- Color edge merge into Canny map (warmth/chroma Scharr merge into `ed`)
- All morph-related variables: `_cardPrevThreshold`, morph density computation

### What changes:
- Controls: remove Canny Low/High sliders, add LSD Min Length slider
- `_cardDebugInfo`: show LSD segment count and winning channel
- Pipeline stages: replace Canny/Morph stages with Gradient/LSD/Quad stages

## 2. Multi-Channel LSD Strategy

Run LSD on all 3 channels, merge all segments into one pool, then find the best quadrilateral from the merged pool. This is different from the current fallback approach (try channels one at a time until one works) — merging gives the grouping more lines to work with.

### Channel computation:
1. **Grayscale**: `scharrDerivatives(_cardBlurred, _cardScharr)` — already blurred
2. **Warmth**: `pixel = clamp(128 + R - B, 0, 255)` → blur → Scharr
3. **Chroma**: `pixel = max(R,G,B) - min(R,G,B)` → blur → Scharr

### Segment merging:
- Concatenate all segments from all 3 channels
- Tag each segment with its source channel (for debug display)
- Sort by length descending
- Cap at 300 total segments (take longest)

## 3. Quadrilateral Grouping

Use the existing `findCardQuadrilateral()` function with these adjustments:

- Remove the `morphDensity` spatial filter (no morph blob in this pipeline)
- Keep the border margin filter (8% from edges)
- Keep all geometric filters (area 3-40%, convexity, aspect ratio)
- Scoring: `area × aspectMatch × totalLineLength`

## 4. Debug Visualization

### 4a. Debug buffers extension

Add to `getCardDebugBuffers()` return type:
```typescript
lsdSegments: LineSegment[];        // all detected segments (merged from all channels)  
lsdWinningLines: LineSegment[];    // the 4 lines forming the winning quad (if detected)
lsdChannel: string;                // 'merged' (or debug info)
```

### 4b. DebugCanvas overlay — "LSD Segments" toggle

New toggle in the overlay controls (alongside Canny edges, Morph blob, Contours):
- **Label**: "LSD Segments"
- **Color**: lime green (`#00ff00`) for all segments, bright cyan (`#00ffff`) for winning 4
- **Drawing**: For each segment, draw a line from (x1,y1) to (x2,y2) with 1px width
- **Winning lines**: Draw with 2px width in cyan, with small circles at intersection corners

### 4c. PipelineStages update

Replace the 3 current debug stages with:
1. **Gradient Magnitude**: Visualize Scharr magnitude (grayscale heatmap)
2. **LSD Segments**: Draw all segments on black background (colored by channel: green=gray, orange=warmth, purple=chroma)
3. **Winning Quad**: Draw the 4 winning lines + filled quad area on black background

### 4d. DetectionPanel metrics

Show in the compact metrics line:
- `segs=N` — total segment count
- `ch=warmth` — which channel contributed winning lines (or "merged")
- Keep existing: `rf`, `asp`, `thr`, `q`, mean distance

## 5. Controls Update

Remove:
- Canny Low slider
- Canny High slider

Add:
- LSD Min Length slider (min: 20, max: 200, step: 5, default: 40)

Keep:
- Blur Kernel slider
- Min Area slider

## 6. File Changes

### Modified files:
- `demo/src/lib/demos.ts` — rewrite `cardDetectionDemo.process()`, update controls, update `getCardDebugBuffers()`
- `demo/src/components/dev/DebugCanvas.tsx` — add LSD Segments overlay toggle and drawing
- `demo/src/components/dev/PipelineStages.tsx` — update stage visualizations

### No changes needed:
- `src/imgproc/lsd.ts` — already implemented
- `src/imgproc/index.ts` — already exports
- `demo/src/pages/DevPage.tsx` — no structural changes
- `demo/src/components/dev/DetectionPanel.tsx` — metrics already display from `_cardDebugInfo`
- `demo/src/components/dev/TestImageStrip.tsx` — no changes

## 7. Performance Target

- LSD on 3 channels: ~30ms total (10ms each at 1920x1080)
- Quad grouping: ~5ms
- Total pipeline: < 80ms (12+ FPS)
- Current morph pipeline: ~100ms — LSD should be similar or faster

## 8. Testing

- Run All at 50px threshold on workbench
- Baseline to match or exceed: 37/48
- Debug visualization must show segments clearly
- Temporal smoothing must work (no jitter on webcam)
- All paper-bg images must still pass (regression check)
