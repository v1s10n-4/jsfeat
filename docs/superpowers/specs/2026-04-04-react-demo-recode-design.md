# React Demo App Recode — Design Specification

## Overview

Complete recode of the jsfeat demo app from vanilla TypeScript to a React SPA with shadcn/ui. Replaces the broken, non-responsive demo shell with a polished, mobile-first application featuring a Pipeline Studio homepage, individual demo pages, API reference, and about page. Hosted on GitHub Pages.

**Why:** The current vanilla TS demo has broken mobile scrolling, non-responsive layout, broken About/API pages, limited pipeline editor, and HAAR face detection that freezes at 3 FPS. A React + shadcn rebuild fixes all issues and provides a modern, maintainable UI.

---

## Decisions

| Aspect | Decision |
|---|---|
| Framework | Vite + React 19 + TypeScript |
| UI Library | shadcn/ui (Tailwind CSS 4) |
| Routing | react-router-dom v7 with HashRouter (GitHub Pages) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Icons | lucide-react |
| Syntax Highlighting | shiki |
| E2E Testing | Playwright |
| State | React Context + hooks (no external state lib) |
| Deployment | GitHub Pages via GitHub Actions |
| HAAR/BBF Performance | Web Worker + downsampled detection |
| Pipeline Editor | Linear card chain with dnd-kit |

---

## Routes

```
#/                    → Pipeline Studio (homepage)
#/demos               → Demo grid (all demos by category)
#/demos/:id           → Individual demo page
#/docs                → API Reference (tabbed by module)
#/about               → About page
```

---

## Pipeline Studio (Homepage)

The main showcase. A visual pipeline editor where users chain CV operations and see real-time results on webcam input.

### Layout
- **Desktop:** Canvas on the left (flex-grow), pipeline chain on the right (320px, scrollable)
- **Mobile:** Canvas on top, pipeline chain below (full-width, scrollable)

### Pipeline Chain
- Vertical list of draggable stage cards (@dnd-kit/sortable)
- Each card shows: stage name + icon, inline controls (sliders/selects), delete button, drag handle
- "+" button at bottom opens a categorized stage picker (shadcn Dialog)
- Unlimited stages

### Available Stages (categorized in picker)
- **Image Processing:** Grayscale, Box Blur, Gaussian Blur, Pyramid Down, Equalize Histogram
- **Edge/Gradient:** Canny Edges, Sobel, Scharr
- **Feature Detection:** FAST Corners, YAPE06, YAPE
- **Face Detection:** HAAR Face, BBF Face
- **Transforms:** Warp Affine, Warp Perspective

### Per-Stage Controls
Each stage type declares its own controls (sliders, selects, checkboxes). Rendered inline on the card. Examples:
- Gaussian Blur: kernel size (3-15), sigma (0-10)
- Canny Edges: low threshold (1-127), high threshold (1-255)
- FAST Corners: threshold (5-100), border (1-10)
- HAAR Face: scale factor, min neighbors, equalize toggle

### Default Pipeline
"Trading Card Detection" — optimized for detecting rectangular trading cards (Pokemon, MTG, Sorcery, One Piece):
1. Grayscale
2. Gaussian Blur (kernel 5, sigma 1.5)
3. Canny Edges (low 30, high 80)
4. FAST Corners (threshold 40)

Subtitle on homepage: "Build real-time computer vision pipelines. Default: Trading Card Detection."
"Reset to default" button.

### Webcam Toolbar (above canvas)
- Resolution picker (320x240, 640x480, 1280x720)
- Freeze/Resume toggle
- Capture PNG download
- Fullscreen toggle

### Profiler
- Per-stage timing bar chart below canvas
- Collapsible on mobile (single-line FPS, tap to expand)
- Throttled rendering (update every 200ms, not every frame)

---

## Demo Pages

### Grid View (`#/demos`)
- Responsive grid of demo cards (shadcn Card), grouped by category
- Each card: title, one-line description, category badge
- Click → navigates to `#/demos/:id`

### Categories
- Image Processing (8): Grayscale, Box Blur, Gaussian Blur, Pyramid Down, Equalize Histogram, Sobel, Scharr, Canny Edges
- Feature Detection (4): FAST Corners, YAPE06, YAPE, ORB Pattern Matching
- Face Detection (2): HAAR Face, BBF Face
- Motion (2): Optical Flow LK, Video Stabilization
- Transforms (2): Warp Affine, Warp Perspective
- Extras (1): Touch Tracking

### Individual Demo (`#/demos/:id`)
- Canvas with webcam toolbar above, profiler below
- Controls in right panel (desktop) or bottom Sheet (mobile)
- Description text at top
- Back button to grid

### Performance
- HAAR and BBF demos use Web Worker + downsampled detection (320x240 internally, scale rects to display size)
- All demos lazy-loaded via `React.lazy` + `Suspense`

---

## Docs Page (`#/docs`)

API reference using shadcn Tabs for module sections:
- Core, Math, Image Processing, Features, Optical Flow, Detection, Motion, Transform

Each tab shows functions with:
- TypeScript signature in syntax-highlighted code block (shiki, dark theme)
- One-line description
- "Try it →" link to corresponding demo

Responsive: tabs become a Select dropdown on mobile.

---

## About Page (`#/about`)

Simple content page using shadcn Card:
- Project title + tagline
- Feature list
- GitHub link, API Reference link
- Credits (Eugene Zatepyakin original, TypeScript port)
- MIT license

---

## Responsive Design

### Breakpoints
- **Mobile:** <768px
- **Tablet:** 768-1024px
- **Desktop:** >1024px

### Mobile (<768px)
- Top nav: compact bar with hamburger → shadcn Sheet slides in with full nav
- Canvas: scales to 100vw with aspect ratio preserved via ResizeObserver
- Controls: bottom Sheet (swipe up), full-width
- Pipeline chain: below canvas, full-width, horizontal scroll or vertical list
- Profiler: single-line FPS counter, tap to expand
- `viewport-fit=cover` + safe area padding for notched devices
- All touch targets ≥48px

### Tablet (768-1024px)
- Controls panel as toggleable right Sheet
- Canvas fills available width
- Pipeline chain in right panel, collapsible

### Desktop (>1024px)
- Full three-column layout where applicable
- Controls always visible in right panel

---

## Web Worker for Detection

`workers/detection.worker.ts`:
- Receives: downsampled grayscale image data (Uint8Array), width, height, cascade data, params
- Runs: computeIntegralImage → haarDetectMultiScale/bbfDetect → groupRectangles
- Returns: array of `{x, y, width, height}` rects (scaled back to original resolution)

`useDetectionWorker` hook:
- Manages worker lifecycle
- Sends frames at a throttled rate (e.g., every 100ms)
- Returns latest detection results for overlay rendering

---

## Testing (Playwright)

### Test Files
- `navigation.spec.ts` — All routes load, nav links work, back/forward
- `pipeline.spec.ts` — Add stage, remove stage, drag reorder, controls change values, reset to default
- `responsive.spec.ts` — iPhone viewport (375x812): hamburger menu, bottom sheet, canvas scaling
- `demos.spec.ts` — 3+ demos load without console errors (use `--use-fake-device-for-media-stream`)
- `docs.spec.ts` — All module tabs render, code blocks present

---

## File Structure

```
demo/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── ui/                         # shadcn (auto-generated)
│   │   ├── layout/
│   │   │   ├── TopNav.tsx
│   │   │   ├── MobileSheet.tsx
│   │   │   └── CanvasView.tsx
│   │   ├── pipeline/
│   │   │   ├── PipelineStudio.tsx
│   │   │   ├── StageCard.tsx
│   │   │   ├── StageControls.tsx
│   │   │   ├── StagePicker.tsx
│   │   │   └── stageRegistry.ts
│   │   ├── demos/
│   │   │   ├── DemoGrid.tsx
│   │   │   ├── DemoPage.tsx
│   │   │   └── ControlsPanel.tsx
│   │   ├── docs/
│   │   │   └── ApiReference.tsx
│   │   └── about/
│   │       └── AboutPage.tsx
│   ├── hooks/
│   │   ├── useWebcam.ts
│   │   ├── useCanvas.ts
│   │   ├── useAnimationLoop.ts
│   │   ├── useProfiler.ts
│   │   ├── useDetectionWorker.ts
│   │   └── useMediaQuery.ts
│   ├── workers/
│   │   └── detection.worker.ts
│   ├── lib/
│   │   ├── demos.ts
│   │   ├── pipeline.ts
│   │   └── stages.ts
│   └── pages/
│       ├── PipelinePage.tsx
│       ├── DemosPage.tsx
│       ├── DemoDetailPage.tsx
│       ├── DocsPage.tsx
│       └── AboutPage.tsx
├── tests/
│   ├── navigation.spec.ts
│   ├── pipeline.spec.ts
│   ├── demos.spec.ts
│   ├── responsive.spec.ts
│   └── docs.spec.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── playwright.config.ts
└── components.json
```

---

## What Gets Deleted

The entire current `demo/` directory is replaced. The old vanilla TS demo is removed. The core jsfeat library (`src/`, `test/`) is NOT touched.
