# Detection Debug Workbench Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical bugs (static image pipeline erasure, Run All timing) and add 7 features (contour overlays, corner coords, pipeline overlay toggle, keyboard nav, ground truth annotations, resolution scaling, category indicators) to the detection debug workbench.

**Architecture:** Modify demos.ts to guard drawVideoFrame and expose contours + debug rendering flag. Enhance DebugCanvas with new overlays and resolution scaling. Add ground truth data file and accuracy comparison. Update DevPage with keyboard nav and promise-based Run All.

**Tech Stack:** React 19, TypeScript, jsfeat (local), shadcn/ui, Tailwind CSS 4

---

## File Map

| File | Action | Changes |
|------|--------|---------|
| `demo/src/lib/demos.ts` | Modify | Guard drawVideoFrame, expose contours, add debug rendering flag |
| `demo/src/components/dev/DebugCanvas.tsx` | Modify | Fix static image flow, add contour overlay, resolution scaling, ground truth overlay |
| `demo/src/components/dev/DetectionPanel.tsx` | Modify | Add corner coords, accuracy metric display |
| `demo/src/components/dev/TestImageStrip.tsx` | Modify | Add category indicators |
| `demo/src/pages/DevPage.tsx` | Modify | Promise-based Run All, keyboard nav, resolution state, ground truth toggle |
| `demo/src/lib/test-ground-truth.ts` | Create | Ground truth corner coordinates for all 48 test images |
| `scripts/gen-test-manifest.ts` | Modify | Include ground truth placeholder in manifest |

---

### Task 1: Fix static image erasure (CRITICAL)

The pipeline's `process()` calls `drawVideoFrame(ctx, video, w, h)` on line 2104 of demos.ts. When `video` is a dummy element with no source, this draws a blank frame, erasing the static image already on the canvas. The fix: skip the draw when the video has no content.

**Files:**
- Modify: `demo/src/lib/demos.ts:2104`

- [ ] **Step 1: Guard drawVideoFrame in cardDetectionDemo.process()**

In `demo/src/lib/demos.ts`, replace line 2104:

```typescript
    drawVideoFrame(ctx, video, w, h);
```

with:

```typescript
    // Skip drawVideoFrame when video has no content (e.g., dummy element for static images).
    // The caller is responsible for drawing the frame onto ctx before calling process().
    if (video.readyState >= 2) {
      drawVideoFrame(ctx, video, w, h);
    }
```

This preserves existing behavior for the live demo page (video always has readyState >= 2) while allowing the debug workbench to pre-draw a static image.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/konect/WebstormProjects/jsfeat/demo && npx tsc --noEmit`

- [ ] **Step 3: Visually verify** — Open `/#/dev`, click a test image, confirm the card is visible (not blank) and detection runs. Take a screenshot.

- [ ] **Step 4: Verify the existing demo page still works** — Navigate to `/#/demos/cardDetection`, confirm live webcam detection still functions normally.

- [ ] **Step 5: Commit**

```bash
git add demo/src/lib/demos.ts
git commit -m "fix(demo): skip drawVideoFrame when video has no content (static image support)"
```

---

### Task 2: Add debug rendering toggle to pipeline

The pipeline draws its own debug overlays (thumbnail, quality chart, status text) directly on the canvas. The workbench needs a way to disable these for clean analysis.

**Files:**
- Modify: `demo/src/lib/demos.ts`

- [ ] **Step 1: Add a module-level flag and setter**

After the existing module-level card detection variables (around line 1983), add:

```typescript
let _cardShowPipelineOverlays = true;

/** Toggle the pipeline's built-in debug overlays (thumbnail, quality chart, status text). */
export function setCardPipelineOverlays(show: boolean) {
  _cardShowPipelineOverlays = show;
}
```

- [ ] **Step 2: Wrap the pipeline's debug rendering in the flag check**

In `cardDetectionDemo.process()`, wrap the debug thumbnail section (lines 2151-2169) and the status text + quality chart section (lines 2420-2462) in `if (_cardShowPipelineOverlays)` guards:

Before the debug thumbnail (line 2151):
```typescript
    if (_cardShowPipelineOverlays) {
    // Debug: pipeline output thumbnail (top-left)
    {
```

After the thumbnail closing brace (line 2169), close the if:
```typescript
    }
    } // end pipeline overlays guard
```

Similarly, wrap the status text section (starting at line 2420 `// Status`) through the quality chart end (line 2462) in the same guard.

- [ ] **Step 3: Expose the contour array in getCardDebugBuffers**

The `contours` variable from `findContours` is local to the `process()` function. To expose it, save it to a module-level variable.

Add after the existing module-level variables (line ~1983):
```typescript
let _cardLastContours: Array<{ points: { x: number; y: number }[]; boundingRect: { x: number; y: number; width: number; height: number } }> = [];
```

In `process()`, after the `findContours` call (line 2180), save it:
```typescript
    const contours = findContours(_cardEdges!);
    _cardLastContours = contours;
```

Add to `getCardDebugBuffers()` return object:
```typescript
    contours: _cardLastContours,
```

- [ ] **Step 4: Verify TypeScript compiles and existing demo still works**

- [ ] **Step 5: Commit**

```bash
git add demo/src/lib/demos.ts
git commit -m "feat(demo): add pipeline overlay toggle and expose contour array for debug"
```

---

### Task 3: Fix Run All timing with promise-based flow

Replace the unreliable 300ms setTimeout with a promise that resolves when DebugCanvas actually finishes processing each image.

**Files:**
- Modify: `demo/src/components/dev/DebugCanvas.tsx`
- Modify: `demo/src/pages/DevPage.tsx`

- [ ] **Step 1: Add a processing-complete callback to DebugCanvas**

In `DebugCanvas.tsx`, add to the props interface:
```typescript
  /** Called when static image processing completes (for batch Run All). */
  onProcessingComplete?: () => void;
```

In the static image processing effect (the section that loads an image, draws it, and calls `process()`), call `onProcessingComplete?.()` after `reportMetrics()`.

- [ ] **Step 2: Expose a promise resolver in DevPage**

In `DevPage.tsx`, add a ref for the resolver:
```typescript
const processingResolveRef = useRef<(() => void) | null>(null);

function waitForProcessing(): Promise<void> {
  return new Promise((resolve) => {
    processingResolveRef.current = resolve;
  });
}

function handleProcessingComplete() {
  processingResolveRef.current?.();
  processingResolveRef.current = null;
}
```

Pass `onProcessingComplete={handleProcessingComplete}` to DebugCanvas.

- [ ] **Step 3: Rewrite handleRunAll to use the promise**

```typescript
const handleRunAll = useCallback(async () => {
  if (batchRunning) return;
  setBatchRunning(true);
  const nextVerdicts = { ...verdicts };

  for (const img of testImages) {
    setSelectedImage(img.path);
    await waitForProcessing();
    const m = latestMetricsRef.current;
    nextVerdicts[img.path] = m?.detected ? 'pass' : 'fail';
  }

  setVerdicts(nextVerdicts);
  saveVerdicts(nextVerdicts);
  setBatchRunning(false);
}, [batchRunning, verdicts]);
```

- [ ] **Step 4: Verify — Run All processes all 48 images correctly**

- [ ] **Step 5: Commit**

```bash
git add demo/src/components/dev/DebugCanvas.tsx demo/src/pages/DevPage.tsx
git commit -m "fix(demo): promise-based Run All waits for actual processing completion"
```

---

### Task 4: Contour outlines overlay + corner coordinates

Add cyan contour outlines overlay toggle and display detected corner coordinates in the metrics panel.

**Files:**
- Modify: `demo/src/components/dev/DebugCanvas.tsx`
- Modify: `demo/src/components/dev/DetectionPanel.tsx`

- [ ] **Step 1: Add contour overlay toggle and rendering in DebugCanvas**

Add a third toggle state `showContours` (defaulting to false). In `drawOverlays()`, after the morph overlay section, add:

```typescript
// Contour outlines (cyan)
if (showContoursRef.current && bufs.contours) {
  octx.strokeStyle = 'cyan';
  octx.lineWidth = 1;
  for (const contour of bufs.contours) {
    if (contour.points.length < 3) continue;
    octx.beginPath();
    octx.moveTo(contour.points[0].x, contour.points[0].y);
    for (let i = 1; i < contour.points.length; i++) {
      octx.lineTo(contour.points[i].x, contour.points[i].y);
    }
    octx.closePath();
    octx.stroke();
  }
}
```

Add the toggle switch in the UI alongside the existing Canny and Morph toggles.

- [ ] **Step 2: Add corner coordinates to DetectionMetrics**

Extend the `DetectionMetrics` interface in DebugCanvas.tsx:
```typescript
  corners: { x: number; y: number }[] | null;
```

In `reportMetrics()`, populate:
```typescript
corners: bufs.smoothedCorners ?? null,
```

- [ ] **Step 3: Display corner coordinates in DetectionPanel**

In DetectionPanel.tsx, after the existing metrics grid, add:
```tsx
{metrics.corners && (
  <div className="mt-1">
    <div className="text-[9px] text-muted-foreground">Corners (TL TR BR BL)</div>
    {metrics.corners.map((c, i) => (
      <span key={i} className="text-[9px] font-mono mr-2">
        ({Math.round(c.x)},{Math.round(c.y)})
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 4: Verify overlays render and corners display**

- [ ] **Step 5: Commit**

```bash
git add demo/src/components/dev/DebugCanvas.tsx demo/src/components/dev/DetectionPanel.tsx
git commit -m "feat(demo): add contour overlay (cyan) and corner coordinates display"
```

---

### Task 5: Keyboard navigation + category indicators

Add left/right arrow key navigation for test images and visual category indicators on thumbnails.

**Files:**
- Modify: `demo/src/pages/DevPage.tsx`
- Modify: `demo/src/components/dev/TestImageStrip.tsx`

- [ ] **Step 1: Add keyboard listener to DevPage**

Add a `useEffect` for keyboard navigation:
```typescript
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (isWebcam) return;
    const idx = testImages.findIndex((img) => img.path === selectedImage);
    if (e.key === 'ArrowRight' && idx < testImages.length - 1) {
      setSelectedImage(testImages[idx + 1].path);
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      setSelectedImage(testImages[idx - 1].path);
    }
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedImage, isWebcam]);
```

- [ ] **Step 2: Add category indicator to TestImageStrip thumbnails**

In TestImageStrip.tsx, inside each thumbnail button, add a small category badge overlay:
```tsx
<div
  style={{
    position: 'absolute',
    top: 1,
    left: 1,
    fontSize: 8,
    lineHeight: '10px',
    padding: '0 2px',
    borderRadius: 2,
    background: img.category === 'paper-bg' ? '#3b82f6' : '#a855f7',
    color: 'white',
    fontWeight: 700,
  }}
>
  {img.category === 'paper-bg' ? 'P' : 'W'}
</div>
```

Make the thumbnail button `position: relative` to contain the absolute badge.

- [ ] **Step 3: Verify arrow keys cycle images, verify category badges visible**

- [ ] **Step 4: Commit**

```bash
git add demo/src/pages/DevPage.tsx demo/src/components/dev/TestImageStrip.tsx
git commit -m "feat(demo): keyboard navigation (arrow keys) and category indicators on thumbnails"
```

---

### Task 6: Resolution scaling

Add a resolution dropdown that scales test images before processing.

**Files:**
- Modify: `demo/src/components/dev/DebugCanvas.tsx`
- Modify: `demo/src/pages/DevPage.tsx`

- [ ] **Step 1: Add resolution prop to DebugCanvas**

Add to DebugCanvasProps:
```typescript
  /** Scale factor for test images (1 = original, 0.5 = half, 0.25 = quarter). */
  scale?: number;
```

In the static image loading effect, after the image loads, scale the canvas dimensions:
```typescript
const s = scale ?? 1;
const canvasW = Math.round(img.naturalWidth * s);
const canvasH = Math.round(img.naturalHeight * s);
canvas.width = canvasW;
canvas.height = canvasH;
ctx.drawImage(img, 0, 0, canvasW, canvasH);
```

- [ ] **Step 2: Add resolution selector to DevPage header**

Add state and a select dropdown:
```typescript
const [scale, setScale] = useState(0.5);
```

In the header, add a small select:
```tsx
<select
  className="h-7 rounded border border-border bg-background px-2 text-xs"
  value={scale}
  onChange={(e) => setScale(Number(e.target.value))}
>
  <option value={1}>1920x1080</option>
  <option value={0.5}>960x540</option>
  <option value={0.33}>640x360</option>
</select>
```

Pass `scale={scale}` to DebugCanvas.

- [ ] **Step 3: Verify different resolutions work — take screenshot at each scale**

- [ ] **Step 4: Commit**

```bash
git add demo/src/components/dev/DebugCanvas.tsx demo/src/pages/DevPage.tsx
git commit -m "feat(demo): resolution scaling for test images (1x, 0.5x, 0.33x)"
```

---

### Task 7: Ground truth infrastructure

Create the data structure and UI for ground truth annotations. The actual coordinates will be populated manually in a separate task.

**Files:**
- Create: `demo/src/lib/test-ground-truth.ts`
- Modify: `demo/src/components/dev/DebugCanvas.tsx`
- Modify: `demo/src/components/dev/DetectionPanel.tsx`
- Modify: `demo/src/pages/DevPage.tsx`

- [ ] **Step 1: Create the ground truth data file**

Create `demo/src/lib/test-ground-truth.ts`:

```typescript
/**
 * Ground truth card corner annotations for test images.
 * Coordinates are in ORIGINAL image pixel space (1920x1080).
 * Order: [TL, TR, BR, BL] — top-left, top-right, bottom-right, bottom-left.
 *
 * IMPORTANT: This data is ONLY for evaluating detection accuracy.
 * It must NEVER be used in the detection pipeline itself.
 */

export interface GroundTruth {
  /** Ordered card corners: [TL, TR, BR, BL] in original image pixels. */
  corners: [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ];
}

/** Map from image path to ground truth. Images without annotations return undefined. */
export const groundTruthMap: Record<string, GroundTruth> = {
  // Will be populated by manual annotation.
  // Example:
  // '/test-images/paper-bg/Photo-1.jpeg': {
  //   corners: [
  //     { x: 450, y: 180 },  // TL
  //     { x: 1050, y: 150 }, // TR
  //     { x: 1080, y: 780 }, // BR
  //     { x: 420, y: 810 },  // BL
  //   ],
  // },
};

/** Compute mean corner distance (in pixels) between detected and ground truth quads. */
export function computeAccuracy(
  detected: { x: number; y: number }[],
  truth: GroundTruth,
  scale: number = 1,
): { meanDist: number; maxDist: number; perCorner: number[] } {
  const perCorner: number[] = [];
  let sum = 0;
  let max = 0;
  for (let i = 0; i < 4; i++) {
    const dx = detected[i].x / scale - truth.corners[i].x;
    const dy = detected[i].y / scale - truth.corners[i].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    perCorner.push(dist);
    sum += dist;
    if (dist > max) max = dist;
  }
  return { meanDist: sum / 4, maxDist: max, perCorner };
}
```

- [ ] **Step 2: Add ground truth overlay toggle to DebugCanvas**

Add a `showGroundTruth` toggle. In `drawOverlays()`, if ground truth exists for the current image, draw a blue dashed quad:

```typescript
// Ground truth overlay (blue dashed)
if (showGroundTruthRef.current && groundTruth) {
  const s = scale ?? 1;
  octx.strokeStyle = '#3b82f6';
  octx.lineWidth = 2;
  octx.setLineDash([8, 4]);
  octx.beginPath();
  const gt = groundTruth.corners;
  octx.moveTo(gt[0].x * s, gt[0].y * s);
  for (let i = 1; i < 4; i++) octx.lineTo(gt[i].x * s, gt[i].y * s);
  octx.closePath();
  octx.stroke();
  octx.setLineDash([]);
}
```

Add `groundTruth` as a prop: `groundTruth?: GroundTruth | null`.

- [ ] **Step 3: Add accuracy metric to DetectionPanel**

Extend `DetectionMetrics` with:
```typescript
  accuracy: { meanDist: number; maxDist: number; perCorner: number[] } | null;
```

In DetectionPanel, display:
```tsx
{metrics.accuracy && (
  <div className="mt-1">
    <div className="text-[9px] text-muted-foreground">Accuracy (vs ground truth)</div>
    <div className="flex gap-3 text-[10px] font-mono">
      <span>mean: <span className={metrics.accuracy.meanDist < 20 ? 'text-green-400' : 'text-red-400'}>{metrics.accuracy.meanDist.toFixed(1)}px</span></span>
      <span>max: {metrics.accuracy.maxDist.toFixed(1)}px</span>
    </div>
  </div>
)}
```

- [ ] **Step 4: Wire ground truth into DevPage**

Import `groundTruthMap` and `computeAccuracy`. Look up ground truth for the selected image and pass it to DebugCanvas. Compute accuracy in the metrics update handler and include in the metrics state.

- [ ] **Step 5: Verify TypeScript compiles**

- [ ] **Step 6: Commit**

```bash
git add demo/src/lib/test-ground-truth.ts demo/src/components/dev/DebugCanvas.tsx demo/src/components/dev/DetectionPanel.tsx demo/src/pages/DevPage.tsx
git commit -m "feat(demo): ground truth annotation infrastructure with accuracy metric"
```

---

### Task 8: Annotate ground truth for all 48 test images

This task is performed MANUALLY using the workbench via computer-use. For each test image:
1. Load the image in the debug workbench
2. Visually identify the 4 card corners (TL, TR, BR, BL)
3. Record the coordinates in `test-ground-truth.ts`

**Files:**
- Modify: `demo/src/lib/test-ground-truth.ts`

- [ ] **Step 1: Annotate paper-bg images (24 images)**

For each image in paper-bg/, use the workbench to identify card corners. The images are 1920x1080. Cards are typically in the center, roughly spanning 400-600px wide and 500-800px tall.

Method: Load each image, zoom into the corners, estimate coordinates from the visible pixel positions. Record in `groundTruthMap`.

- [ ] **Step 2: Annotate wood-bg images (24 images)**

Same process for wood-bg/.

- [ ] **Step 3: Verify ground truth overlays display correctly**

Load several annotated images and verify the blue dashed quad matches the card borders visually.

- [ ] **Step 4: Commit**

```bash
git add demo/src/lib/test-ground-truth.ts
git commit -m "feat(demo): ground truth annotations for all 48 test images"
```

---

### Task 9: Integration testing and polish

Test the complete workbench with all features and fix any issues.

**Files:**
- Modify: any files as needed

- [ ] **Step 1: Test full workflow**
- Load images via clicking and arrow keys
- Toggle all overlays (Canny, Morph, Contours, Ground Truth)
- Toggle pipeline overlays off/on
- Change resolution and verify detection runs at each scale
- Run All and verify verdicts are correct
- Check accuracy metrics against ground truth
- Verify webcam mode still works

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix(demo): workbench integration testing fixes and polish"
```
