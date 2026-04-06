# Parallel Web Workers for Batch Testing — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Parallelize "Run All" batch testing across Web Workers for ~6x speedup (48 images in ~1-1.5s instead of ~8s).

**Architecture:** Extract the detection pipeline into a pure stateless function. Workers fetch images directly, run detection independently, return results. Main thread collects results and updates verdicts.

**Tech Stack:** Web Workers (module type), OffscreenCanvas, createImageBitmap, Vite worker bundling.

---

## 1. Extract Pipeline as Pure Function

### New file: `demo/src/lib/detect-card.ts`

Extract the core detection logic from `cardDetectionDemo.process()` into a stateless function:

```typescript
export function detectCard(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  params: Record<string, number>,
): DetectCardResult
```

**Input:** Raw RGBA pixel data + dimensions + params.
**Output:** `{ detected: boolean; corners: {x,y}[] | null; debugInfo: string; rectFill: number; aspect: number; qualityScore: number }`

This function:
- Allocates its own Matrix buffers (grayscale, blurred, edges, scharr)
- Runs the full pipeline: grayscale → equalization → blur → Canny → Scharr → color edges → morph → contours → hull → approxPoly → line fitting → edge refinement
- NO temporal smoothing (stateless — each call is independent)
- NO canvas drawing (pure data)
- Returns detection results

### Refactor `cardDetectionDemo.process()` to use `detectCard()`

The demo's `process()` method becomes a thin wrapper:
1. Read `imageData` from canvas context
2. Call `detectCard(imageData.data, w, h, params)`
3. Apply temporal smoothing to the returned corners
4. Store results in module-level state for `getCardDebugBuffers()`

## 2. Detection Worker

### New file: `demo/src/workers/detection-worker.ts`

```typescript
import { detectCard } from '../lib/detect-card';
import { computeAccuracy } from '../lib/test-manifest';

self.onmessage = async (e: MessageEvent) => {
  const { imagePath, params, scale, groundTruth, accuracyThreshold } = e.data;
  
  // Fetch and decode image
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
  if (groundTruth && result.corners && result.corners.length === 4) {
    const acc = computeAccuracy(result.corners, groundTruth, scale);
    verdict = acc.meanDist <= accuracyThreshold ? 'pass' : 'fail';
  } else if (groundTruth) {
    verdict = 'fail';
  }
  
  self.postMessage({ imagePath, ...result, verdict });
};
```

### Worker bundling (Vite)
Vite supports `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })` out of the box. No config changes needed.

## 3. Main Thread Orchestration

### In `DevPage.tsx` — `handleRunAllParallel()`

```typescript
const handleRunAllParallel = useCallback(async () => {
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
  let imageQueue = [...testImages];
  
  function dispatchNext(worker: Worker) {
    const img = imageQueue.shift();
    if (!img) return;
    worker.postMessage({
      imagePath: img.path,
      params,
      scale,
      groundTruth: img.groundTruth,
      accuracyThreshold,
    });
  }
  
  await new Promise<void>(resolve => {
    for (const worker of workers) {
      worker.onmessage = (e) => {
        const { imagePath, verdict } = e.data;
        nextVerdicts[imagePath] = verdict;
        completed++;
        
        // Show progress
        setSelectedImage(imagePath);
        
        if (completed === testImages.length) {
          resolve();
        } else {
          dispatchNext(worker);
        }
      };
      dispatchNext(worker);
    }
  });
  
  workers.forEach(w => w.terminate());
  setVerdicts(nextVerdicts);
  saveVerdicts(nextVerdicts);
  setBatchRunning(false);
}, [batchRunning, verdicts, params, scale, accuracyThreshold]);
```

Replace `handleRunAll` with `handleRunAllParallel` for the Run All button.

## 4. What Stays on Main Thread

- **Single image Retest**: uses `cardDetectionDemo.process()` (needs canvas for display)
- **Webcam processing**: real-time, needs video frame + display
- **UI overlays**: all drawing stays in DebugCanvas
- **Temporal smoothing**: only for live/webcam mode

## 5. Dependencies for Workers

The worker imports:
- `detect-card.ts` → imports jsfeat functions from `jsfeat/imgproc` and `jsfeat/core`
- `test-manifest.ts` → imports `computeAccuracy` and ground truth data

jsfeat functions are pure math (Matrix operations, convolutions, edge detection). They work in workers because they don't touch the DOM. The only DOM API the worker uses is `OffscreenCanvas` + `fetch` + `createImageBitmap`, all available in workers.

## 6. File Changes

| File | Change |
|------|--------|
| `demo/src/lib/detect-card.ts` | **CREATE** — pure stateless detection function |
| `demo/src/workers/detection-worker.ts` | **CREATE** — worker that runs detect-card |
| `demo/src/lib/demos.ts` | Refactor `process()` to call `detectCard()` internally |
| `demo/src/pages/DevPage.tsx` | Replace `handleRunAll` with parallel worker version |

## 7. Testing

- Run All must produce identical results to sequential (37/48 at 50px)
- Measure batch time before/after (target: 6x+ speedup)
- Verify workers are terminated after batch completes (no memory leak)
- Verify single-image Retest still works (main thread path)
- Verify webcam still works (main thread path)

## 8. Performance Target

| Metric | Sequential | Parallel (8 workers) |
|--------|-----------|---------------------|
| 48 images | ~8s | ~1-1.5s |
| Worker startup | N/A | ~50ms one-time |
| Memory | 1 pipeline set | 8 pipeline sets (~50MB) |
