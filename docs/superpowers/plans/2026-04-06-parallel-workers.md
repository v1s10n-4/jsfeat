# Parallel Web Workers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parallelize "Run All" batch testing across Web Workers for ~6x speedup.

**Architecture:** Extract detection pipeline into a pure stateless function (`detectCard`). Workers fetch images, run detection, return results. Main thread collects verdicts.

**Tech Stack:** Web Workers (module type), OffscreenCanvas, createImageBitmap, jsfeat, Vite.

---

### Task 1: Extract `detectCard()` pure function

**Files:**
- Create: `demo/src/lib/detect-card.ts`

Extract the core detection pipeline (grayscale → blur → Canny → Scharr → color edges → morph → contours → hull → approxPoly → line fitting → edge refinement → quality score) into a single stateless function.

- [ ] **Step 1: Create detect-card.ts**

This file imports jsfeat functions and the helper functions (`sortCorners`, `buildCardCorners`) and implements the full pipeline without any mutable module-level state.

The function allocates its own `Matrix` buffers on each call (or reuses via optional pre-allocated buffers parameter for performance).

Key signature:
```typescript
import { Matrix, U8C1, S32C2 } from 'jsfeat/core';
import { grayscale, boxBlurGray, gaussianBlur, equalizeHistogram, cannyEdges, scharrDerivatives, findContours, approxPoly } from 'jsfeat/imgproc';
import { DETECTION_DEFAULTS } from './detection-constants';

export interface DetectCardResult {
  detected: boolean;
  corners: { x: number; y: number }[] | null;
  debugInfo: string;
  rectFill: number;
  aspect: number;
  qualityScore: number;
}

export function detectCard(
  rgba: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  params: Record<string, number> = DETECTION_DEFAULTS as any,
): DetectCardResult
```

The function body contains:
1. Buffer allocation: `gray`, `blurred`, `edges` as `new Matrix(w, h, U8C1)`, `scharr` as `new Matrix(w, h, S32C2)`
2. Grayscale conversion
3. Conditional histogram equalization (brightness < params.equalizationThreshold)
4. Gaussian blur (kernel = max(params.blurKernel, params.minBlurKernel))
5. Canny edge detection
6. Scharr gradient merge
7. Warmth (R-B) edge merge (with border margin exclusion)
8. Chroma (max-min RGB) edge merge
9. Morph blob (box blur + threshold) — uses `rawThresh` directly (no temporal smoothing)
10. Binary erosion
11. findContours + scoring loop (hull, approxPoly, line fitting)
12. Edge refinement (perpendicular Canny scan)
13. Quality score computation
14. Return result

**Important differences from `process()`:**
- NO temporal smoothing (`_cardPrevThreshold`, `_cardSmoothedCorners`) — each call is independent
- NO persistence bias in scoring (no `_cardSmoothedCorners` to check against)
- NO `profiler` calls
- NO `drawVideoFrame` or canvas context access
- Allocates its own Matrix buffers

Include `sortCorners` and `buildCardCorners` as private functions in this file (copy from demos.ts).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build && cd demo && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add demo/src/lib/detect-card.ts
git commit -m "feat: extract detectCard() pure stateless function

Full pipeline in a single function with no mutable state.
Allocates own Matrix buffers. No temporal smoothing, no canvas dependency.
Ready for use in Web Workers."
```

---

### Task 2: Create detection worker

**Files:**
- Create: `demo/src/workers/detection-worker.ts`

- [ ] **Step 1: Create the worker file**

```typescript
// demo/src/workers/detection-worker.ts
import { detectCard } from '../lib/detect-card';
import { computeAccuracy } from '../lib/test-manifest';
import type { GroundTruth } from '../lib/test-manifest';

interface WorkerInput {
  imagePath: string;
  params: Record<string, number>;
  scale: number;
  groundTruth: GroundTruth | null;
  accuracyThreshold: number;
}

interface WorkerOutput {
  imagePath: string;
  detected: boolean;
  corners: { x: number; y: number }[] | null;
  verdict: 'pass' | 'fail' | 'untested';
  accuracy: { meanDist: number; maxDist: number } | null;
  debugInfo: string;
}

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { imagePath, params, scale, groundTruth, accuracyThreshold } = e.data;

  try {
    // Fetch and decode image in the worker
    const response = await fetch(imagePath);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    // Draw to OffscreenCanvas at scaled resolution
    const procW = Math.round(bitmap.width * scale);
    const procH = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(procW, procH);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, procW, procH);
    bitmap.close();

    const imageData = ctx.getImageData(0, 0, procW, procH);

    // Run detection
    const result = detectCard(imageData.data, procW, procH, params);

    // Compute accuracy against ground truth
    let verdict: 'pass' | 'fail' | 'untested' = 'untested';
    let accuracy: { meanDist: number; maxDist: number } | null = null;
    if (groundTruth && result.corners && result.corners.length === 4) {
      const acc = computeAccuracy(result.corners, groundTruth, scale);
      accuracy = { meanDist: acc.meanDist, maxDist: acc.maxDist };
      verdict = acc.meanDist <= accuracyThreshold ? 'pass' : 'fail';
    } else if (groundTruth) {
      verdict = 'fail';
    }

    const output: WorkerOutput = {
      imagePath,
      detected: result.detected,
      corners: result.corners,
      verdict,
      accuracy,
      debugInfo: result.debugInfo,
    };
    self.postMessage(output);
  } catch (err) {
    const output: WorkerOutput = {
      imagePath,
      detected: false,
      corners: null,
      verdict: 'fail',
      accuracy: null,
      debugInfo: `Error: ${err}`,
    };
    self.postMessage(output);
  }
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd demo && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add demo/src/workers/detection-worker.ts
git commit -m "feat: create detection Web Worker

Worker fetches images, runs detectCard(), computes accuracy,
returns verdict. Ready for parallel batch execution."
```

---

### Task 3: Refactor demos.ts to use detectCard()

**Files:**
- Modify: `demo/src/lib/demos.ts`

Refactor `cardDetectionDemo.process()` to call `detectCard()` internally, then apply temporal smoothing on top.

- [ ] **Step 1: Import detectCard**

Add to imports:
```typescript
import { detectCard } from '@/lib/detect-card';
```

- [ ] **Step 2: Replace the pipeline body in process()**

The current `process()` method has:
1. Video frame drawing + getImageData (keep — needs canvas)
2. Full pipeline (grayscale → morph → contours → refinement) (replace with `detectCard()`)
3. Temporal smoothing (keep — needs module-level state)
4. Quality history (keep — needs module-level state)

Replace the pipeline section (from grayscale through edge refinement) with:
```typescript
const imageData = ctx.getImageData(0, 0, w, h);
const result = detectCard(imageData.data, w, h, _cardParams);
let detected = result.detected;
let cardCorners = result.corners ?? [];
_cardDebugInfo = result.debugInfo;
_cardLastRectFill = result.rectFill;
_cardLastAspect = result.aspect;
```

Keep the temporal smoothing section that follows (it uses `_cardSmoothedCorners`, `_cardGraceFrames`).

Keep the quality history computation and `_cardQualityHistory` updates.

Remove the now-unused buffer variables (`_cardGray`, `_cardBlurred`, `_cardEdges`, `_cardScharr`) and their allocation code. Or keep them for the debug overlay buffers — DebugCanvas might still read them. Actually, `getCardDebugBuffers()` returns `gray`, `edges`, `blurred` for pipeline stage visualization. If `detectCard()` doesn't expose these, the pipeline stages would go blank.

**Decision: keep the buffer variables and have `detectCard()` return them as optional outputs.** Add to the `DetectCardResult`:
```typescript
export interface DetectCardResult {
  // ... existing fields
  buffers?: {
    gray: Matrix;
    edges: Matrix;
    blurred: Matrix;
    scharr: Matrix;
  };
}
```

In `detectCard()`, return the buffers. In `process()`, store them:
```typescript
if (result.buffers) {
  _cardGray = result.buffers.gray;
  _cardEdges = result.buffers.edges;
  _cardBlurred = result.buffers.blurred;
  _cardScharr = result.buffers.scharr;
}
```

- [ ] **Step 3: Verify TypeScript compiles and detection still works**

Run: `npm run build && cd demo && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add demo/src/lib/demos.ts demo/src/lib/detect-card.ts
git commit -m "refactor: demos.ts process() now uses detectCard() internally

Pipeline logic delegated to pure function. Module-level state
only used for temporal smoothing and debug buffers."
```

---

### Task 4: Replace handleRunAll with parallel worker version

**Files:**
- Modify: `demo/src/pages/DevPage.tsx`

- [ ] **Step 1: Replace handleRunAll with parallel version**

Find the `handleRunAll` callback (~line 204) and replace its body:

```typescript
const handleRunAll = useCallback(async () => {
  if (batchRunning) return;
  setBatchRunning(true);

  const numWorkers = Math.min(navigator.hardwareConcurrency || 4, 8);
  const workers: Worker[] = [];
  for (let i = 0; i < numWorkers; i++) {
    workers.push(new Worker(
      new URL('../workers/detection-worker.ts', import.meta.url),
      { type: 'module' }
    ));
  }

  const nextVerdicts = { ...verdicts };
  let completed = 0;
  const imageQueue = testImages.filter(img => img.groundTruth).map(img => ({
    imagePath: img.path,
    params: { ...params },
    scale,
    groundTruth: img.groundTruth,
    accuracyThreshold,
  }));
  const totalImages = imageQueue.length;

  // Mark images without ground truth as untested
  for (const img of testImages) {
    if (!img.groundTruth) nextVerdicts[img.path] = 'untested';
  }

  let queueIdx = 0;

  function dispatchNext(worker: Worker) {
    if (queueIdx >= imageQueue.length) return;
    worker.postMessage(imageQueue[queueIdx++]);
  }

  await new Promise<void>(resolve => {
    for (const worker of workers) {
      worker.onmessage = (e) => {
        const { imagePath, verdict } = e.data;
        nextVerdicts[imagePath] = verdict;
        completed++;

        if (completed === totalImages) {
          resolve();
        } else {
          dispatchNext(worker);
        }
      };
      // Initial dispatch: one image per worker
      dispatchNext(worker);
    }
  });

  workers.forEach(w => w.terminate());
  setVerdicts(nextVerdicts);
  saveVerdicts(nextVerdicts);
  setBatchRunning(false);
}, [batchRunning, verdicts, params, scale, accuracyThreshold]);
```

- [ ] **Step 2: Remove old sequential imports if unused**

Check if `cardDetectionDemo`, `getCardDebugBuffers`, `resetCardTemporalState` are still needed in DevPage. They ARE needed for single-image retest. Keep them.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd demo && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add demo/src/pages/DevPage.tsx
git commit -m "feat: parallel Run All using Web Worker pool

Dispatches images to N workers (up to 8 cores) round-robin.
Each worker fetches, decodes, and processes independently.
~6x speedup for 48 image batch."
```

---

### Task 5: Integration testing

- [ ] **Step 1: Build and verify**

```bash
npm run build
```

Open the workbench at `/#/dev`.

- [ ] **Step 2: Test Run All (parallel)**

Click Run All. Verify:
- Score is 37/48 at 50px threshold (must match sequential)
- Batch completes in ~1-2 seconds (vs ~8s sequential)
- All verdicts are correct (compare against known results)
- No console errors about worker failures

- [ ] **Step 3: Test single-image Retest (still sequential)**

Select a test image, click Retest. Verify:
- Detection runs on main thread
- Overlays display correctly
- Metrics update

- [ ] **Step 4: Test webcam (still sequential)**

Toggle webcam. Verify:
- Real-time processing works
- No interference from worker code

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "feat: parallel web workers batch testing complete

48 images processed in parallel across N workers.
Sequential Retest and webcam unchanged."
```
