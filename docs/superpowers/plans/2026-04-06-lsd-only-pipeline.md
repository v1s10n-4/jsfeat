# LSD-Only Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the morph blob card detection pipeline with a pure LSD-based pipeline and add LSD debug visualization to the workbench.

**Architecture:** Rewrite `cardDetectionDemo.process()` to run Scharr→LSD on 3 color channels, merge segments, group into quadrilaterals. Update DebugCanvas with LSD segment overlay. Update PipelineStages with gradient/segments/quad views.

**Tech Stack:** TypeScript, jsfeat `scharrDerivatives` + `detectLineSegments`, React workbench.

---

### Task 1: Rewrite cardDetectionDemo pipeline to LSD-only

**Files:**
- Modify: `demo/src/lib/demos.ts`

This is the core task. Rewrite the `process()` method of `cardDetectionDemo` to use LSD instead of morph blob. Also update controls, setup, debug buffers, and state variables.

- [ ] **Step 1: Update imports — remove unused, keep needed**

At the top of the file (~line 9-23), the import from `jsfeat/imgproc` should become:

```typescript
import {
  grayscale as jfGrayscale,
  gaussianBlur,
  scharrDerivatives,
  equalizeHistogram,
  detectLineSegments,
} from 'jsfeat/imgproc';
import type { LineSegment } from 'jsfeat/imgproc';
```

Remove: `boxBlurGray`, `pyrDown`, `cannyEdges`, `sobelDerivatives`, `warpAffine`, `findContours`, `approxPoly`, `adaptiveThreshold`, `AdaptiveMethod`.

Note: Some of these imports may be used by OTHER demos in this file (boxBlurDemo, cannyDemo, etc). Only remove imports that are NOT used anywhere else in the file. Check with a search before removing. If `boxBlurGray` is used by `boxBlurDemo`, keep it. The key ones to add are `detectLineSegments` and `LineSegment` (if not already imported).

- [ ] **Step 2: Update module-level state variables**

Find the card detection state variables (around lines 1970-1988). Replace/update:

```typescript
// Remove these (no longer needed):
// let _cardPrevThreshold = 0;
// let _cardLastContours: Contour[] = [];

// Add these:
let _cardLsdSegments: LineSegment[] = [];
let _cardLsdWinningLines: LineSegment[] = [];
```

Keep: `_cardGray`, `_cardBlurred`, `_cardEdges`, `_cardScharr`, `_cardSmoothedCorners`, `_cardGraceFrames`, `_cardDebugInfo`, `_cardQualityHistory`, `_cardLastRectFill`, `_cardLastAspect`, `_cardParams`, `_cardShowPipelineOverlays`.

- [ ] **Step 3: Update controls array**

Replace the controls array (~line 2298-2303):

```typescript
controls: [
  { type: 'slider', key: 'blurKernel', label: 'Blur Kernel', min: 3, max: 21, step: 2, defaultNum: 9 },
  { type: 'slider', key: 'lsdMinLength', label: 'LSD Min Length', min: 10, max: 200, step: 5, defaultNum: 40 },
  { type: 'slider', key: 'minContourArea', label: 'Min Area', min: 200, max: 50000, step: 100, defaultNum: 1000 },
],
```

- [ ] **Step 4: Update setup() defaults**

```typescript
setup(_canvas, _video, params) {
  _cardParams = {
    blurKernel: 9, lsdMinLength: 40, minContourArea: 1000,
    ...params,
  };
},
```

- [ ] **Step 5: Rewrite process() method**

Replace the ENTIRE process() body (from `process(ctx, video, w, h, profiler) {` to the closing `}`) with this new LSD-only pipeline:

```typescript
process(ctx, video, w, h, profiler) {
  // --- Frame setup (unchanged) ---
  if (video.readyState >= 2) {
    drawVideoFrame(ctx, video, w, h);
  }
  const imageData = ctx.getImageData(0, 0, w, h);

  // --- Buffer allocation ---
  if (!_cardGray || _cardGray.cols !== w || _cardGray.rows !== h) {
    _cardGray = new Matrix(w, h, U8C1);
    _cardBlurred = new Matrix(w, h, U8C1);
    _cardEdges = new Matrix(w, h, U8C1);
  }
  if (!_cardScharr) _cardScharr = new Matrix(w, h, S32C2);
  _cardScharr.resize(w, h, 2);

  // --- Grayscale ---
  profiler.start('grayscale');
  jfGrayscale(new Uint8Array(imageData.data.buffer), w, h, _cardGray);
  profiler.end('grayscale');

  // --- Conditional histogram equalization for dark images ---
  const gd = _cardGray!.data;
  let brightSum = 0;
  for (let i = 0; i < w * h; i++) brightSum += gd[i];
  if (brightSum / (w * h) < 100) {
    equalizeHistogram(_cardGray!, _cardGray!);
  }

  // --- Gaussian blur ---
  profiler.start('blur');
  let ks = _cardParams.blurKernel ?? 9;
  if (ks % 2 === 0) ks += 1;
  const detKs = Math.max(ks, 15) | 1;
  gaussianBlur(_cardGray, _cardBlurred!, detKs, 0);
  profiler.end('blur');

  // --- Multi-channel LSD ---
  profiler.start('lsd');
  const minLen = _cardParams.lsdMinLength ?? 40;
  const rgba = imageData.data;
  const allSegments: LineSegment[] = [];

  // Channel 1: Grayscale Scharr
  scharrDerivatives(_cardBlurred!, _cardScharr!);
  const graySegs = detectLineSegments(_cardScharr!, minLen, 5);
  allSegments.push(...graySegs);

  // Channel 2: Warmth (R-B)
  const cbd = _cardEdges!.data; // reuse as temp buffer
  for (let i = 0; i < w * h; i++) {
    cbd[i] = Math.min(255, Math.max(0, 128 + rgba[i * 4] - rgba[i * 4 + 2]));
  }
  gaussianBlur(_cardEdges!, _cardEdges!, detKs, 0);
  scharrDerivatives(_cardEdges!, _cardScharr!);
  const warmSegs = detectLineSegments(_cardScharr!, minLen, 5);
  allSegments.push(...warmSegs);

  // Channel 3: Chroma (max-min RGB)
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    cbd[i] = Math.max(r, g, b) - Math.min(r, g, b);
  }
  gaussianBlur(_cardEdges!, _cardEdges!, detKs, 0);
  scharrDerivatives(_cardEdges!, _cardScharr!);
  const chromaSegs = detectLineSegments(_cardScharr!, minLen, 5);
  allSegments.push(...chromaSegs);

  // Sort by length, cap at 300
  allSegments.sort((a, b) => b.length - a.length);
  const mergedSegments = allSegments.slice(0, 300);
  _cardLsdSegments = mergedSegments;

  // Restore grayscale Scharr for any future use
  scharrDerivatives(_cardBlurred!, _cardScharr!);
  profiler.end('lsd');

  // --- Quadrilateral grouping ---
  profiler.start('quad');
  let detected = false;
  let cardCorners: { x: number; y: number }[] = [];
  _cardDebugInfo = '';
  _cardLsdWinningLines = [];

  const quadResult = findCardQuadrilateral(mergedSegments, w, h);
  if (quadResult) {
    detected = true;
    cardCorners = quadResult;
    _cardDebugInfo = `segs=${mergedSegments.length} g=${graySegs.length} w=${warmSegs.length} c=${chromaSegs.length}`;
  }
  profiler.end('quad');

  // --- Debug: Pipeline HUD overlay ---
  if (_cardShowPipelineOverlays) {
    // Gradient magnitude thumbnail (top-left)
    const sd = _cardScharr!.data;
    const ds = 4, dw = (w / ds) | 0, dh = (h / ds) | 0;
    const di = ctx.createImageData(dw, dh);
    const dd = di.data;
    for (let dy = 0; dy < dh; dy++) {
      for (let dx = 0; dx < dw; dx++) {
        const si = (dy * ds) * w + (dx * ds);
        const mag = Math.min(255, (Math.abs(sd[si * 2]) + Math.abs(sd[si * 2 + 1])) >> 3);
        const oi = (dy * dw + dx) * 4;
        dd[oi] = 0; dd[oi + 1] = mag; dd[oi + 2] = 0; dd[oi + 3] = 200;
      }
    }
    ctx.putImageData(di, 4, 4);
    ctx.strokeStyle = '#0f0'; ctx.lineWidth = 1;
    ctx.strokeRect(3, 3, dw + 2, dh + 2);
    ctx.fillStyle = '#0f0'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText('gradient', 6, dh + 16);

    // Draw LSD segments on main canvas
    ctx.lineWidth = 1;
    for (const seg of mergedSegments) {
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    }

    // Detection status text
    ctx.font = '12px monospace'; ctx.textAlign = 'left';
    if (detected) {
      ctx.fillStyle = '#0f0';
      ctx.fillText(`Card detected | ${_cardDebugInfo}`, 6, h - 8);
    } else {
      ctx.fillStyle = '#f00';
      ctx.fillText(`No card found | segs=${mergedSegments.length}`, 6, h - 8);
    }

    // Draw detected quad
    if (detected && _cardShowPipelineOverlays) {
      ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardCorners[0].x, cardCorners[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(cardCorners[i].x, cardCorners[i].y);
      ctx.closePath();
      ctx.stroke();

      // Warp preview thumbnail
      // (keep existing warp preview code if desired, or skip for now)
    }

    // Quality history chart (top-right) — keep existing pattern
    const qh = _cardQualityHistory;
    if (detected) {
      const rectFill = 0; // placeholder — LSD doesn't produce rectFill
      const aspect = cardCorners.length === 4 ? (() => {
        const sides: number[] = [];
        for (let i = 0; i < 4; i++) {
          const a = cardCorners[i], b = cardCorners[(i + 1) % 4];
          sides.push(Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2));
        }
        return Math.min((sides[0]+sides[2])/2, (sides[1]+sides[3])/2) /
               Math.max((sides[0]+sides[2])/2, (sides[1]+sides[3])/2);
      })() : 0;
      _cardLastRectFill = rectFill;
      _cardLastAspect = aspect;
      const q = Math.max(0, 1 - Math.abs(aspect - 5/7) * 3);
      qh.push(q);
      if (qh.length > 60) qh.shift();
    }
  }

  // --- Temporal smoothing (unchanged from original) ---
  const SMOOTHING = 0.7;
  if (detected && cardCorners.length === 4) {
    _cardGraceFrames = 0;
    if (_cardSmoothedCorners) {
      let maxJump = 0;
      for (let i = 0; i < 4; i++) {
        const dx2 = cardCorners[i].x - _cardSmoothedCorners[i].x;
        const dy2 = cardCorners[i].y - _cardSmoothedCorners[i].y;
        maxJump = Math.max(maxJump, Math.sqrt(dx2 * dx2 + dy2 * dy2));
      }
      if (maxJump > 80) {
        _cardSmoothedCorners = cardCorners.map(p => ({ ...p }));
      } else {
        for (let i = 0; i < 4; i++) {
          _cardSmoothedCorners[i].x = _cardSmoothedCorners[i].x * SMOOTHING + cardCorners[i].x * (1 - SMOOTHING);
          _cardSmoothedCorners[i].y = _cardSmoothedCorners[i].y * SMOOTHING + cardCorners[i].y * (1 - SMOOTHING);
        }
      }
      cardCorners = _cardSmoothedCorners;
    } else {
      _cardSmoothedCorners = cardCorners.map(p => ({ ...p }));
    }
  } else if (!detected && _cardSmoothedCorners) {
    _cardGraceFrames++;
    if (_cardGraceFrames > 12) {
      _cardSmoothedCorners = null;
      _cardGraceFrames = 0;
    } else {
      detected = true;
      cardCorners = _cardSmoothedCorners;
    }
  }

  // --- Final output (draw smoothed detection on canvas if not pipeline HUD) ---
  if (detected && cardCorners.length === 4 && !_cardShowPipelineOverlays) {
    ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardCorners[0].x, cardCorners[0].y);
    for (let ci = 1; ci < 4; ci++) ctx.lineTo(cardCorners[ci].x, cardCorners[ci].y);
    ctx.closePath();
    ctx.stroke();
  }
},
```

- [ ] **Step 6: Update getCardDebugBuffers()**

Replace the function (~line 2909):

```typescript
export function getCardDebugBuffers() {
  return {
    gray: _cardGray,
    edges: _cardEdges,
    blurred: _cardBlurred,
    scharr: _cardScharr,
    smoothedCorners: _cardSmoothedCorners,
    debugInfo: _cardDebugInfo,
    qualityHistory: _cardQualityHistory,
    lastRectFill: _cardLastRectFill,
    lastAspect: _cardLastAspect,
    params: _cardParams,
    graceFrames: _cardGraceFrames,
    lsdSegments: _cardLsdSegments,
    lsdWinningLines: _cardLsdWinningLines,
  };
}
```

- [ ] **Step 7: Update resetCardTemporalState()**

```typescript
export function resetCardTemporalState() {
  _cardSmoothedCorners = null;
  _cardGraceFrames = 0;
  _cardQualityHistory.length = 0;
  _cardLsdSegments = [];
  _cardLsdWinningLines = [];
}
```

- [ ] **Step 8: Update findCardQuadrilateral to remove morphDensity parameter**

Change the function signature (~line 2099) from:
```typescript
function findCardQuadrilateral(
  segments: LineSegment[],
  w: number,
  h: number,
  morphDensity?: Uint8Array | null,
```
to:
```typescript
function findCardQuadrilateral(
  segments: LineSegment[],
  w: number,
  h: number,
```

Remove the `morphDensity` filter logic inside (the `if (morphDensity)` block and the fallback retry).

- [ ] **Step 9: Remove old cleanup() references to removed variables**

In the `cleanup()` method, ensure `_cardPrevThreshold` and `_cardLastContours` references are removed.

- [ ] **Step 10: Build library and verify**

Run: `npm run build && cd demo && npx tsc --noEmit`
Expected: No TypeScript errors.

- [ ] **Step 11: Commit**

```bash
git add demo/src/lib/demos.ts
git commit -m "feat(detection): rewrite card detection pipeline to LSD-only

Removes morph blob approach (Canny, box blur morph, findContours,
convex hull, approxPoly, edge refinement). Replaces with multi-channel
LSD: Scharr gradients on grayscale/warmth/chroma → detectLineSegments
→ merge segments → findCardQuadrilateral.

Includes pipeline HUD with gradient thumbnail and LSD segment overlay."
```

---

### Task 2: Update DebugCanvas for LSD overlay

**Files:**
- Modify: `demo/src/components/dev/DebugCanvas.tsx`

Replace the Canny/Morph/Contour overlays with a single LSD Segments overlay.

- [ ] **Step 1: Update overlay toggle state**

Replace the overlay state variables (~line 136-141):

```typescript
const [showLsdSegments, setShowLsdSegments] = useState(true);
const [showPipelineOverlays, setShowPipelineOverlays] = useState(true);
const [showGroundTruth, setShowGroundTruth] = useState(true);
```

Remove: `showCanny`, `showMorph`, `showContours` states.

- [ ] **Step 2: Update drawOverlays function**

In the `drawOverlays` callback (~line 537), replace the Canny/Morph/Contour drawing code with LSD segment drawing:

```typescript
// LSD Segments overlay
if (showLsdSegments && bufs.lsdSegments) {
  ovCtx.lineWidth = 1;
  for (const seg of bufs.lsdSegments) {
    ovCtx.strokeStyle = 'rgba(0, 255, 0, 0.4)'; // green
    ovCtx.beginPath();
    ovCtx.moveTo(seg.x1, seg.y1);
    ovCtx.lineTo(seg.x2, seg.y2);
    ovCtx.stroke();
  }
  // Highlight winning lines in cyan (if available)
  if (bufs.lsdWinningLines) {
    ovCtx.lineWidth = 2;
    ovCtx.strokeStyle = '#00ffff';
    for (const seg of bufs.lsdWinningLines) {
      ovCtx.beginPath();
      ovCtx.moveTo(seg.x1, seg.y1);
      ovCtx.lineTo(seg.x2, seg.y2);
      ovCtx.stroke();
    }
  }
}
```

- [ ] **Step 3: Update overlay toggle UI**

Replace the toggle buttons (~line 707-752) with:

```tsx
<div className="flex items-center gap-2">
  <Switch id="lsd-toggle" checked={showLsdSegments} onCheckedChange={setShowLsdSegments} />
  <Label htmlFor="lsd-toggle" className="text-sm" style={{ color: '#00ff00' }}>LSD Segments</Label>
</div>
<div className="flex items-center gap-2">
  <Switch id="hud-toggle" checked={showPipelineOverlays} onCheckedChange={(v) => { setShowPipelineOverlays(v); setCardPipelineOverlays(v); }} />
  <Label htmlFor="hud-toggle" className="text-sm" style={{ color: '#ff6600' }}>Pipeline HUD</Label>
</div>
<div className="flex items-center gap-2">
  <Switch id="gt-toggle" checked={showGroundTruth} onCheckedChange={setShowGroundTruth} />
  <Label htmlFor="gt-toggle" className="text-sm" style={{ color: '#6666ff' }}>Ground truth</Label>
</div>
```

- [ ] **Step 4: Update the DetectionMetrics type**

If the `DetectionMetrics` type references `corners`, ensure it still works with the new buffer shape. The `smoothedCorners` field is unchanged so this should just work.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd demo && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add demo/src/components/dev/DebugCanvas.tsx
git commit -m "feat(workbench): replace Canny/Morph overlays with LSD Segments overlay

Shows all detected line segments in green, winning quad lines in cyan.
Removes Canny edges, Morph blob, and Contours toggles."
```

---

### Task 3: Update PipelineStages for LSD visualization

**Files:**
- Modify: `demo/src/components/dev/PipelineStages.tsx`

Replace the 3 morph-based stages with LSD-specific visualizations.

- [ ] **Step 1: Update stage definitions and rendering**

Replace the STAGES array and rendering logic:

```typescript
import { getCardDebugBuffers } from '@/lib/demos';
import type { LineSegment } from 'jsfeat/imgproc';

const STAGES = [
  { id: 'gradient', label: 'Gradient Magnitude' },
  { id: 'lsd-segments', label: 'LSD Segments' },
  { id: 'winning-quad', label: 'Winning Quad' },
] as const;
```

For the rendering function, update the canvas drawing:

**Gradient Magnitude stage**: Draw Scharr magnitude as grayscale heatmap from `bufs.scharr`:
```typescript
if (stage.id === 'gradient' && bufs.scharr) {
  const sd = bufs.scharr.data;
  const srcW = bufs.scharr.cols;
  for (let dy = 0; dy < sh; dy++) {
    for (let dx = 0; dx < sw; dx++) {
      const si = (Math.floor(dy * srcH / sh) * srcW + Math.floor(dx * srcW / sw));
      const mag = Math.min(255, (Math.abs(sd[si * 2]) + Math.abs(sd[si * 2 + 1])) >> 3);
      const oi = (dy * sw + dx) * 4;
      imgData.data[oi] = mag; imgData.data[oi+1] = mag; imgData.data[oi+2] = mag; imgData.data[oi+3] = 255;
    }
  }
}
```

**LSD Segments stage**: Draw all segments on black background:
```typescript
if (stage.id === 'lsd-segments' && bufs.lsdSegments) {
  // Black background already set
  stageCtx.putImageData(imgData, 0, 0);
  const srcW = bufs.blurred?.cols ?? 1920;
  const srcH2 = bufs.blurred?.rows ?? 1080;
  const scaleX = sw / srcW, scaleY = sh / srcH2;
  stageCtx.lineWidth = 1;
  stageCtx.strokeStyle = '#00ff00';
  for (const seg of bufs.lsdSegments) {
    stageCtx.beginPath();
    stageCtx.moveTo(seg.x1 * scaleX, seg.y1 * scaleY);
    stageCtx.lineTo(seg.x2 * scaleX, seg.y2 * scaleY);
    stageCtx.stroke();
  }
  return; // skip putImageData below since we already drew
}
```

**Winning Quad stage**: Draw the 4 winning lines + quad fill:
```typescript
if (stage.id === 'winning-quad' && bufs.smoothedCorners) {
  stageCtx.putImageData(imgData, 0, 0);
  const srcW = bufs.blurred?.cols ?? 1920;
  const srcH2 = bufs.blurred?.rows ?? 1080;
  const scaleX = sw / srcW, scaleY = sh / srcH2;
  stageCtx.strokeStyle = '#00ff00'; stageCtx.lineWidth = 2;
  stageCtx.beginPath();
  const c = bufs.smoothedCorners;
  stageCtx.moveTo(c[0].x * scaleX, c[0].y * scaleY);
  for (let i = 1; i < 4; i++) stageCtx.lineTo(c[i].x * scaleX, c[i].y * scaleY);
  stageCtx.closePath();
  stageCtx.stroke();
  stageCtx.fillStyle = 'rgba(0, 255, 0, 0.15)';
  stageCtx.fill();
  // Corner dots
  stageCtx.fillStyle = '#ff0';
  for (const p of c) {
    stageCtx.beginPath();
    stageCtx.arc(p.x * scaleX, p.y * scaleY, 3, 0, Math.PI * 2);
    stageCtx.fill();
  }
  return;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd demo && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add demo/src/components/dev/PipelineStages.tsx
git commit -m "feat(workbench): update PipelineStages for LSD visualization

Three stages: Gradient Magnitude, LSD Segments, Winning Quad.
Replaces old Canny Edges, Morph Density, Morph Mask stages."
```

---

### Task 4: Visual testing and parameter tuning

**Files:**
- Modify: `demo/src/lib/demos.ts` (if parameter changes needed)
- Modify: `src/imgproc/lsd.ts` (if LSD algorithm changes needed)

- [ ] **Step 1: Open workbench and verify LSD visualization works**

Navigate to `/#/dev`. Verify:
- LSD Segments toggle shows green lines on the canvas
- Pipeline stages show Gradient/Segments/Quad views
- Detection works on paper-bg images
- Metrics show segment counts

- [ ] **Step 2: Run All at 50px threshold**

Click Run All. Record the score. Compare against baseline 37/48.

- [ ] **Step 3: Investigate individual failures**

For each failing image, click Retest and observe:
- How many segments are detected (shown in metrics)
- Where the segments are (LSD overlay)  
- Whether the quad grouping picks the right 4 lines

Adjust parameters as needed:
- `lsdMinLength` slider in the workbench
- `magnitudeThreshold` in the LSD call (currently 5)
- `ANGLE_GROUP_TOL` in findCardQuadrilateral (currently 15°)
- `MAX_PER_GROUP` (currently 15)
- Border margin in findCardQuadrilateral (currently 8%)

- [ ] **Step 4: Commit tuned parameters**

```bash
git add demo/src/lib/demos.ts src/imgproc/lsd.ts
git commit -m "feat(detection): tune LSD parameters based on workbench testing

Score: XX/48. [describe parameter changes]"
```
