# Pipeline Display Decoupling + Constants Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple processing resolution from display resolution, extract all magic numbers into constants, and reorganize the workbench UI with main/advanced controls.

**Architecture:** Offscreen canvas for scaled processing; display canvas at full resolution; all debug drawing moved from pipeline to DebugCanvas; constants in shared config; 8 main sliders + Sheet drawer for advanced settings.

**Tech Stack:** TypeScript, React, shadcn-ui Sheet (already installed), jsfeat.

---

### Task 1: Create detection-constants.ts

**Files:**
- Create: `demo/src/lib/detection-constants.ts`

- [ ] **Step 1: Create the constants file**

```typescript
// demo/src/lib/detection-constants.ts

/**
 * All card detection pipeline constants in one place.
 * Used by demos.ts (processing), DetectionPanel.tsx (UI controls), and DevPage.tsx (defaults).
 */

export const DETECTION_DEFAULTS = {
  // --- Main controls (visible in panel) ---
  blurKernel: 9,
  cannyLow: 20,
  cannyHigh: 60,
  minContourArea: 1000,
  morphRadius: 5,
  erosionRadius: 2,
  scharrThreshold: 30,
  warmthThreshold: 25,

  // --- Advanced controls (in Sheet drawer) ---
  // Preprocessing
  equalizationThreshold: 100,
  minBlurKernel: 15,

  // Edge detection
  chromaThreshold: 30,
  warmthBorderMargin: 30,

  // Morphology
  morphThresholdBias: 7,
  morphThresholdMin: 8,
  morphSmoothing: 0.7,
  erosionThreshold: 200,

  // Contour filtering
  minAreaRatio: 0.03,
  maxAreaRatio: 0.4,
  borderMargin: 3,
  minAspect: 0.35,
  targetAspect: 5 / 7,
  sideRatioMin: 0.2,

  // Corner refinement
  refineSamples: 16,
  refineScanMin: -40,
  refineScanMax: 15,
  lineFitFactor: 0.9,
  lineFitMaxShift: 30,

  // Temporal
  smoothingFactor: 0.7,
  jumpThreshold: 80,
  graceFrames: 12,
  persistenceDistance: 100,
  persistenceBoost: 1.5,
} as const;

export type DetectionParamKey = keyof typeof DETECTION_DEFAULTS;
export type DetectionParams = Record<DetectionParamKey, number>;

/** Slider definitions for the main controls panel (2-col grid, always visible). */
export const MAIN_SLIDERS: { key: DetectionParamKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'blurKernel', label: 'Blur Kernel', min: 3, max: 21, step: 2 },
  { key: 'cannyLow', label: 'Canny Low', min: 5, max: 100, step: 1 },
  { key: 'cannyHigh', label: 'Canny High', min: 20, max: 250, step: 1 },
  { key: 'minContourArea', label: 'Min Area', min: 200, max: 50000, step: 100 },
  { key: 'morphRadius', label: 'Morph Radius', min: 2, max: 12, step: 1 },
  { key: 'erosionRadius', label: 'Erosion Radius', min: 1, max: 5, step: 1 },
  { key: 'scharrThreshold', label: 'Scharr Thresh', min: 10, max: 80, step: 1 },
  { key: 'warmthThreshold', label: 'Warmth Thresh', min: 10, max: 60, step: 1 },
];

/** Slider definitions for advanced settings (in Sheet drawer). */
export const ADVANCED_SLIDERS: { section: string; sliders: { key: DetectionParamKey; label: string; min: number; max: number; step: number }[] }[] = [
  {
    section: 'Preprocessing',
    sliders: [
      { key: 'equalizationThreshold', label: 'Equalize Thresh', min: 50, max: 200, step: 5 },
      { key: 'minBlurKernel', label: 'Min Blur Kernel', min: 7, max: 21, step: 2 },
    ],
  },
  {
    section: 'Edge Detection',
    sliders: [
      { key: 'chromaThreshold', label: 'Chroma Thresh', min: 10, max: 60, step: 1 },
      { key: 'warmthBorderMargin', label: 'Color Border Margin', min: 10, max: 80, step: 5 },
    ],
  },
  {
    section: 'Morphology',
    sliders: [
      { key: 'morphThresholdBias', label: 'Morph Bias', min: 0, max: 20, step: 1 },
      { key: 'morphSmoothing', label: 'Morph Smoothing', min: 0.1, max: 0.95, step: 0.05 },
      { key: 'erosionThreshold', label: 'Erosion Thresh', min: 100, max: 250, step: 10 },
    ],
  },
  {
    section: 'Contour Filtering',
    sliders: [
      { key: 'minAspect', label: 'Min Aspect', min: 0.2, max: 0.6, step: 0.05 },
      { key: 'maxAreaRatio', label: 'Max Area %', min: 0.2, max: 0.6, step: 0.05 },
      { key: 'sideRatioMin', label: 'Side Ratio Min', min: 0.1, max: 0.5, step: 0.05 },
    ],
  },
  {
    section: 'Corner Refinement',
    sliders: [
      { key: 'refineScanMin', label: 'Scan Out', min: -80, max: -5, step: 5 },
      { key: 'refineScanMax', label: 'Scan In', min: 5, max: 40, step: 5 },
      { key: 'lineFitFactor', label: 'Line Fit Factor', min: 0.1, max: 1.5, step: 0.1 },
    ],
  },
  {
    section: 'Temporal',
    sliders: [
      { key: 'smoothingFactor', label: 'Smoothing', min: 0.1, max: 0.95, step: 0.05 },
      { key: 'jumpThreshold', label: 'Jump Thresh', min: 20, max: 200, step: 10 },
      { key: 'graceFrames', label: 'Grace Frames', min: 0, max: 30, step: 1 },
    ],
  },
];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd demo && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add demo/src/lib/detection-constants.ts
git commit -m "feat(workbench): create detection-constants.ts with all pipeline params"
```

---

### Task 2: Refactor demos.ts — remove drawing, use constants

**Files:**
- Modify: `demo/src/lib/demos.ts`

This is the largest task. Two changes: (1) replace all magic numbers with `_cardParams.xxx` lookups, (2) remove all `ctx` drawing code from `process()`.

- [ ] **Step 1: Import constants and update setup**

Add import at top of file:
```typescript
import { DETECTION_DEFAULTS } from '@/lib/detection-constants';
```

Update `cardDetectionDemo.setup()` to spread DETECTION_DEFAULTS:
```typescript
setup(_canvas, _video, params) {
  _cardParams = { ...DETECTION_DEFAULTS, ...params };
},
```

Update controls array to match MAIN_SLIDERS keys (or remove controls from demos.ts entirely since they'll be defined in detection-constants.ts — the UI reads from there).

- [ ] **Step 2: Replace magic numbers with params**

Throughout the `process()` method, replace hardcoded values:

| Before | After |
|--------|-------|
| `100` (equalization check) | `_cardParams.equalizationThreshold` |
| `Math.max(ks, 15)` | `Math.max(ks, _cardParams.minBlurKernel)` |
| `mag > 30` (scharr) | `mag > _cardParams.scharrThreshold` |
| `wmag > 25` (warmth) | `wmag > _cardParams.warmthThreshold` |
| `cmag > 30` (chroma) | `cmag > _cardParams.chromaThreshold` |
| `px < 30 \|\| py < 30...` (border) | `px < _cardParams.warmthBorderMargin...` |
| `boxBlurGray(..., 5)` (morph) | `boxBlurGray(..., _cardParams.morphRadius)` |
| `meanDensity + 7` | `meanDensity + _cardParams.morphThresholdBias` |
| `Math.max(8, ...)` | `Math.max(_cardParams.morphThresholdMin, ...)` |
| `* 0.7 + ... * 0.3` | `* _cardParams.morphSmoothing + ... * (1 - _cardParams.morphSmoothing)` |
| `boxBlurGray(..., 2)` (erosion) | `boxBlurGray(..., _cardParams.erosionRadius)` |
| `> 200` (erosion thresh) | `> _cardParams.erosionThreshold` |
| `w * h * 0.03` (min area) | `w * h * _cardParams.minAreaRatio` |
| `w * h * 0.4` (max area) | `w * h * _cardParams.maxAreaRatio` |
| `br.x <= 3` (border) | `br.x <= _cardParams.borderMargin` |
| `aspect < 0.35` | `aspect < _cardParams.minAspect` |
| `5 / 7` (target aspect) | `_cardParams.targetAspect` |
| `maxS * 0.2` (side ratio) | `maxS * _cardParams.sideRatioMin` |
| `16` (refine samples) | `_cardParams.refineSamples` |
| `sd = -40` (scan min) | `sd = _cardParams.refineScanMin` |
| `<= 15` (scan max) | `<= _cardParams.refineScanMax` |
| `* 0.9` (line fit) | `* _cardParams.lineFitFactor` |
| `< 30` (max shift) | `< _cardParams.lineFitMaxShift` |
| `> 80` (jump) | `> _cardParams.jumpThreshold` |
| `* 0.7 + ... * 0.3` (smooth) | `* _cardParams.smoothingFactor + ... * (1 - _cardParams.smoothingFactor)` |
| `> 12` (grace) | `> _cardParams.graceFrames` |
| `< 100` (persistence) | `< _cardParams.persistenceDistance` |
| `1.5` (boost) | `_cardParams.persistenceBoost` |

- [ ] **Step 3: Remove all drawing code from process()**

Delete these sections entirely:
1. **Pipeline thumbnail** (lines ~2225-2242): The `if (_cardShowPipelineOverlays) { ... putImageData ... fillText('pipeline') }` block
2. **Detection quad drawing** (lines ~2566-2586): The `ctx.strokeStyle = '#00ff00'` ... `ctx.beginPath` ... `ctx.stroke` block and corner circles
3. **Warp preview** (lines ~2515-2565): The entire detected card warp rendering block
4. **Status text** (lines ~2589-2600): The `ctx.fillText('Card detected' / 'No card found')` block
5. **Quality chart** (lines ~2618-2634): The chart bars drawing block

Keep the quality score COMPUTATION (just don't draw it — store in `_cardQualityHistory`).

- [ ] **Step 4: Add `detected` field to getCardDebugBuffers()**

```typescript
export function getCardDebugBuffers() {
  return {
    gray: _cardGray,
    edges: _cardEdges,
    blurred: _cardBlurred,
    smoothedCorners: _cardSmoothedCorners,
    debugInfo: _cardDebugInfo,
    qualityHistory: _cardQualityHistory,
    lastRectFill: _cardLastRectFill,
    lastAspect: _cardLastAspect,
    params: _cardParams,
    graceFrames: _cardGraceFrames,
    prevThreshold: _cardPrevThreshold,
    contours: _cardLastContours,
    detected: _cardSmoothedCorners !== null, // NEW
  };
}
```

- [ ] **Step 5: Remove `_cardShowPipelineOverlays` and `setCardPipelineOverlays`**

These are no longer needed since process() no longer draws. Remove the variable declaration, the setter function, and the export. DebugCanvas will handle its own overlay toggles.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npm run build && cd demo && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add demo/src/lib/demos.ts
git commit -m "refactor(detection): remove all drawing from process(), use constants

process() is now a pure data pipeline — no ctx drawing calls.
All magic numbers replaced with _cardParams lookups from DETECTION_DEFAULTS."
```

---

### Task 3: Refactor DebugCanvas — offscreen processing + overlay drawing

**Files:**
- Modify: `demo/src/components/dev/DebugCanvas.tsx`

This adds the offscreen canvas for scaled processing and moves all debug overlay drawing here.

- [ ] **Step 1: Add offscreen canvas ref and drawing helpers**

Add to the component:
```typescript
const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

// Lazily create offscreen canvas
function getOffscreenCanvas(w: number, h: number): HTMLCanvasElement {
  if (!offscreenCanvasRef.current) {
    offscreenCanvasRef.current = document.createElement('canvas');
  }
  const oc = offscreenCanvasRef.current;
  if (oc.width !== w || oc.height !== h) {
    oc.width = w;
    oc.height = h;
  }
  return oc;
}
```

- [ ] **Step 2: Rewrite static image processing useEffect**

Replace the existing image processing useEffect with:
```typescript
useEffect(() => {
  if (isWebcam || !imageSrc) return;
  const displayCanvas = baseCanvasRef.current;
  if (!displayCanvas) return;

  const img = new Image();
  img.onload = () => {
    const s = scale ?? 1;
    // Display canvas at FULL resolution
    const fullW = img.naturalWidth;
    const fullH = img.naturalHeight;
    displayCanvas.width = fullW;
    displayCanvas.height = fullH;
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) { overlayCanvas.width = fullW; overlayCanvas.height = fullH; }

    // Offscreen canvas at SCALED resolution
    const procW = Math.round(fullW * s);
    const procH = Math.round(fullH * s);
    const offscreen = getOffscreenCanvas(procW, procH);
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true })!;

    // Draw to display canvas (full res)
    const displayCtx = displayCanvas.getContext('2d', { willReadFrequently: true })!;
    displayCtx.drawImage(img, 0, 0, fullW, fullH);

    // Draw to offscreen canvas (scaled)
    offCtx.drawImage(img, 0, 0, procW, procH);

    if (!dummyVideoRef.current) dummyVideoRef.current = document.createElement('video');
    resetCardTemporalState();
    cardDetectionDemo.setup(offscreen, dummyVideoRef.current, params);
    setupDoneRef.current = true;

    profiler.frameStart();
    cardDetectionDemo.process(offCtx, dummyVideoRef.current, procW, procH, profiler);
    profiler.frameEnd();

    // Draw overlays on display canvas, mapping coords by 1/scale
    drawOverlays(fullW, fullH, 1 / s);
    reportMetrics(procW * procH);
    onProcessingComplete?.();
  };
  img.src = imageSrc;
}, [imageSrc, isWebcam, scale, retestTick]);
```

- [ ] **Step 3: Rewrite webcam processing loop**

Similar pattern — display canvas at full video resolution, offscreen at scaled:
```typescript
useEffect(() => {
  if (!isWebcam) return;
  const displayCanvas = baseCanvasRef.current;
  const video = videoRef.current;
  if (!displayCanvas || !video) return;

  cardDetectionDemo.setup(displayCanvas, video, params); // initial setup
  setupDoneRef.current = true;

  function loop() {
    const v = videoRef.current;
    const dc = baseCanvasRef.current;
    if (!v || !dc || frozen) { rafRef.current = requestAnimationFrame(loop); return; }
    if (v.readyState < 2 || v.videoWidth === 0) { rafRef.current = requestAnimationFrame(loop); return; }

    const s = scale ?? 1;
    const fullW = v.videoWidth;
    const fullH = v.videoHeight;

    // Display canvas at full video resolution
    if (dc.width !== fullW || dc.height !== fullH) {
      dc.width = fullW; dc.height = fullH;
      const oc = overlayCanvasRef.current;
      if (oc) { oc.width = fullW; oc.height = fullH; }
    }

    // Offscreen at scaled resolution
    const procW = Math.round(fullW * s);
    const procH = Math.round(fullH * s);
    const offscreen = getOffscreenCanvas(procW, procH);
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true })!;

    // Draw video to display canvas (full) and offscreen (scaled)
    const displayCtx = dc.getContext('2d', { willReadFrequently: true })!;
    displayCtx.drawImage(v, 0, 0, fullW, fullH);
    offCtx.drawImage(v, 0, 0, procW, procH);

    profiler.frameStart();
    cardDetectionDemo.process(offCtx, v, procW, procH, profiler);
    profiler.frameEnd();

    drawOverlays(fullW, fullH, 1 / s);
    reportMetrics(procW * procH);

    rafRef.current = requestAnimationFrame(loop);
  }
  rafRef.current = requestAnimationFrame(loop);

  return () => { cancelAnimationFrame(rafRef.current); cardDetectionDemo.cleanup(); setupDoneRef.current = false; };
}, [isWebcam, videoRef, scale]);
```

- [ ] **Step 4: Update drawOverlays to accept coordScale and draw pipeline HUD**

The `drawOverlays` callback now takes a `coordScale` parameter (1/scale) to map detection coordinates to display coordinates. It also draws the pipeline HUD elements that were removed from `process()`:

```typescript
const drawOverlays = useCallback((w: number, h: number, coordScale: number = 1) => {
  const ovCanvas = overlayCanvasRef.current;
  if (!ovCanvas) return;
  const ovCtx = ovCanvas.getContext('2d');
  if (!ovCtx) return;
  ovCtx.clearRect(0, 0, w, h);

  const bufs = getCardDebugBuffers();

  // --- Existing overlays (Canny, Morph, Contours) --- same as before but using bufs

  // --- Detection quad (green frame) ---
  if (bufs.smoothedCorners && bufs.detected) {
    ovCtx.strokeStyle = '#00ff00';
    ovCtx.lineWidth = 2;
    ovCtx.beginPath();
    ovCtx.moveTo(bufs.smoothedCorners[0].x * coordScale, bufs.smoothedCorners[0].y * coordScale);
    for (let i = 1; i < 4; i++) {
      ovCtx.lineTo(bufs.smoothedCorners[i].x * coordScale, bufs.smoothedCorners[i].y * coordScale);
    }
    ovCtx.closePath();
    ovCtx.stroke();

    // Corner dots
    ovCtx.fillStyle = '#00ff00';
    for (const c of bufs.smoothedCorners) {
      ovCtx.beginPath();
      ovCtx.arc(c.x * coordScale, c.y * coordScale, 4, 0, Math.PI * 2);
      ovCtx.fill();
    }
  }

  // --- Status text (fixed 12px) ---
  if (showPipelineHud) {
    ovCtx.font = '12px monospace';
    ovCtx.textAlign = 'left';
    ovCtx.fillStyle = bufs.detected ? '#0f0' : '#f66';
    ovCtx.fillText(
      (bufs.detected ? 'Card detected' : 'No card found') +
      (bufs.debugInfo ? ` | ${bufs.debugInfo}` : ''),
      8, h - 8,
    );
  }

  // --- Quality chart (fixed 120x24px, top-right) ---
  if (showPipelineHud && bufs.qualityHistory?.length) {
    const chartW = Math.min(bufs.qualityHistory.length, 120);
    const chartH = 24;
    const chartX = w - chartW - 8;
    const chartY = 8;
    ovCtx.fillStyle = 'rgba(0,0,0,0.6)';
    ovCtx.fillRect(chartX - 1, chartY - 1, chartW + 2, chartH + 12);
    for (let ci = 0; ci < chartW; ci++) {
      const val = bufs.qualityHistory[bufs.qualityHistory.length - chartW + ci];
      const barH = val * chartH;
      ovCtx.fillStyle = val > 0.35 ? '#0f0' : val > 0.1 ? '#ff0' : '#f00';
      ovCtx.fillRect(chartX + ci, chartY + chartH - barH, 1, barH);
    }
    ovCtx.fillStyle = '#aaa'; ovCtx.font = '8px monospace';
    const lastQ = bufs.qualityHistory[bufs.qualityHistory.length - 1] ?? 0;
    ovCtx.fillText(`quality: ${(lastQ * 100).toFixed(0)}%`, chartX, chartY + chartH + 9);
  }

  // --- Ground truth overlay (unchanged) ---
  // ... keep existing ground truth drawing code
}, [showCanny, showMorph, showContours, showPipelineHud, showGroundTruth, ...]);
```

- [ ] **Step 5: Remove Pipeline HUD toggle state, replace with simpler `showPipelineHud`**

Remove the `setCardPipelineOverlays` import and calls. The `showPipelineHud` toggle is now local to DebugCanvas (no need to pass to the pipeline).

- [ ] **Step 6: Update reportMetrics to use `bufs.detected`**

```typescript
onMetricsUpdate({
  detected: bufs.detected ?? false,  // Use new field instead of debugInfo check
  // ... rest unchanged
});
```

- [ ] **Step 7: Verify and commit**

```bash
cd demo && npx tsc --noEmit
git add demo/src/components/dev/DebugCanvas.tsx
git commit -m "refactor(workbench): offscreen processing canvas + all overlay drawing in DebugCanvas"
```

---

### Task 4: Refactor DetectionPanel — metrics above controls, 2-col grid, Sheet drawer

**Files:**
- Modify: `demo/src/components/dev/DetectionPanel.tsx`

- [ ] **Step 1: Rewrite DetectionPanel with new layout**

Import constants and Sheet:
```typescript
import { DETECTION_DEFAULTS, MAIN_SLIDERS, ADVANCED_SLIDERS } from '@/lib/detection-constants';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
```

Update `DEFAULT_PARAMS` export to use DETECTION_DEFAULTS:
```typescript
export const DEFAULT_PARAMS: Record<string, number> = { ...DETECTION_DEFAULTS };
```

New layout order:
1. **Metrics section** (moved to top)
2. **Controls section** (8 sliders in 2-col grid)
3. **Advanced Settings button** (opens Sheet)

The Sheet uses `modal={false}` for non-blocking interaction:
```tsx
<Sheet modal={false}>
  <SheetTrigger asChild>
    <Button variant="outline" size="sm" className="w-full">
      <span className="mr-1">⚙</span> Advanced Settings
    </Button>
  </SheetTrigger>
  <SheetContent side="right" className="overflow-y-auto w-80">
    <SheetHeader>
      <SheetTitle>Advanced Detection Settings</SheetTitle>
    </SheetHeader>
    <div className="space-y-4 mt-4">
      {ADVANCED_SLIDERS.map(({ section, sliders }) => (
        <div key={section}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{section}</h4>
          <div className="space-y-2">
            {sliders.map(({ key, label, min, max, step }) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px]">{label}</Label>
                  <span className="text-[10px] font-mono">{params[key] ?? DETECTION_DEFAULTS[key]}</span>
                </div>
                <Slider min={min} max={max} step={step}
                  value={[params[key] ?? DETECTION_DEFAULTS[key]]}
                  onValueChange={(v) => onParamChange(key, Array.isArray(v) ? v[0] : v)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full mt-4" onClick={onResetParams}>
        Reset All to Defaults
      </Button>
    </div>
  </SheetContent>
</Sheet>
```

Main controls use a 2-col responsive grid:
```tsx
<div className="grid grid-cols-2 gap-x-3 gap-y-2">
  {MAIN_SLIDERS.map(({ key, label, min, max, step }) => (
    <div key={key} className="space-y-0.5">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">{label}</Label>
        <span className="text-[10px] font-mono">{params[key] ?? DETECTION_DEFAULTS[key]}</span>
      </div>
      <Slider min={min} max={max} step={step}
        value={[params[key] ?? DETECTION_DEFAULTS[key]]}
        onValueChange={(v) => onParamChange(key, Array.isArray(v) ? v[0] : v)}
      />
    </div>
  ))}
</div>
```

- [ ] **Step 2: Verify and commit**

```bash
cd demo && npx tsc --noEmit
git add demo/src/components/dev/DetectionPanel.tsx
git commit -m "refactor(workbench): metrics above controls, 2-col slider grid, Sheet advanced settings"
```

---

### Task 5: Update PipelineStages — 3-column row

**Files:**
- Modify: `demo/src/components/dev/PipelineStages.tsx`

- [ ] **Step 1: Change grid from 2-col to 3-col row**

Replace:
```tsx
<div className="grid grid-cols-2 gap-1">
```
with:
```tsx
<div className="grid grid-cols-3 sm:grid-cols-3 gap-1">
```

This makes the 3 pipeline stages display in a single horizontal row (Canny Edges, Morph Density, Morph Mask).

- [ ] **Step 2: Verify and commit**

```bash
cd demo && npx tsc --noEmit
git add demo/src/components/dev/PipelineStages.tsx
git commit -m "fix(workbench): pipeline stages in 3-column row"
```

---

### Task 6: Update DevPage — extended params, primary Run All

**Files:**
- Modify: `demo/src/pages/DevPage.tsx`

- [ ] **Step 1: Import from detection-constants instead of DetectionPanel**

```typescript
import { DETECTION_DEFAULTS } from '@/lib/detection-constants';
```

Update `DEFAULT_PARAMS` usage:
```typescript
const [params, setParams] = useState<Record<string, number>>({ ...DETECTION_DEFAULTS });
```

Update `handleResetParams`:
```typescript
const handleResetParams = useCallback(() => {
  setParams({ ...DETECTION_DEFAULTS });
  for (const [key, value] of Object.entries(DETECTION_DEFAULTS)) {
    cardDetectionDemo.onParamChange?.(key, value);
  }
}, []);
```

- [ ] **Step 2: Remove `setCardPipelineOverlays` import and calls**

The Pipeline HUD toggle is now internal to DebugCanvas. Remove from DevPage:
- The `setCardPipelineOverlays` import
- Any `setCardPipelineOverlays(...)` calls

- [ ] **Step 3: Make Run All button primary**

In the TestImageStrip component or where the Run All button is rendered, change its variant. If Run All is in TestImageStrip, update that component. If it's passed as a prop, update the rendering.

Find the Run All button and ensure it uses `variant="default"` (primary filled):
```tsx
<Button onClick={onRunAll} disabled={running} variant="default">
  {running ? 'Running...' : 'Run All'}
</Button>
```

- [ ] **Step 4: Verify and commit**

```bash
cd demo && npx tsc --noEmit
git add demo/src/pages/DevPage.tsx demo/src/components/dev/TestImageStrip.tsx
git commit -m "refactor(workbench): use DETECTION_DEFAULTS, primary Run All button"
```

---

### Task 7: Integration testing

- [ ] **Step 1: Verify workbench loads without errors**

Open `/#/dev` in browser. Check console for errors. Verify:
- Pipeline stages show in 3-column row
- Metrics section is above controls
- 8 sliders visible in 2-col grid
- Advanced Settings button opens Sheet drawer (non-modal)
- Run All button is primary (filled)
- Scale dropdown works (10%-100%)

- [ ] **Step 2: Test display/processing decoupling**

1. Select a test image at 100% — verify detection works normally
2. Change to 50% — verify:
   - Display image stays at full resolution (crisp)
   - Green detection quad is at correct position (not shifted)
   - Pipeline stages show smaller resolution data
   - Processing is ~4x faster (check profiler timings)
3. Change to 25% — same checks, even faster processing
4. Switch to webcam — verify scale applies to webcam processing too

- [ ] **Step 3: Run All at 50px threshold**

Click Run All. Verify score is still 37/48. The decoupling must not change detection accuracy.

- [ ] **Step 4: Test advanced settings**

Open Advanced Settings drawer. Change a param (e.g., morph radius 5→4). Verify it takes effect immediately (Retest shows different result). Reset All restores defaults.

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "feat(workbench): pipeline display decoupling + constants refactor complete

- Processing runs on offscreen canvas at selected scale
- Display always at full resolution
- All debug drawing in DebugCanvas, not in pipeline
- 30+ constants extracted to detection-constants.ts
- 8 main sliders + Advanced Settings Sheet drawer
- Metrics above controls, 3-col pipeline stages, primary Run All"
```
