# Pipeline Display Decoupling + Constants Refactor — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decouple processing resolution from display resolution so downscaling speeds up detection without degrading display quality. Extract all magic numbers into a typed constants object. Add an Advanced Settings drawer for secondary controls.

**Architecture:** Offscreen canvas for processing at selected scale; display canvas always at full resolution; all debug drawing moved from pipeline to DebugCanvas component; constants extracted to a shared config object with UI controls.

**Tech Stack:** TypeScript, React, shadcn-ui Drawer component, jsfeat.

---

## 1. Processing/Display Decoupling

### Current flow (coupled):
```
Canvas (at scale resolution)
  → process() reads pixels, detects card, draws debug overlays
  → Everything at the same resolution
```

### New flow (decoupled):
```
Display canvas (full resolution — crisp image)
  ↕ draw full-res frame
Offscreen canvas (scale resolution — fast processing)
  ↕ draw scaled frame
  ↕ process(offscreenCtx, video, scaledW, scaledH)
  ↕ read results from getCardDebugBuffers()
  ↕ map corners by 1/scale
Display canvas ← draw all overlays at full-res coordinates
```

### Changes:
- **DebugCanvas.tsx**: Create offscreen canvas via `document.createElement('canvas')`. On each frame:
  1. Draw video/image to display canvas at full resolution
  2. Draw video/image to offscreen canvas at `width*scale × height*scale`
  3. Call `process()` on the offscreen context
  4. Read detection results
  5. Multiply all corner coordinates by `1/scale`
  6. Draw overlays on the display canvas overlay layer

- **demos.ts**: Remove ALL drawing from `process()`:
  - Remove pipeline thumbnail drawing (lines ~2226-2242)
  - Remove detection quad drawing (lines ~2566-2571)
  - Remove warp preview drawing (lines ~2515-2558)
  - Remove quality chart drawing (lines ~2618-2634)
  - Remove status text drawing (lines ~2592-2600)
  - Keep: `ctx.getImageData()`, all detection logic, state updates

- **getCardDebugBuffers()**: Add new fields:
  ```typescript
  detected: boolean;
  morphMask: Uint8Array | null;  // post-erosion binary blob for thumbnail
  ```

### Fixed-size debug elements (on display canvas):
| Element | Fixed Size | Position |
|---------|-----------|----------|
| Pipeline thumbnail | 160×120px | top-left, 4px margin |
| Quality chart | 120×24px | top-right, 8px margin |
| Status text | 12px monospace | bottom-left, 8px margin |
| Detection quad | 2px stroke | mapped to full-res coords |
| Corner dots | 4px radius | mapped to full-res coords |
| Warp preview | 125×175px | bottom-right, 8px margin |

## 2. Constants Extraction

### New file: `demo/src/lib/detection-constants.ts`

All magic numbers extracted into a single typed object:

```typescript
export const DETECTION_DEFAULTS = {
  // --- Main controls (visible in panel) ---
  blurKernel: 9,
  cannyLow: 20,
  cannyHigh: 60,
  minContourArea: 1000,

  // --- Advanced controls (in drawer) ---
  // Preprocessing
  equalizationThreshold: 100,
  minBlurKernel: 15,

  // Edge detection
  scharrThreshold: 30,
  warmthThreshold: 25,
  chromaThreshold: 30,
  warmthBorderMargin: 30,

  // Morphology
  morphRadius: 5,
  morphThresholdBias: 7,
  morphThresholdMin: 8,
  morphSmoothing: 0.7,
  erosionRadius: 2,
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

  // Temporal
  smoothingFactor: 0.7,
  jumpThreshold: 80,
  graceFrames: 12,
  persistenceDistance: 100,
  persistenceBoost: 1.5,
} as const;

export type DetectionParams = typeof DETECTION_DEFAULTS;
```

### Usage in `demos.ts`:
Replace all magic numbers with `params.xxx` references. The `_cardParams` object extends `DetectionParams` with user overrides.

### Usage in `DetectionPanel.tsx`:
Import `DETECTION_DEFAULTS` for default values. The main panel shows 4 primary sliders. The "Advanced" button opens the drawer with all other params.

## 3. UI: Advanced Settings Drawer

### Install shadcn-ui Drawer:
```bash
cd demo && npx shadcn@latest add drawer
```

### Sidebar layout (top to bottom, no scroll):
```
┌──────────────────────────────┐
│ PIPELINE STAGES              │
│ ┌────┐ ┌────┐ ┌────┐        │
│ │    │ │    │ │    │  3-col  │
│ └────┘ └────┘ └────┘  row   │
│                              │
│ METRICS             Retest   │
│ Detected PASS          16.7px│
│ rf=0.88 asp=0.52 ...        │
│ (571,243) (1167,210) ...     │
│                              │
│ CONTROLS              Reset  │
│ ┌─────────────┬─────────────┐│
│ │ Blur    ◉ 9 │ Morph  ◉ 5 ││
│ │ CannyLo◉ 20 │ Erosn  ◉ 2 ││
│ │ CannyHi◉ 60 │ Scharr◉ 30 ││
│ │ MinArea◉1000│ Warmth◉ 25 ││
│ └─────────────┴─────────────┘│
│ [⚙ Advanced Settings]       │
└──────────────────────────────┘
```

### Main controls (2-column responsive grid, ~8 sliders):
| Slider | Default | Range | Purpose |
|--------|---------|-------|---------|
| Blur Kernel | 9 | 3-21 (step 2) | Pre-Canny Gaussian blur |
| Canny Low | 20 | 5-100 | Edge detection low threshold |
| Canny High | 60 | 20-250 | Edge detection high threshold |
| Min Area | 1000 | 200-50000 | Minimum contour area |
| Morph Radius | 5 | 2-12 | Blob closing strength |
| Erosion Radius | 2 | 1-5 | Thin edge removal |
| Scharr Threshold | 30 | 10-80 | Gradient merge strength |
| Warmth Threshold | 25 | 10-60 | Color edge sensitivity |

### Advanced Settings Drawer:
- Opens as a **right-side sheet** with `modal={false}` — no background dim, user can interact with the workbench while drawer is open
- Organized in collapsible sections:
  - **Preprocessing**: equalization threshold, min blur kernel
  - **Edge Detection**: chroma threshold, border margin
  - **Morphology**: threshold bias, threshold min, morph smoothing, erosion threshold
  - **Contour Filtering**: min/max area ratio, border margin, min aspect, target aspect, side ratio
  - **Corner Refinement**: scan range min/max, samples, line fit factor
  - **Temporal**: smoothing factor, jump threshold, grace frames, persistence distance/boost
- Each slider shows current value inline
- "Reset All" button at the bottom

### Layout changes:
1. **Pipeline Stages**: 3-cell horizontal row (grid-cols-3), column on mobile (grid-cols-1 sm:grid-cols-3)
2. **Metrics section**: moved ABOVE controls section (metrics are read more often than controls are adjusted)
3. **Run All button**: uses `variant="default"` (primary/filled) instead of outline
4. **Controls**: 2-column responsive grid for ~8 main sliders (grid-cols-1 md:grid-cols-2)

### No-scroll constraint:
The sidebar fits: pipeline stages (compact row) + metrics (3 lines) + controls (4 rows × 2 cols) + advanced button. Total height ~400px, well within typical viewport.

## 4. File Changes Summary

| File | Change |
|------|--------|
| `demo/src/lib/detection-constants.ts` | **CREATE** — all constants + types |
| `demo/src/lib/demos.ts` | Remove all drawing from `process()`, use constants, expose more debug data |
| `demo/src/components/dev/DebugCanvas.tsx` | Add offscreen canvas, move all overlay drawing here, coordinate mapping |
| `demo/src/components/dev/DetectionPanel.tsx` | Use constants, add Advanced Settings drawer trigger |
| `demo/src/components/ui/drawer.tsx` | **CREATE** via `npx shadcn@latest add drawer` |
| `demo/src/pages/DevPage.tsx` | Pass extended params, handle advanced param changes |

## 5. Testing

- All 48 test images must still score 37/48 at 50px threshold
- Scale at 50% must show full-res display with detection overlays at correct positions
- Scale at 100% must work identically to current behavior
- Webcam at any scale must show crisp video with scaled processing
- Advanced Settings drawer opens/closes without layout shift
- Reset button restores all params to defaults
- All slider changes take effect immediately (via onParamChange)

## 6. Performance

- No performance regression at 100% scale (same processing as before)
- At 50% scale: ~4x faster processing (quarter the pixels)
- Display canvas drawing is negligible (just video frame + overlay lines)
- Offscreen canvas creation happens once (cached)
