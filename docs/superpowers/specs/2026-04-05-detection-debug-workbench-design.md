# Detection Debug Workbench — Design Spec

## Purpose

A dev-only page in the demo React app that lets the AI agent (and human developers) debug the card detection pipeline visually. The page runs the **exact same detection code** as the production card detection demo but provides full-resolution pipeline overlays, batch testing against static images, and detailed metrics.

## Problem Statement

During the Detection Game, the AI agent's biggest failure modes were:
1. **Couldn't see what the pipeline produced** — only a tiny thumbnail of the morph blob
2. **Confused quality score with detection accuracy** — quality measures frame SHAPE (5:7 ratio), not whether the frame is in the RIGHT PLACE
3. **Couldn't test parameter changes offline** — every iteration required a live camera
4. **Partial detection accepted as full detection** — no tool to compare green frame vs actual card borders
5. **Stale slider values** from HMR persisted between code changes

## Architecture

### Core Principle: Zero Code Duplication

The debug page calls `cardDetectionDemo.process()` directly from `demos.ts`. The detection pipeline is identical whether the input is a live webcam frame or a static test image. The only abstraction is the input source.

### Route

`/#/dev` lazy-loaded via `DevPage.tsx`. Added to the HashRouter alongside existing routes. Dev-only: not linked from the main nav, accessed by direct URL.

### Input Sources

1. **Static test images** from `demo/public/test-images/{category}/`. Auto-discovered at page load by scanning known subdirectories (`paper-bg/`, `wood-bg/`, and any future folders).
2. **Live webcam** via the existing `useWebcam` hook. Toggled on/off from the debug page.

For static images: draw the image onto the canvas with `ctx.drawImage()`, then call the detection pipeline's `process()` function. The pipeline sees canvas pixels and processes them identically to a webcam frame.

### Internal Buffer Access

Pipeline buffers (`_cardGray`, `_cardEdges`, `_cardBlurred`, `_cardSmoothedCorners`, etc.) are module-level variables in `demos.ts`. A new export exposes them for debug overlays:

```typescript
// In demos.ts
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
  };
}
```

No copies, no overhead. The function just returns references. Only called from the dev page.

## Page Layout

Four zones optimized for 1440x900+ screenshot readability:

```
+------------------------------------------+-------------------+
|                                          | Pipeline Stages   |
|          Debug Canvas (60%)              | [gray] [blur]     |
|    (video/image + toggleable overlays)   | [eq]   [canny]    |
|                                          | [morph] [final]   |
|                                          |-------------------|
|                                          | Detection Panel   |
|                                          | - Controls        |
|                                          | - Metrics         |
|                                          | - Pass/Fail       |
+------------------------------------------+-------------------+
|   Test Image Strip (scrollable, color-coded borders)         |
+--------------------------------------------------------------+
```

## Components

### 1. DevPage.tsx

Page shell. Manages:
- Current input mode (static image vs webcam)
- Selected test image path
- Detection parameters (with reset-to-defaults)
- Overlay toggle state
- Pass/fail state per image (React state, with optional localStorage persistence)

### 2. DebugCanvas

The main canvas. Responsibilities:

**Rendering:**
- Draws either a static image or live webcam frame
- Calls `cardDetectionDemo.process()` on the canvas
- After process, renders toggleable overlays by reading debug buffers:
  - **Red overlay**: Canny edges (from saved `_cardGray` after Canny step)
  - **Yellow overlay**: Morph blob mask (from `_cardEdges` after morph step)
  - **Cyan overlay**: All contour outlines from `findContours` result
  - **Green overlay**: Final detection quad (existing behavior)
- Each overlay is a checkbox toggle above the canvas

**Controls:**
- Overlay toggle checkboxes (Canny / Morph / Contours / Detection Quad)
- Freeze button (stops the animation loop for static analysis)
- Step button (advances one frame when frozen — useful for webcam mode)
- Source toggle (Image / Webcam)

**Sizing:**
- Canvas renders at the image's native resolution (1920x1080 for test images, 640x480 for webcam)
- CSS scales to fit the 60% left column while maintaining aspect ratio
- Overlays render at native resolution for pixel-accurate debugging

### 3. PipelineStages

Vertical strip of 6 small thumbnail canvases, each ~160x90px:

| Stage | Buffer Source | Visualization |
|-------|-------------|---------------|
| Grayscale | `_cardGray` (before blur) | Gray values |
| Blurred | `_cardBlurred` (after blur) | Gray values |
| Equalized | `_cardGray` (after equalize, dark scenes only) | Gray values |
| Canny | `_cardGray` (saved Canny edges) | White on black |
| Morph | `_cardEdges` (after morph threshold) | Green on black |
| Detection | Final canvas state | Full color with quad |

Click any thumbnail to see it at full resolution in the main DebugCanvas.

### 4. DetectionPanel

**Parameter Controls:**
- Blur Kernel (slider, 3-21)
- Canny Low (slider, 5-100)
- Canny High (slider, 20-250)
- Min Area (slider, 200-50000)
- **Reset to Defaults** button — sets all params to code defaults, solving WISH 2

**Live Metrics (updated each frame):**
- Contour area, bounding rect aspect, rectFill, poly point count
- Quality score (5:7 ratio match from quad side lengths)
- Scene brightness (mean value — shows dark/bright mode)
- Morph threshold (current smoothed value)
- Detection status (detected / no card / grace period)

**Per-Image Validation:**
- Pass / Fail toggle button
- Notes text field (optional)
- State stored in React state, optionally persisted to localStorage

### 5. TestImageStrip

Horizontal scrollable strip at the bottom of the page.

**Image Discovery:**
- At page load, fetches a known manifest or iterates known category folders
- Since Vite serves `public/` statically, images are at `/test-images/{category}/{filename}`
- Categories derived from folder names: `paper-bg`, `wood-bg`

**Display:**
- Each image shown as a small thumbnail (~120x68px)
- Category label above each group
- Color-coded border: green (pass), red (fail), gray (untested)
- Click to load into DebugCanvas and run detection
- **Run All** button: batch-processes all images sequentially, updates pass/fail state based on whether detection produced a valid quad
- Summary bar: "32/48 passed" with percentage

**Image List Management:**
- Since Vite can't dynamically glob `public/` at runtime, the image list is a static TypeScript array in `lib/test-manifest.ts`. This file is generated by a Node script (`scripts/gen-test-manifest.ts`) that scans `demo/public/test-images/` and outputs the array. Run the script once when images change: `npx tsx scripts/gen-test-manifest.ts`.

## Data Flow

```
Test Image (or Webcam Frame)
    |
    v
ctx.drawImage(img, 0, 0, w, h)      // draw source onto canvas
    |
    v
cardDetectionDemo.process(ctx, ...)   // EXACT same pipeline as demo page
    |
    v
getCardDebugBuffers()                 // read internal buffers (no copy)
    |
    v
Overlay Rendering                     // Canny(red), Morph(yellow), Contours(cyan)
    |
    v
PipelineStages thumbnails             // render each buffer into small canvases
    |
    v
DetectionPanel metrics                // display area, aspect, rectFill, quality
```

## File Structure

```
demo/src/
  pages/
    DevPage.tsx                    # new: page shell + state management
  components/
    dev/
      DebugCanvas.tsx              # new: main canvas + overlays
      PipelineStages.tsx           # new: stage thumbnail strip
      DetectionPanel.tsx           # new: controls + metrics
      TestImageStrip.tsx           # new: image selector + batch runner
  lib/
    demos.ts                       # modified: add getCardDebugBuffers() export
    test-manifest.ts               # new: static list of test image paths
  App.tsx                          # modified: add /dev route
demo/public/
  test-images/
    paper-bg/                      # 24 images (1920x1080)
    wood-bg/                       # 24 images (1920x1080)
scripts/
  gen-test-manifest.ts             # new: scans test-images/ → writes manifest
```

## Future Extensions (implement when needed)

- **A/B Split-Screen**: Side-by-side comparison of two parameter configurations on the same image
- **Persistent Manifest**: Save pass/fail + notes to localStorage or a JSON file
- **Regression Testing**: Run All with threshold — fail the batch if pass rate drops below previous run
- **Mobile Layout**: Stacked layout for testing on phone browsers
- **Image Upload**: Drag-and-drop new test images directly from the debug page
