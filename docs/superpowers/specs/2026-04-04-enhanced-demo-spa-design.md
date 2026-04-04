# Enhanced Demo SPA — Design Specification

## Overview

Upgrade the jsfeat demo SPA from 6 basic demos to a full-featured showcase with 25 interactive demos, parameter controls, performance profiling, API reference page, and mobile support. Achieves parity with the original jsfeat gh-pages site and adds modern extras.

---

## Site Structure

Three top-level sections:

1. **Demos** — 25 interactive webcam demos grouped by category
2. **API Reference** — Integrated documentation page with TypeScript signatures
3. **About** — Project overview with GitHub link

---

## Demo Inventory

### Image Processing (8 demos)

| Demo | Source | Status | Parameters |
|------|--------|--------|------------|
| Grayscale | `grayscale.ts` | Exists | Color code selector (RGBA, RGB, BGRA, BGR) |
| Box Blur | `boxBlur.ts` | New | Radius slider (1-20), no-scale toggle |
| Gaussian Blur | `gaussianBlur.ts` | New | Kernel size (3-15 odd), sigma slider (0-10) |
| Pyramid Down | `pyrDown.ts` | New | Number of levels (1-4) |
| Histogram Equalization | `equalizeHist.ts` | New | (no params, show before/after split) |
| Sobel Derivatives | `sobel.ts` | New | (visualize dx/dy as color overlay) |
| Scharr Derivatives | `scharr.ts` | New | (same as Sobel viz) |
| Canny Edges | `edges.ts` | Exists | Low threshold (1-127), high threshold (1-255) |

### Feature Detection (4 demos)

| Demo | Source | Status | Parameters |
|------|--------|--------|------------|
| FAST Corners | `corners.ts` | Exists (upgrade) | Threshold slider (5-100), border slider |
| YAPE06 | `yape06.ts` | New | Laplacian threshold, min eigenvalue threshold |
| YAPE | `yape.ts` | New | (detector params) |
| ORB Pattern Matching | `orbMatch.ts` | New (major) | Train button, match threshold, pyramid levels |

ORB Pattern Matching: Full pipeline — freeze frame to train, then live match against pattern with homography overlay. Multi-scale YAPE06 detection + ORB descriptors + RANSAC homography, drawing matched outline.

### Face Detection (2 demos)

| Demo | Source | Status | Parameters |
|------|--------|--------|------------|
| HAAR Face | `faceDetect.ts` | Exists (upgrade) | Scale factor, min neighbors, Canny pruning toggle |
| BBF Face | `bbfFace.ts` | New | Interval, min scale |

### Motion (2 demos)

| Demo | Source | Status | Parameters |
|------|--------|--------|------------|
| Optical Flow LK | `opticalFlow.ts` | Exists (upgrade) | Win size, max iterations, max points |
| Video Stabilization | `videoStab.ts` | New (major) | Motion model (affine/homography), smoothing radius, WebGL toggle, split-screen |

Video Stabilization: Split-screen (original left, stabilized right). Keypoint-based motion estimation, Gaussian motion filter, WebGL rendering with GLSL shaders, canvas fallback.

### Transforms (2 demos)

| Demo | Source | Status | Parameters |
|------|--------|--------|------------|
| Warp Affine | `warpAffine.ts` | New | Rotation angle, scale, translation sliders |
| Warp Perspective | `warpPerspective.ts` | New | 4 draggable corner points |

### Extras (3 demos)

| Demo | Source | Status | Parameters |
|------|--------|--------|------------|
| Side-by-Side Compare | `compare.ts` | New | Two filter dropdowns, split slider |
| Pipeline Builder | `pipeline.ts` | New | Add/remove/reorder operations, per-step preview |
| Mobile Touch Tracking | `touchFlow.ts` | New | Touch to add points, optical flow tracking |

---

## UI Components

### Parameter Panel

Custom-built control panel (no dat.GUI dependency). Renders on the right side of the canvas.

Controls:
- **Slider** — Numeric range with label, current value display, step
- **Checkbox** — Boolean toggle
- **Dropdown** — Enum selection
- **Button** — Actions (train, reset, capture)
- **Separator** — Visual grouping

Each demo declares its controls declaratively:
```typescript
export const controls: ControlDef[] = [
  { type: 'slider', key: 'threshold', label: 'Threshold', min: 1, max: 255, step: 1, default: 20 },
  { type: 'checkbox', key: 'equalize', label: 'Equalize Histogram', default: false },
  { type: 'button', key: 'train', label: 'Train Pattern' },
];
```

### Performance Profiler

Per-stage timing bar chart displayed below the canvas:
- Horizontal bars showing ms per stage (grayscale, blur, detect, draw, etc.)
- Total FPS counter
- Updates every frame
- Each demo reports timing via `profiler.start('stage')` / `profiler.end('stage')`

### Toolbar

Above the canvas:
- Resolution picker: 320x240 / 640x480 / 1280x720
- Freeze/Resume button
- Capture PNG button
- Fullscreen toggle

### Sidebar Navigation

Left sidebar grouped by category:
- Image Processing
- Feature Detection
- Face Detection
- Motion
- Transforms
- Extras
- (separator)
- API Reference
- About

Collapsible groups. Active demo highlighted. Mobile: hamburger menu.

---

## API Reference Page

Replaces the original index.html documentation. Content:

- Module-by-module documentation (core, math, imgproc, features, flow, detect, motion, transform)
- TypeScript function signatures in syntax-highlighted code blocks
- Brief description of each function
- Inline "Try it" links to corresponding demos
- Code examples for common use cases

Content is static HTML generated at build time or hand-written in the demo's source.

---

## About Page

- Project description
- Link to GitHub repo
- Credits (Eugene Zatepyakin original, TypeScript port info)
- License (MIT)

---

## Technical Architecture

### File Structure

```
demo/
├── index.html
├── src/
│   ├── main.ts                    # App shell, routing, webcam setup
│   ├── router.ts                  # Hash-based routing
│   ├── ui/
│   │   ├── sidebar.ts             # Navigation sidebar
│   │   ├── toolbar.ts             # Resolution picker, capture, fullscreen
│   │   ├── controls.ts            # Parameter panel renderer
│   │   ├── profiler.ts            # Performance timing display
│   │   └── styles.ts              # CSS-in-JS or imported CSS
│   ├── demos/
│   │   ├── grayscale.ts
│   │   ├── boxBlur.ts
│   │   ├── gaussianBlur.ts
│   │   ├── pyrDown.ts
│   │   ├── equalizeHist.ts
│   │   ├── sobel.ts
│   │   ├── scharr.ts
│   │   ├── edges.ts
│   │   ├── corners.ts
│   │   ├── yape06.ts
│   │   ├── yape.ts
│   │   ├── orbMatch.ts
│   │   ├── faceDetect.ts
│   │   ├── bbfFace.ts
│   │   ├── opticalFlow.ts
│   │   ├── videoStab.ts
│   │   ├── warpAffine.ts
│   │   ├── warpPerspective.ts
│   │   ├── compare.ts
│   │   ├── pipeline.ts
│   │   └── touchFlow.ts
│   ├── pages/
│   │   ├── apiReference.ts        # API docs page
│   │   └── about.ts               # About page
│   └── lib/
│       ├── webgl.ts               # WebGL helpers for video stab
│       └── demoBase.ts            # Common demo interface/lifecycle
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Demo Interface

Every demo implements:
```typescript
export interface Demo {
  title: string;
  category: string;
  description: string;
  controls: ControlDef[];
  setup(canvas: HTMLCanvasElement, video: HTMLVideoElement, params: Record<string, unknown>): void;
  process(ctx: CanvasRenderingContext2D, profiler: Profiler): void;
  onParamChange?(key: string, value: unknown): void;
  cleanup(): void;
}
```

### Routing

Hash-based routing: `#/demos/corners`, `#/demos/orb-match`, `#/api`, `#/about`. Default: `#/demos/grayscale`.

### Responsive Layout

```
Desktop (>768px):           Mobile (<768px):
┌────┬─────────┬──────┐     ┌──────────────┐
│    │         │      │     │ ☰ Demo Name  │
│ S  │ Canvas  │ Ctrl │     ├──────────────┤
│ i  │         │ Pnl  │     │    Canvas    │
│ d  │         │      │     ├──────────────┤
│ e  ├─────────┤      │     │   Controls   │
│ b  │Profiler │      │     ├──────────────┤
│ a  │         │      │     │   Profiler   │
│ r  │         │      │     └──────────────┘
└────┴─────────┴──────┘
```

---

## Styling

- Dark theme (already established)
- No CSS framework — vanilla CSS
- CSS custom properties for theming
- Minimal, functional aesthetic
- Monospace font for code/values
