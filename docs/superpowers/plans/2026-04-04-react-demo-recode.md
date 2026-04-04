# React Demo App Recode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken vanilla TS demo with a polished React + shadcn/ui SPA featuring Pipeline Studio, 19 demos, API reference, and Playwright tests.

**Architecture:** Vite + React 19 SPA with HashRouter for GitHub Pages. shadcn/ui provides all UI components. Canvas rendering stays imperative (refs + rAF), wrapped in React via custom hooks. Web Workers handle HAAR/BBF detection. Pipeline Studio uses @dnd-kit for drag-and-drop stage ordering.

**Tech Stack:** React 19, TypeScript, Vite, shadcn/ui, Tailwind CSS 4, react-router-dom v7, @dnd-kit, lucide-react, Playwright

**Spec:** `docs/superpowers/specs/2026-04-04-react-demo-recode-design.md`

---

### Task 1: Project Scaffolding

**Files:**
- Delete: `demo/` (entire old demo)
- Create: `demo/` (new React project)

Completely replace the demo directory with a fresh Vite + React + TypeScript project, then install and configure shadcn/ui.

- [ ] **Step 1: Delete old demo directory**

```bash
rm -rf demo/
```

- [ ] **Step 2: Create new Vite React project**

```bash
npm create vite@latest demo -- --template react-ts
cd demo
npm install
```

- [ ] **Step 3: Install core dependencies**

```bash
cd demo
npm install react-router-dom @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities lucide-react
npm install -D @playwright/test @tailwindcss/vite
```

- [ ] **Step 4: Configure Vite with Tailwind and path aliases**

Rewrite `demo/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/jsfeat/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../dist-demo',
  },
});
```

Update `demo/tsconfig.json` — set `compilerOptions.baseUrl` to `"."` and add `paths: { "@/*": ["./src/*"] }`. Set `"target": "ES2022"`, `"moduleResolution": "bundler"`.

Update `demo/tsconfig.app.json` similarly.

- [ ] **Step 5: Initialize shadcn/ui**

```bash
cd demo
npx shadcn@latest init
```

Select: TypeScript, default style, base color neutral, CSS variables yes. This creates `components.json` and `src/components/ui/`.

- [ ] **Step 6: Add required shadcn components**

```bash
cd demo
npx shadcn@latest add button card dialog tabs select slider sheet scroll-area badge tooltip separator input label switch popover dropdown-menu
```

- [ ] **Step 7: Set up Tailwind CSS entry**

Replace `demo/src/index.css` with:
```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: oklch(0.13 0.02 260);
  --color-foreground: oklch(0.93 0.01 260);
  --color-card: oklch(0.16 0.02 260);
  --color-card-foreground: oklch(0.93 0.01 260);
  --color-primary: oklch(0.65 0.2 10);
  --color-primary-foreground: oklch(0.98 0 0);
  --color-muted: oklch(0.22 0.02 260);
  --color-muted-foreground: oklch(0.6 0.02 260);
  --color-accent: oklch(0.22 0.02 260);
  --color-accent-foreground: oklch(0.93 0.01 260);
  --color-border: oklch(0.25 0.02 260);
  --color-ring: oklch(0.65 0.2 10);
  --color-input: oklch(0.25 0.02 260);
  --radius: 0.5rem;
}

body {
  @apply bg-background text-foreground;
}
```

- [ ] **Step 8: Clean up default files**

Remove `demo/src/App.css`, `demo/src/assets/`, default Vite boilerplate. Replace `demo/src/App.tsx` with a minimal placeholder:

```tsx
export default function App() {
  return <div className="min-h-screen bg-background text-foreground">jsfeat demo</div>;
}
```

Replace `demo/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Update `demo/index.html`: add `<html class="dark">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, title "jsfeat — Computer Vision in TypeScript".

- [ ] **Step 9: Add jsfeat as dependency**

```bash
cd demo
npm install jsfeat@file:..
```

- [ ] **Step 10: Verify it builds**

```bash
cd demo && npm run dev
# Should start on localhost, show "jsfeat demo" text
# Ctrl+C to stop
npm run build
# Should output to ../dist-demo/ without errors
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(demo): scaffold React + shadcn/ui project replacing vanilla TS demo"
```

---

### Task 2: Core Hooks

**Files:**
- Create: `demo/src/hooks/useWebcam.ts`
- Create: `demo/src/hooks/useCanvas.ts`
- Create: `demo/src/hooks/useAnimationLoop.ts`
- Create: `demo/src/hooks/useProfiler.ts`
- Create: `demo/src/hooks/useMediaQuery.ts`

These hooks encapsulate all imperative browser APIs (webcam, canvas, rAF) behind clean React interfaces.

- [ ] **Step 1: Create useWebcam hook**

```typescript
// demo/src/hooks/useWebcam.ts
import { useRef, useState, useCallback } from 'react';

interface WebcamOptions {
  width: number;
  height: number;
}

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (opts: WebcamOptions) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: opts.width }, height: { ideal: opts.height }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
      setError(null);
    } catch (err) {
      setError('Camera access denied. Please allow camera access and reload.');
      setIsActive(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsActive(false);
  }, []);

  return { videoRef, isActive, error, start, stop };
}
```

- [ ] **Step 2: Create useCanvas hook**

```typescript
// demo/src/hooks/useCanvas.ts
import { useRef, useEffect, useState, useCallback } from 'react';

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });

  const setResolution = useCallback((w: number, h: number) => {
    setDimensions({ width: w, height: h });
    if (canvasRef.current) {
      canvasRef.current.width = w;
      canvasRef.current.height = h;
    }
  }, []);

  const capture = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `jsfeat-capture-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  const getCtx = useCallback(() => {
    return canvasRef.current?.getContext('2d') ?? null;
  }, []);

  return { canvasRef, containerRef, dimensions, setResolution, capture, getCtx };
}
```

- [ ] **Step 3: Create useAnimationLoop hook**

```typescript
// demo/src/hooks/useAnimationLoop.ts
import { useRef, useCallback, useEffect } from 'react';

export function useAnimationLoop(callback: () => void, active: boolean) {
  const rafRef = useRef<number>(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const loop = useCallback(() => {
    callbackRef.current();
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    if (active) {
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, loop]);
}
```

- [ ] **Step 4: Create useProfiler hook**

```typescript
// demo/src/hooks/useProfiler.ts
import { useRef, useState, useCallback } from 'react';

export interface ProfilerTimings {
  stages: { name: string; ms: number }[];
  totalMs: number;
  fps: number;
}

export function useProfiler() {
  const stagesRef = useRef<Map<string, number>>(new Map());
  const timingsRef = useRef<Map<string, number>>(new Map());
  const frameStartRef = useRef(0);
  const fpsFrames = useRef(0);
  const fpsLastTime = useRef(performance.now());
  const fpsRef = useRef(0);
  const [display, setDisplay] = useState<ProfilerTimings>({ stages: [], totalMs: 0, fps: 0 });
  const lastUpdateRef = useRef(0);

  const frameStart = useCallback(() => {
    frameStartRef.current = performance.now();
    timingsRef.current.clear();
  }, []);

  const start = useCallback((name: string) => {
    stagesRef.current.set(name, performance.now());
  }, []);

  const end = useCallback((name: string) => {
    const s = stagesRef.current.get(name);
    if (s !== undefined) timingsRef.current.set(name, performance.now() - s);
  }, []);

  const frameEnd = useCallback(() => {
    const totalMs = performance.now() - frameStartRef.current;
    fpsFrames.current++;
    const now = performance.now();
    if (now - fpsLastTime.current >= 1000) {
      fpsRef.current = fpsFrames.current;
      fpsFrames.current = 0;
      fpsLastTime.current = now;
    }
    // Throttle display updates to every 200ms
    if (now - lastUpdateRef.current > 200) {
      lastUpdateRef.current = now;
      const stages: { name: string; ms: number }[] = [];
      for (const [name, ms] of timingsRef.current) {
        stages.push({ name, ms });
      }
      setDisplay({ stages, totalMs, fps: fpsRef.current });
    }
  }, []);

  return { frameStart, start, end, frameEnd, display };
}
```

- [ ] **Step 5: Create useMediaQuery hook**

```typescript
// demo/src/hooks/useMediaQuery.ts
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
```

- [ ] **Step 6: Commit**

```bash
git add demo/src/hooks/
git commit -m "feat(demo): add core hooks — useWebcam, useCanvas, useAnimationLoop, useProfiler, useMediaQuery"
```

---

### Task 3: Layout & Routing

**Files:**
- Create: `demo/src/components/layout/TopNav.tsx`
- Create: `demo/src/components/layout/CanvasView.tsx`
- Rewrite: `demo/src/App.tsx`
- Rewrite: `demo/src/main.tsx`
- Create: `demo/src/pages/PipelinePage.tsx` (placeholder)
- Create: `demo/src/pages/DemosPage.tsx` (placeholder)
- Create: `demo/src/pages/DemoDetailPage.tsx` (placeholder)
- Create: `demo/src/pages/DocsPage.tsx` (placeholder)
- Create: `demo/src/pages/AboutPage.tsx` (placeholder)

- [ ] **Step 1: Create TopNav component**

Responsive top navigation bar using shadcn components. Desktop: horizontal nav links. Mobile (<768px): hamburger button → shadcn Sheet with nav links.

Uses `lucide-react` icons (Menu, X, FlaskConical, LayoutGrid, BookOpen, Info).
Links: Pipeline (`#/`), Demos (`#/demos`), Docs (`#/docs`), About (`#/about`).
Active link highlighted via `useLocation()` from react-router-dom.

- [ ] **Step 2: Create CanvasView component**

Reusable canvas + toolbar + profiler wrapper. Props:
- `canvasRef`, `videoRef`, `dimensions`, `onResolutionChange`, `onCapture`, `onFreeze`, `frozen`, `profilerDisplay`

Renders:
- Toolbar row: resolution Select (320x240/640x480/1280x720), freeze Button, capture Button, fullscreen Button
- Canvas element with `ref`
- Hidden video element with `ref`
- Profiler bar below canvas (collapsible on mobile)

Uses shadcn Select, Button, and Tooltip components.

- [ ] **Step 3: Set up routing in main.tsx and App.tsx**

`main.tsx`: Wrap `<App />` in `<HashRouter>`.

`App.tsx`: Layout shell with `<TopNav />` at top, `<main>` area with `<Routes>`:
```tsx
<Routes>
  <Route path="/" element={<PipelinePage />} />
  <Route path="/demos" element={<DemosPage />} />
  <Route path="/demos/:id" element={<DemoDetailPage />} />
  <Route path="/docs" element={<DocsPage />} />
  <Route path="/about" element={<AboutPage />} />
</Routes>
```

- [ ] **Step 4: Create placeholder pages**

Each page file exports a simple component with the page title so routing can be verified:
```tsx
// demo/src/pages/PipelinePage.tsx
export default function PipelinePage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Pipeline Studio</h1></div>;
}
```

Same for DemosPage, DemoDetailPage, DocsPage, AboutPage.

- [ ] **Step 5: Verify routing works**

```bash
cd demo && npm run dev
# Navigate to #/, #/demos, #/docs, #/about — each shows its title
```

- [ ] **Step 6: Commit**

```bash
git add demo/src/
git commit -m "feat(demo): add layout, top nav, routing with placeholder pages"
```

---

### Task 4: Pipeline Infrastructure

**Files:**
- Create: `demo/src/lib/stages.ts`
- Create: `demo/src/lib/pipeline.ts`

The stage registry defines all available pipeline stages with their controls and processing functions. The pipeline engine applies stages sequentially.

- [ ] **Step 1: Create stage registry**

`demo/src/lib/stages.ts` — Defines:

```typescript
export interface StageControl {
  type: 'slider' | 'select' | 'checkbox';
  key: string;
  label: string;
  // Slider-specific
  min?: number;
  max?: number;
  step?: number;
  default?: number;
  // Select-specific
  options?: { value: string; label: string }[];
  defaultValue?: string;
  // Checkbox-specific
  defaultChecked?: boolean;
}

export interface StageDefinition {
  id: string;
  name: string;
  category: 'Image Processing' | 'Edge/Gradient' | 'Feature Detection' | 'Face Detection' | 'Transforms';
  icon: string; // lucide icon name
  controls: StageControl[];
  process: (input: ImageProcessingContext, params: Record<string, unknown>) => void;
}

export interface ImageProcessingContext {
  gray: Matrix;
  imageData: ImageData;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  // Scratch buffers
  buf: Matrix;
  derivBuf: Matrix;
}
```

Register ALL stages: grayscale, boxBlur, gaussianBlur, pyrDown, equalizeHist, canny, sobel, scharr, fastCorners, yape06, yape, haarFace, bbfFace, warpAffine, warpPerspective.

Each stage's `process` function calls the corresponding jsfeat function and renders the result to `ctx`. Import from `jsfeat/core`, `jsfeat/imgproc`, `jsfeat/features`, `jsfeat/detect`, `jsfeat/cascades`.

For HAAR/BBF stages, use synchronous processing initially (Web Worker comes in a later task).

- [ ] **Step 2: Create pipeline engine**

`demo/src/lib/pipeline.ts`:

```typescript
export interface PipelineStage {
  id: string;       // unique instance id (uuid)
  stageId: string;  // references StageDefinition.id
  params: Record<string, unknown>;
}

export function runPipeline(
  stages: PipelineStage[],
  registry: Map<string, StageDefinition>,
  ctx: ImageProcessingContext,
  profiler: { start: (n: string) => void; end: (n: string) => void },
): void {
  for (const stage of stages) {
    const def = registry.get(stage.stageId);
    if (!def) continue;
    profiler.start(def.name);
    def.process(ctx, stage.params);
    profiler.end(def.name);
  }
}

export function createDefaultPipeline(): PipelineStage[] {
  return [
    { id: crypto.randomUUID(), stageId: 'grayscale', params: {} },
    { id: crypto.randomUUID(), stageId: 'gaussianBlur', params: { kernelSize: 5, sigma: 1.5 } },
    { id: crypto.randomUUID(), stageId: 'canny', params: { low: 30, high: 80 } },
    { id: crypto.randomUUID(), stageId: 'fastCorners', params: { threshold: 40, border: 3 } },
  ];
}
```

- [ ] **Step 3: Commit**

```bash
git add demo/src/lib/
git commit -m "feat(demo): add stage registry and pipeline engine with 15 stage types"
```

---

### Task 5: Pipeline Studio Page

**Files:**
- Create: `demo/src/components/pipeline/PipelineStudio.tsx`
- Create: `demo/src/components/pipeline/StageCard.tsx`
- Create: `demo/src/components/pipeline/StageControls.tsx`
- Create: `demo/src/components/pipeline/StagePicker.tsx`
- Rewrite: `demo/src/pages/PipelinePage.tsx`

This is the homepage — the main showcase.

- [ ] **Step 1: Create StageControls component**

Renders inline controls for a stage card based on `StageControl[]` definitions. Uses shadcn Slider, Select, Switch. Each change calls an `onChange(key, value)` callback.

- [ ] **Step 2: Create StageCard component**

A draggable card (using `useSortable` from @dnd-kit) showing:
- Drag handle icon (GripVertical from lucide)
- Stage name + icon
- StageControls rendered inline
- Delete button (Trash2 icon)

Uses shadcn Card component.

- [ ] **Step 3: Create StagePicker component**

A shadcn Dialog that opens when "+" is clicked. Shows available stages grouped by category. Clicking a stage adds it to the pipeline.

Uses shadcn Dialog, ScrollArea, Badge for categories.

- [ ] **Step 4: Create PipelineStudio component**

Main component combining:
- CanvasView (left/top)
- Pipeline chain (right/bottom): DndContext + SortableContext wrapping a list of StageCards
- "+" button → StagePicker dialog
- "Reset to default" button
- Subtitle text

Manages pipeline state (array of PipelineStage), handles drag end (arrayMove), add, remove, param change.

Uses useWebcam, useCanvas, useAnimationLoop, useProfiler hooks. Each frame: draw video → run pipeline → profiler.

- [ ] **Step 5: Wire into PipelinePage**

`PipelinePage.tsx` renders `<PipelineStudio />`.

- [ ] **Step 6: Verify Pipeline Studio works**

```bash
cd demo && npm run dev
# Navigate to #/ — should see webcam canvas + pipeline chain
# Add/remove/reorder stages, adjust controls
```

- [ ] **Step 7: Commit**

```bash
git add demo/src/components/pipeline/ demo/src/pages/PipelinePage.tsx
git commit -m "feat(demo): add Pipeline Studio with drag-and-drop stages, controls, and stage picker"
```

---

### Task 6: Demo Infrastructure

**Files:**
- Create: `demo/src/lib/demos.ts`
- Create: `demo/src/components/demos/DemoGrid.tsx`
- Create: `demo/src/components/demos/DemoPage.tsx`
- Create: `demo/src/components/demos/ControlsPanel.tsx`
- Rewrite: `demo/src/pages/DemosPage.tsx`
- Rewrite: `demo/src/pages/DemoDetailPage.tsx`

- [ ] **Step 1: Create demo registry**

`demo/src/lib/demos.ts` — Array of demo definitions:

```typescript
export interface DemoControl {
  type: 'slider' | 'select' | 'checkbox' | 'button';
  key: string;
  label: string;
  min?: number; max?: number; step?: number; default?: number;
  options?: { value: string; label: string }[];
  defaultValue?: string;
  defaultChecked?: boolean;
}

export interface DemoDefinition {
  id: string;
  title: string;
  category: string;
  description: string;
  controls: DemoControl[];
  setup: (canvas: HTMLCanvasElement, video: HTMLVideoElement, params: Record<string, unknown>) => void;
  process: (ctx: CanvasRenderingContext2D, video: HTMLVideoElement, w: number, h: number, profiler: { start: (n: string) => void; end: (n: string) => void }) => void;
  onParamChange?: (key: string, value: unknown) => void;
  cleanup: () => void;
}
```

Register all 19 demos (8 imgproc + 4 features + 2 face + 2 motion + 2 transforms + 1 extra). Implementation functions imported from separate files per demo (created in subsequent tasks). Start with 3 working demos (grayscale, edges, corners) to validate the infrastructure — the rest start as placeholders.

- [ ] **Step 2: Create DemoGrid component**

Responsive grid of shadcn Cards, grouped by category (using section headers). Each card shows title, description, category Badge. Click navigates to `#/demos/:id`.

- [ ] **Step 3: Create ControlsPanel component**

Desktop: right panel (w-64). Mobile: shadcn Sheet from bottom. Renders controls from a `DemoControl[]` array using shadcn Slider, Select, Switch, Button. Calls `onParamChange` on each interaction.

- [ ] **Step 4: Create DemoPage component**

Wraps CanvasView + ControlsPanel. Looks up demo by `id` param from URL, calls setup/process/cleanup lifecycle. Description text at top. Back button to grid.

Uses all hooks: useWebcam, useCanvas, useAnimationLoop, useProfiler.

- [ ] **Step 5: Wire into page components**

`DemosPage.tsx` renders `<DemoGrid />`. `DemoDetailPage.tsx` renders `<DemoPage />`.

- [ ] **Step 6: Verify with the 3 initial demos**

```bash
cd demo && npm run dev
# Navigate to #/demos — grid of cards visible
# Click "Grayscale" — canvas with webcam, controls panel, profiler
```

- [ ] **Step 7: Commit**

```bash
git add demo/src/lib/demos.ts demo/src/components/demos/ demo/src/pages/DemosPage.tsx demo/src/pages/DemoDetailPage.tsx
git commit -m "feat(demo): add demo infrastructure — grid, detail page, controls panel"
```

---

### Task 7: All Demo Implementations

**Files:**
- Create: `demo/src/demos/` directory with one file per demo

19 demo implementation files. Each exports functions matching `DemoDefinition` (setup, process, cleanup, onParamChange). Follow the patterns established by the existing corners/edges/grayscale demos from the old codebase.

Group into sub-steps:

- [ ] **Step 1: Image Processing demos (8)**

Create: `grayscale.ts`, `boxBlur.ts`, `gaussianBlur.ts`, `pyrDown.ts`, `equalizeHist.ts`, `sobel.ts`, `scharr.ts`, `cannyEdges.ts`

Each follows the pattern: grayscale conversion → apply filter → render result to canvas. Add profiler calls around each stage.

- [ ] **Step 2: Feature Detection demos (4)**

Create: `fastCorners.ts`, `yape06.ts`, `yape.ts`, `orbMatch.ts`

FAST/YAPE/YAPE06: detect features → draw circles/markers on canvas.

ORB Match: complex — train button freezes frame, computes pattern descriptors. Each subsequent frame: detect + describe + match + RANSAC homography + draw green outline. Port the matching logic from the old `demo/src/demos/orbMatch.ts`.

- [ ] **Step 3: Face Detection demos (2)**

Create: `haarFace.ts`, `bbfFace.ts`

**Important:** These must downsample to 320x240 (or lower) before detection to avoid the 3 FPS freeze. Scale detected rects back to display resolution. Initially synchronous — Web Worker added in Task 8.

- [ ] **Step 4: Motion demos (2)**

Create: `opticalFlow.ts`, `videoStab.ts`

Optical Flow: FAST detection + LK tracking with flow vectors drawn. Port from old demo.

Video Stab: split-screen (original left, stabilized right). FAST + LK + RANSAC motion estimation + Gaussian trajectory smoothing + canvas setTransform for warped rendering. Port from old demo.

- [ ] **Step 5: Transform + Extras demos (3)**

Create: `warpAffine.ts`, `warpPerspective.ts`, `touchFlow.ts`

Warp Affine: rotation/scale/translate sliders → compute affine matrix → warpAffine → render.
Warp Perspective: 4 draggable corners → compute homography → warp → render.
Touch Flow: click/tap to add tracking points + LK flow.

- [ ] **Step 6: Register all demos in the registry**

Update `demo/src/lib/demos.ts` to import all 19 demo files and register them with proper categories, titles, descriptions, and controls.

- [ ] **Step 7: Verify all demos load**

```bash
cd demo && npm run dev
# Click through each demo in the grid, verify canvas renders
```

- [ ] **Step 8: Commit**

```bash
git add demo/src/demos/ demo/src/lib/demos.ts
git commit -m "feat(demo): implement all 19 demos — imgproc, features, face, motion, transforms"
```

---

### Task 8: Web Worker for Face Detection

**Files:**
- Create: `demo/src/workers/detection.worker.ts`
- Create: `demo/src/hooks/useDetectionWorker.ts`
- Modify: `demo/src/demos/haarFace.ts`
- Modify: `demo/src/demos/bbfFace.ts`

- [ ] **Step 1: Create detection worker**

`demo/src/workers/detection.worker.ts`:

The worker receives a message with:
- `type: 'haar' | 'bbf'`
- `imageData: Uint8Array` (downsampled grayscale)
- `width, height` (downsampled dimensions)
- `params` (scaleFactor, minNeighbors, etc.)
- `scaleX, scaleY` (ratio to scale rects back to display size)

The worker imports jsfeat modules, runs detection, and posts back an array of `{x, y, width, height}` rects scaled to display resolution.

Note: The worker needs to import from the jsfeat library. Use Vite's worker import syntax: `new Worker(new URL('./workers/detection.worker.ts', import.meta.url), { type: 'module' })`.

- [ ] **Step 2: Create useDetectionWorker hook**

```typescript
// demo/src/hooks/useDetectionWorker.ts
// Manages worker lifecycle
// Exposes: detect(grayData, w, h, params) → Promise<Rect[]>
// Throttles to max 1 pending request at a time
// Returns latest results array as state
```

- [ ] **Step 3: Update haarFace.ts and bbfFace.ts to use worker**

Instead of running detection synchronously in the rAF loop:
1. Each frame: draw video, convert to grayscale, downsample to 320x240
2. Send downsampled data to worker (non-blocking)
3. Draw latest detection results (from previous worker response) as overlay rectangles
4. This decouples render FPS (60) from detection FPS (~10-15)

- [ ] **Step 4: Verify face detection runs smoothly**

```bash
cd demo && npm run dev
# Open HAAR Face demo — should run at 30+ FPS with detection overlays updating at ~10 FPS
```

- [ ] **Step 5: Commit**

```bash
git add demo/src/workers/ demo/src/hooks/useDetectionWorker.ts demo/src/demos/haarFace.ts demo/src/demos/bbfFace.ts
git commit -m "feat(demo): add Web Worker for HAAR/BBF face detection — 60fps render + async detection"
```

---

### Task 9: API Reference Page (TypeDoc JSON)

**Files:**
- Modify: `typedoc.json` (add JSON output)
- Modify: `package.json` (update docs script)
- Modify: `.gitignore` (add docs/api.json)
- Create: `demo/src/components/docs/ApiReference.tsx`
- Rewrite: `demo/src/pages/DocsPage.tsx`

- [ ] **Step 1: Update TypeDoc config for JSON output**

Add to root `typedoc.json`:
```json
{
  "entryPoints": [...],
  "out": "docs/api",
  "json": "docs/api.json"
}
```

Update root `package.json` `docs` script to generate both HTML and JSON.
Add `docs/api.json` to `.gitignore`.

Run: `npm run docs` — verify `docs/api.json` is generated.

- [ ] **Step 2: Create ApiReference component**

`demo/src/components/docs/ApiReference.tsx`:

Imports `apiData` from `../../docs/api.json` (Vite resolves this at build time).

Renders:
- Search/filter input at top (shadcn Input)
- shadcn Tabs with one tab per module
- On mobile: Tabs replaced with shadcn Select dropdown
- Each function/class/type as a shadcn Card with:
  - Name as heading
  - Signature in `<pre className="bg-muted p-3 rounded text-sm overflow-x-auto"><code>` block
  - Description text
  - Parameters table (if applicable)
  - "Try it →" link mapped via a lookup object `{ functionName: demoId }`

Parse the TypeDoc JSON structure: `apiData.children` are modules, each module has `children` which are functions/classes/interfaces. Extract `name`, `signatures[0].parameters`, `signatures[0].comment.summary`, `signatures[0].type` for each.

- [ ] **Step 3: Wire into DocsPage**

`DocsPage.tsx` renders `<ApiReference />`.

- [ ] **Step 4: Verify docs page renders**

```bash
npm run docs  # generate JSON first
cd demo && npm run dev
# Navigate to #/docs — should show tabbed API reference
```

- [ ] **Step 5: Commit**

```bash
git add typedoc.json package.json .gitignore demo/src/components/docs/ demo/src/pages/DocsPage.tsx
git commit -m "feat(demo): add API reference page from TypeDoc JSON with search and Try-it links"
```

---

### Task 10: About Page

**Files:**
- Rewrite: `demo/src/pages/AboutPage.tsx`

- [ ] **Step 1: Create About page**

Simple content page using shadcn Card:

```tsx
// demo/src/pages/AboutPage.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

const features = [
  'Image Processing', 'Feature Detection', 'Optical Flow',
  'Object Detection', 'Motion Estimation', 'Linear Algebra', 'Geometric Transforms',
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">jsfeat</h1>
        <p className="text-xl text-muted-foreground">Modern TypeScript Computer Vision Library</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <p>
            jsfeat is a comprehensive computer vision library for the browser. It provides real-time
            image processing, feature detection, optical flow, object detection, and motion estimation
            — all in pure TypeScript with zero dependencies.
          </p>
          <div className="flex flex-wrap gap-2">
            {features.map((f) => (
              <Badge key={f} variant="secondary">{f}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Links</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <a href="https://github.com/v1s10n-4/jsfeat" target="_blank" rel="noopener"
             className="flex items-center gap-2 text-primary hover:underline">
            GitHub Repository <ExternalLink className="h-4 w-4" />
          </a>
          <a href="#/docs" className="flex items-center gap-2 text-primary hover:underline">
            API Reference
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Credits</CardTitle></CardHeader>
        <CardContent>
          <p>Original library by <a href="http://www.inspirit.ru/" target="_blank" rel="noopener" className="text-primary hover:underline">Eugene Zatepyakin</a>. TypeScript port and modernization.</p>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">MIT License</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add demo/src/pages/AboutPage.tsx
git commit -m "feat(demo): add about page"
```

---

### Task 11: Playwright Tests

**Files:**
- Create: `demo/playwright.config.ts`
- Create: `demo/tests/navigation.spec.ts`
- Create: `demo/tests/pipeline.spec.ts`
- Create: `demo/tests/demos.spec.ts`
- Create: `demo/tests/responsive.spec.ts`
- Create: `demo/tests/docs.spec.ts`

- [ ] **Step 1: Create Playwright config**

```typescript
// demo/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:5173/jsfeat/',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

- [ ] **Step 2: Create navigation tests**

```typescript
// demo/tests/navigation.spec.ts
import { test, expect } from '@playwright/test';

test('homepage loads Pipeline Studio', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Pipeline Studio')).toBeVisible();
});

test('demos page shows grid', async ({ page }) => {
  await page.goto('/#/demos');
  await expect(page.locator('text=Grayscale')).toBeVisible();
});

test('docs page loads', async ({ page }) => {
  await page.goto('/#/docs');
  await expect(page.locator('text=API Reference')).toBeVisible();
});

test('about page loads', async ({ page }) => {
  await page.goto('/#/about');
  await expect(page.locator('text=jsfeat')).toBeVisible();
});

test('nav links work', async ({ page }) => {
  await page.goto('/');
  await page.click('a[href="#/demos"]');
  await expect(page).toHaveURL(/#\/demos/);
  await page.click('a[href="#/docs"]');
  await expect(page).toHaveURL(/#\/docs/);
  await page.click('a[href="#/about"]');
  await expect(page).toHaveURL(/#\/about/);
});
```

- [ ] **Step 3: Create pipeline tests**

```typescript
// demo/tests/pipeline.spec.ts
import { test, expect } from '@playwright/test';

test('default pipeline has 4 stages', async ({ page }) => {
  await page.goto('/');
  const stages = page.locator('[data-testid="stage-card"]');
  await expect(stages).toHaveCount(4);
});

test('can add a stage', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="add-stage-btn"]');
  await page.click('text=Box Blur');
  const stages = page.locator('[data-testid="stage-card"]');
  await expect(stages).toHaveCount(5);
});

test('can remove a stage', async ({ page }) => {
  await page.goto('/');
  const deleteButtons = page.locator('[data-testid="delete-stage-btn"]');
  await deleteButtons.first().click();
  const stages = page.locator('[data-testid="stage-card"]');
  await expect(stages).toHaveCount(3);
});

test('reset to default restores 4 stages', async ({ page }) => {
  await page.goto('/');
  // Remove one
  await page.locator('[data-testid="delete-stage-btn"]').first().click();
  // Reset
  await page.click('text=Reset to default');
  const stages = page.locator('[data-testid="stage-card"]');
  await expect(stages).toHaveCount(4);
});
```

- [ ] **Step 4: Create demo smoke tests**

```typescript
// demo/tests/demos.spec.ts
import { test, expect } from '@playwright/test';

const demosToTest = ['grayscale', 'cannyEdges', 'fastCorners'];

for (const id of demosToTest) {
  test(`demo ${id} loads without console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`/#/demos/${id}`);
    await page.waitForTimeout(2000);
    // Filter out expected webcam errors in CI
    const realErrors = errors.filter((e) => !e.includes('getUserMedia') && !e.includes('NotAllowedError'));
    expect(realErrors).toHaveLength(0);
  });
}
```

- [ ] **Step 5: Create responsive tests**

```typescript
// demo/tests/responsive.spec.ts
import { test, expect } from '@playwright/test';

test('mobile: hamburger menu works', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  // Hamburger should be visible
  const menuBtn = page.locator('[data-testid="mobile-menu-btn"]');
  await expect(menuBtn).toBeVisible();
  await menuBtn.click();
  // Nav links should appear
  await expect(page.locator('text=Demos')).toBeVisible();
});

test('mobile: pipeline renders below canvas', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
});
```

- [ ] **Step 6: Create docs tests**

```typescript
// demo/tests/docs.spec.ts
import { test, expect } from '@playwright/test';

test('docs page has module tabs', async ({ page }) => {
  await page.goto('/#/docs');
  await expect(page.locator('text=Core')).toBeVisible();
  await expect(page.locator('text=Image Processing')).toBeVisible();
});

test('docs search filters results', async ({ page }) => {
  await page.goto('/#/docs');
  await page.fill('[placeholder*="Search"]', 'gaussian');
  await expect(page.locator('text=gaussianBlur')).toBeVisible();
});
```

- [ ] **Step 7: Install Playwright browsers and run tests**

```bash
cd demo
npx playwright install chromium
npx playwright test
```

- [ ] **Step 8: Commit**

```bash
git add demo/playwright.config.ts demo/tests/
git commit -m "test(demo): add Playwright e2e tests — navigation, pipeline, demos, responsive, docs"
```

---

### Task 12: CI/CD Update

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update CI workflow**

Add Playwright test step after library tests:
```yaml
- run: npm run docs  # generate api.json
- run: cd demo && npm ci
- run: cd demo && npx playwright install chromium --with-deps
- run: cd demo && npx playwright test
```

- [ ] **Step 2: Update deploy workflow**

Replace the old demo build steps:
```yaml
- run: npm ci
- run: npm run build
- run: npm run docs  # generates docs/api.json + docs/api/ HTML
- run: cd demo && npm ci && npm run build
- name: Combine outputs
  run: |
    mkdir -p _site
    cp -r dist-demo/* _site/
```

No longer need to copy `docs/api/` — the React app renders docs natively from the JSON.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/
git commit -m "ci: update CI/CD for React demo — Playwright tests + new build steps"
```

---

### Task 13: Final Verification & Polish

- [ ] **Step 1: Run full library test suite**

```bash
npm run test:run
# All 227 tests should still pass — core library untouched
```

- [ ] **Step 2: Build everything**

```bash
npm run build          # library build
npm run docs           # TypeDoc JSON + HTML
cd demo && npm run build  # React demo build
```

- [ ] **Step 3: Run Playwright tests**

```bash
cd demo && npx playwright test
```

- [ ] **Step 4: Test on mobile simulator**

Open demo dev server, use browser DevTools device emulation (iPhone 14, Galaxy S21). Verify:
- Hamburger menu opens/closes
- Canvas scales to viewport
- Controls bottom sheet works
- Pipeline chain scrollable below canvas
- Touch targets ≥48px

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "chore(demo): final polish and verification"
git push origin master
```
