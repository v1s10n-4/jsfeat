# Enhanced Demo SPA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the jsfeat demo SPA from 6 basic demos to 25 interactive demos with parameter controls, performance profiling, API reference, toolbar, and responsive layout.

**Architecture:** Rewrite the demo shell (main.ts, sidebar, HTML/CSS) to support a richer UI with declarative controls, profiler, and toolbar. Each demo implements a `Demo` interface that declares its controls. New demos follow established patterns from existing code.

**Tech Stack:** TypeScript, Vite, vanilla DOM, CSS custom properties, Canvas 2D, WebGL (video stab only)

**Spec:** `docs/superpowers/specs/2026-04-04-enhanced-demo-spa-design.md`

---

### Task 1: UI Controls System

**Files:**
- Create: `demo/src/ui/controls.ts`

Build a declarative parameter panel renderer. Each demo declares controls as data; this module renders them and reports changes.

- [ ] **Step 1: Create controls.ts**

```typescript
// demo/src/ui/controls.ts

export interface SliderDef {
  type: 'slider';
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface CheckboxDef {
  type: 'checkbox';
  key: string;
  label: string;
  default: boolean;
}

export interface DropdownDef {
  type: 'dropdown';
  key: string;
  label: string;
  options: { value: string; label: string }[];
  default: string;
}

export interface ButtonDef {
  type: 'button';
  key: string;
  label: string;
}

export interface SeparatorDef {
  type: 'separator';
  label?: string;
}

export type ControlDef = SliderDef | CheckboxDef | DropdownDef | ButtonDef | SeparatorDef;

export type OnChange = (key: string, value: unknown) => void;

export function buildControls(
  container: HTMLElement,
  defs: ControlDef[],
  onChange: OnChange,
): Record<string, unknown> {
  container.innerHTML = '';
  const values: Record<string, unknown> = {};

  for (const def of defs) {
    switch (def.type) {
      case 'separator': {
        const sep = document.createElement('div');
        sep.className = 'ctrl-separator';
        if (def.label) {
          const lbl = document.createElement('span');
          lbl.textContent = def.label;
          sep.appendChild(lbl);
        }
        container.appendChild(sep);
        break;
      }
      case 'slider': {
        values[def.key] = def.default;
        const row = document.createElement('div');
        row.className = 'ctrl-row';
        const label = document.createElement('label');
        label.textContent = def.label;
        const valSpan = document.createElement('span');
        valSpan.className = 'ctrl-value';
        valSpan.textContent = String(def.default);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(def.min);
        input.max = String(def.max);
        input.step = String(def.step);
        input.value = String(def.default);
        input.addEventListener('input', () => {
          const v = Number(input.value);
          values[def.key] = v;
          valSpan.textContent = String(v);
          onChange(def.key, v);
        });
        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(valSpan);
        container.appendChild(row);
        break;
      }
      case 'checkbox': {
        values[def.key] = def.default;
        const row = document.createElement('div');
        row.className = 'ctrl-row ctrl-check';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = def.default;
        input.id = `ctrl-${def.key}`;
        input.addEventListener('change', () => {
          values[def.key] = input.checked;
          onChange(def.key, input.checked);
        });
        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = def.label;
        row.appendChild(input);
        row.appendChild(label);
        container.appendChild(row);
        break;
      }
      case 'dropdown': {
        values[def.key] = def.default;
        const row = document.createElement('div');
        row.className = 'ctrl-row';
        const label = document.createElement('label');
        label.textContent = def.label;
        const select = document.createElement('select');
        for (const opt of def.options) {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          if (opt.value === def.default) o.selected = true;
          select.appendChild(o);
        }
        select.addEventListener('change', () => {
          values[def.key] = select.value;
          onChange(def.key, select.value);
        });
        row.appendChild(label);
        row.appendChild(select);
        container.appendChild(row);
        break;
      }
      case 'button': {
        const row = document.createElement('div');
        row.className = 'ctrl-row';
        const btn = document.createElement('button');
        btn.textContent = def.label;
        btn.addEventListener('click', () => onChange(def.key, true));
        row.appendChild(btn);
        container.appendChild(row);
        break;
      }
    }
  }

  return values;
}
```

- [ ] **Step 2: Commit**

```bash
git add demo/src/ui/controls.ts
git commit -m "feat(demo): add declarative parameter controls system"
```

---

### Task 2: Performance Profiler

**Files:**
- Create: `demo/src/ui/profiler.ts`

Per-stage timing with horizontal bar chart display.

- [ ] **Step 1: Create profiler.ts**

```typescript
// demo/src/ui/profiler.ts

export class Profiler {
  private stages: Map<string, number> = new Map();
  private timings: Map<string, number> = new Map();
  private startTime = 0;

  start(name: string): void {
    this.stages.set(name, performance.now());
  }

  end(name: string): void {
    const s = this.stages.get(name);
    if (s !== undefined) {
      this.timings.set(name, performance.now() - s);
    }
  }

  frameStart(): void {
    this.startTime = performance.now();
    this.timings.clear();
  }

  frameEnd(): void {
    this.timings.set('_total', performance.now() - this.startTime);
  }

  getTimings(): Map<string, number> {
    return this.timings;
  }
}

export function renderProfiler(container: HTMLElement, profiler: Profiler): void {
  const timings = profiler.getTimings();
  const total = timings.get('_total') ?? 1;
  const maxBarWidth = container.clientWidth - 120;

  let html = '';
  for (const [name, ms] of timings) {
    if (name === '_total') continue;
    const pct = Math.min(ms / total, 1);
    const barW = Math.max(2, pct * maxBarWidth);
    html += `<div class="prof-row">
      <span class="prof-label">${name}</span>
      <div class="prof-bar" style="width:${barW}px"></div>
      <span class="prof-ms">${ms.toFixed(1)}ms</span>
    </div>`;
  }
  html += `<div class="prof-row prof-total">
    <span class="prof-label">total</span>
    <span class="prof-ms">${total.toFixed(1)}ms (${Math.round(1000 / total)} fps)</span>
  </div>`;
  container.innerHTML = html;
}
```

- [ ] **Step 2: Commit**

```bash
git add demo/src/ui/profiler.ts
git commit -m "feat(demo): add per-stage performance profiler"
```

---

### Task 3: Toolbar

**Files:**
- Create: `demo/src/ui/toolbar.ts`

Resolution picker, freeze/resume, capture PNG, fullscreen toggle.

- [ ] **Step 1: Create toolbar.ts**

```typescript
// demo/src/ui/toolbar.ts

export interface ToolbarCallbacks {
  onResolutionChange(w: number, h: number): void;
  onFreeze(): void;
  onCapture(): void;
  onFullscreen(): void;
}

const RESOLUTIONS = [
  { label: '320x240', w: 320, h: 240 },
  { label: '640x480', w: 640, h: 480 },
  { label: '1280x720', w: 1280, h: 720 },
];

export function buildToolbar(container: HTMLElement, callbacks: ToolbarCallbacks): void {
  container.innerHTML = '';

  // Resolution picker
  const resSel = document.createElement('select');
  resSel.className = 'tb-select';
  for (const r of RESOLUTIONS) {
    const o = document.createElement('option');
    o.value = `${r.w}x${r.h}`;
    o.textContent = r.label;
    if (r.w === 640) o.selected = true;
    resSel.appendChild(o);
  }
  resSel.addEventListener('change', () => {
    const [w, h] = resSel.value.split('x').map(Number);
    callbacks.onResolutionChange(w, h);
  });
  container.appendChild(resSel);

  // Freeze button
  const freezeBtn = document.createElement('button');
  freezeBtn.className = 'tb-btn';
  freezeBtn.textContent = '⏸ Freeze';
  let frozen = false;
  freezeBtn.addEventListener('click', () => {
    frozen = !frozen;
    freezeBtn.textContent = frozen ? '▶ Resume' : '⏸ Freeze';
    callbacks.onFreeze();
  });
  container.appendChild(freezeBtn);

  // Capture button
  const capBtn = document.createElement('button');
  capBtn.className = 'tb-btn';
  capBtn.textContent = '📷 Capture';
  capBtn.addEventListener('click', () => callbacks.onCapture());
  container.appendChild(capBtn);

  // Fullscreen button
  const fsBtn = document.createElement('button');
  fsBtn.className = 'tb-btn';
  fsBtn.textContent = '⛶ Fullscreen';
  fsBtn.addEventListener('click', () => callbacks.onFullscreen());
  container.appendChild(fsBtn);
}
```

- [ ] **Step 2: Commit**

```bash
git add demo/src/ui/toolbar.ts
git commit -m "feat(demo): add toolbar with resolution, freeze, capture, fullscreen"
```

---

### Task 4: Demo Base Interface & Sidebar Rewrite

**Files:**
- Create: `demo/src/lib/demoBase.ts`
- Rewrite: `demo/src/ui/sidebar.ts`

- [ ] **Step 1: Create demoBase.ts**

```typescript
// demo/src/lib/demoBase.ts
import type { ControlDef } from '../ui/controls';
import type { Profiler } from '../ui/profiler';

export interface Demo {
  title: string;
  category: string;
  description: string;
  controls: ControlDef[];
  setup(canvas: HTMLCanvasElement, video: HTMLVideoElement, params: Record<string, unknown>): void;
  process(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, w: number, h: number, profiler: Profiler): void;
  onParamChange?(key: string, value: unknown): void;
  cleanup(): void;
}

export interface DemoEntry {
  id: string;
  title: string;
  category: string;
  loader: () => Promise<{ default: Demo }>;
}

export const CATEGORIES = [
  'Image Processing',
  'Feature Detection',
  'Face Detection',
  'Motion',
  'Transforms',
  'Extras',
] as const;
```

- [ ] **Step 2: Rewrite sidebar.ts with category groups**

```typescript
// demo/src/ui/sidebar.ts
import type { DemoEntry } from '../lib/demoBase';
import { CATEGORIES } from '../lib/demoBase';

export function buildSidebar(
  nav: HTMLElement,
  demos: DemoEntry[],
  onSelect: (id: string) => void,
  extraLinks?: { id: string; label: string; onClick: () => void }[],
): void {
  nav.innerHTML = '';

  for (const cat of CATEGORIES) {
    const catDemos = demos.filter((d) => d.category === cat);
    if (catDemos.length === 0) continue;

    const group = document.createElement('div');
    group.className = 'nav-group';

    const header = document.createElement('div');
    header.className = 'nav-group-header';
    header.textContent = cat;
    header.addEventListener('click', () => {
      group.classList.toggle('collapsed');
    });
    group.appendChild(header);

    for (const demo of catDemos) {
      const a = document.createElement('a');
      a.href = `#/demos/${demo.id}`;
      a.textContent = demo.title;
      a.dataset.id = demo.id;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = `/demos/${demo.id}`;
        setActive(nav, demo.id);
        onSelect(demo.id);
      });
      group.appendChild(a);
    }

    nav.appendChild(group);
  }

  // Extra links (API Reference, About)
  if (extraLinks) {
    const sep = document.createElement('div');
    sep.className = 'nav-separator';
    nav.appendChild(sep);
    for (const link of extraLinks) {
      const a = document.createElement('a');
      a.href = `#/${link.id}`;
      a.textContent = link.label;
      a.dataset.id = link.id;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = `/${link.id}`;
        setActive(nav, link.id);
        link.onClick();
      });
      nav.appendChild(a);
    }
  }
}

export function setActive(nav: HTMLElement, id: string): void {
  for (const link of nav.querySelectorAll('a')) {
    link.classList.toggle('active', link.dataset.id === id);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add demo/src/lib/demoBase.ts demo/src/ui/sidebar.ts
git commit -m "feat(demo): add Demo interface, category-grouped sidebar"
```

---

### Task 5: HTML, CSS & Main Rewrite

**Files:**
- Rewrite: `demo/index.html`
- Rewrite: `demo/src/main.ts`

This is the core shell rewrite. New layout: sidebar | (toolbar + canvas + profiler) | controls panel. Responsive.

- [ ] **Step 1: Rewrite index.html**

Full HTML with new layout structure, comprehensive CSS for controls panel, profiler bars, toolbar, responsive breakpoints, category groups, and all the UI components from Tasks 1-4. Include:
- `#sidebar` with `#nav` and hamburger toggle for mobile
- `#main` area with `#toolbar`, `#display` (canvas + video + fps), `#profiler`
- `#controls` panel on the right
- CSS custom properties for theming
- Responsive: below 768px, sidebar becomes hamburger menu, controls move below canvas
- Styling for `.ctrl-row`, `.ctrl-separator`, `.prof-row`, `.prof-bar`, `.tb-btn`, `.nav-group`, `.nav-group-header`, `.nav-separator`, `.collapsed`

- [ ] **Step 2: Rewrite main.ts**

Full rewrite integrating all UI systems. The demo registry uses `DemoEntry` with categories and lazy loaders. On demo switch: cleanup old → build controls → setup new → start loop with profiler. Toolbar callbacks handle resolution change (resize canvas + restart webcam), freeze (pause/resume animationFrame), capture (canvas.toDataURL → download), fullscreen (display element fullscreen API).

Include the full demo registry with all 25 demos (19 new + 6 upgraded), each with `id`, `title`, `category`, and lazy `loader`. New demos that don't exist yet should point to a placeholder that will be replaced in subsequent tasks.

Handle hash routing: `#/demos/<id>`, `#/api`, `#/about`. Parse on load and on `hashchange`.

- [ ] **Step 3: Verify existing demos still work**

Run: `cd demo && npm run dev`
Open in browser, verify grayscale/edges/corners/faceDetect/opticalFlow/orb still function.

- [ ] **Step 4: Commit**

```bash
git add demo/index.html demo/src/main.ts
git commit -m "feat(demo): rewrite shell with toolbar, controls panel, profiler, responsive layout"
```

---

### Task 6: Upgrade Existing 6 Demos to New Interface

**Files:**
- Modify: `demo/src/demos/grayscale.ts`
- Modify: `demo/src/demos/edges.ts`
- Modify: `demo/src/demos/corners.ts`
- Modify: `demo/src/demos/faceDetect.ts`
- Modify: `demo/src/demos/opticalFlow.ts`
- Modify: `demo/src/demos/orb.ts`

Convert each from the old `{ setup, process, cleanup }` export to a `default` export implementing `Demo` interface with `title`, `category`, `description`, `controls` array, and `onParamChange`.

Each demo should add profiler calls: `profiler.frameStart()` at top, `profiler.start('stage')` / `profiler.end('stage')` around each processing step, `profiler.frameEnd()` at bottom.

**Controls to add per demo:**
- **grayscale**: dropdown for color code (RGBA, RGB, BGRA, BGR)
- **edges**: slider low threshold (1-127, default 20), slider high threshold (1-255, default 40), slider blur kernel (3-15 odd, default 5)
- **corners**: slider threshold (5-100, default 20), slider border (1-10, default 3)
- **faceDetect**: slider scale factor (1.1-2.0, step 0.1, default 1.2), slider min neighbors (0-5, default 1), checkbox equalize histogram (default true)
- **opticalFlow**: slider win size (5-30, default 20), slider max iterations (5-50, default 30), slider max points (50-500, default 500)
- **orb**: slider threshold (5-50, default 20), slider max features (100-2000, default 1000)

Example conversion pattern (grayscale):
```typescript
// demo/src/demos/grayscale.ts
import type { Demo } from '../lib/demoBase';
import type { Profiler } from '../ui/profiler';
import { Matrix, U8C1, ColorCode } from 'jsfeat/core';
import { grayscale } from 'jsfeat/imgproc';

let gray: Matrix | null = null;
let colorCode = ColorCode.RGBA2GRAY;

const demo: Demo = {
  title: 'Grayscale',
  category: 'Image Processing',
  description: 'Real-time color to grayscale conversion using luminance weights.',
  controls: [
    {
      type: 'dropdown', key: 'colorCode', label: 'Color Code',
      options: [
        { value: '0', label: 'RGBA → Gray' },
        { value: '1', label: 'RGB → Gray' },
        { value: '2', label: 'BGRA → Gray' },
        { value: '3', label: 'BGR → Gray' },
      ],
      default: '0',
    },
  ],

  setup(canvas, _video, params) {
    gray = new Matrix(canvas.width, canvas.height, U8C1);
    colorCode = Number(params.colorCode) as ColorCode;
  },

  process(ctx, video, w, h, profiler) {
    if (!gray) return;
    profiler.frameStart();

    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    profiler.start('grayscale');
    grayscale(imageData.data, w, h, gray, colorCode);
    profiler.end('grayscale');

    profiler.start('render');
    const src = gray.data;
    const dst = imageData.data;
    for (let i = 0, j = 0; i < dst.length; i += 4, j++) {
      const v = src[j];
      dst[i] = v; dst[i + 1] = v; dst[i + 2] = v; dst[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    profiler.end('render');

    profiler.frameEnd();
  },

  onParamChange(key, value) {
    if (key === 'colorCode') colorCode = Number(value) as ColorCode;
  },

  cleanup() { gray = null; },
};

export default demo;
```

Apply the same pattern to all 6 existing demos.

- [ ] **Step 1: Convert all 6 demos to new interface**

- [ ] **Step 2: Verify all demos work with controls and profiler**

- [ ] **Step 3: Commit**

```bash
git add demo/src/demos/
git commit -m "feat(demo): upgrade 6 existing demos with controls, profiler, new interface"
```

---

### Task 7: New Image Processing Demos (6 demos)

**Files:**
- Create: `demo/src/demos/boxBlur.ts`
- Create: `demo/src/demos/gaussianBlur.ts`
- Create: `demo/src/demos/pyrDown.ts`
- Create: `demo/src/demos/equalizeHist.ts`
- Create: `demo/src/demos/sobel.ts`
- Create: `demo/src/demos/scharr.ts`

Each follows the same pattern as the upgraded grayscale demo: implements `Demo` interface, has controls, uses profiler.

**boxBlur.ts**: Controls: radius slider (1-20, default 4). Pipeline: grayscale → boxBlurGray → render.

**gaussianBlur.ts**: Controls: kernel size slider (3-15 odd, default 5), sigma slider (0-10 step 0.5, default 0). Pipeline: grayscale → gaussianBlur → render.

**pyrDown.ts**: Controls: levels slider (1-4, default 2). Pipeline: grayscale → pyrDown N times → render upscaled result.

**equalizeHist.ts**: No controls. Pipeline: grayscale → split canvas left=original, right=equalized.

**sobel.ts**: No controls. Pipeline: grayscale → sobelDerivatives → visualize dx as red, dy as green channel.

**scharr.ts**: Same as sobel but uses scharrDerivatives.

- [ ] **Step 1: Create all 6 demos**

- [ ] **Step 2: Register in main.ts demo registry**

- [ ] **Step 3: Verify all work**

- [ ] **Step 4: Commit**

```bash
git add demo/src/demos/boxBlur.ts demo/src/demos/gaussianBlur.ts demo/src/demos/pyrDown.ts demo/src/demos/equalizeHist.ts demo/src/demos/sobel.ts demo/src/demos/scharr.ts demo/src/main.ts
git commit -m "feat(demo): add 6 image processing demos — blur, pyrdown, histogram, derivatives"
```

---

### Task 8: New Feature Detection Demos (YAPE06, YAPE)

**Files:**
- Create: `demo/src/demos/yape06.ts`
- Create: `demo/src/demos/yape.ts`

**yape06.ts**: Controls: laplacian threshold slider (5-100, default 30), min eigenvalue slider (5-100, default 25), border slider (3-10, default 5). Pipeline: grayscale → yape06Detect → draw circles.

**yape.ts**: Controls: similar to YAPE06. Pipeline: grayscale → yapeDetect → draw circles.

- [ ] **Step 1: Create both demos**

- [ ] **Step 2: Register in main.ts**

- [ ] **Step 3: Commit**

```bash
git add demo/src/demos/yape06.ts demo/src/demos/yape.ts demo/src/main.ts
git commit -m "feat(demo): add YAPE06 and YAPE keypoint detection demos"
```

---

### Task 9: ORB Pattern Matching Demo

**Files:**
- Create: `demo/src/demos/orbMatch.ts`

The most complex demo. Full pipeline from the original `sample_orb.html`:
1. User clicks "Train" to freeze frame and extract multi-scale ORB descriptors as the pattern
2. Live matching: detect features in each frame, compute descriptors, match against trained pattern
3. Estimate homography via RANSAC from matched pairs
4. Draw matched outline (green quadrilateral) on the live feed

Controls: button "Train Pattern", slider match threshold (30-100, default 48), slider max features (200-2000, default 500), slider pyramid levels (1-4, default 3).

Uses: `yape06Detect` or `fastCorners` for detection, `orbDescribe` for descriptors, `ransac` + `homography2d` from motion module, `perspective4PointTransform` from math.

- [ ] **Step 1: Create orbMatch.ts**

- [ ] **Step 2: Register in main.ts**

- [ ] **Step 3: Commit**

```bash
git add demo/src/demos/orbMatch.ts demo/src/main.ts
git commit -m "feat(demo): add ORB pattern matching demo with RANSAC homography"
```

---

### Task 10: BBF Face Detection Demo

**Files:**
- Create: `demo/src/demos/bbfFace.ts`

BBF face detection using `bbfFace` cascade.

Controls: slider min scale (1-5, step 0.5, default 1), slider interval (1-5, default 4).

Pipeline: grayscale → bbfPrepareCascade (once in setup) → bbfBuildPyramid → bbfDetect → bbfGroupRectangles → draw boxes.

- [ ] **Step 1: Create bbfFace.ts**

- [ ] **Step 2: Register in main.ts**

- [ ] **Step 3: Commit**

```bash
git add demo/src/demos/bbfFace.ts demo/src/main.ts
git commit -m "feat(demo): add BBF face detection demo"
```

---

### Task 11: Transform Demos (Warp Affine, Warp Perspective)

**Files:**
- Create: `demo/src/demos/warpAffine.ts`
- Create: `demo/src/demos/warpPerspective.ts`

**warpAffine.ts**: Controls: rotation angle slider (-180 to 180, default 0), scale slider (0.5-2.0, default 1.0), translateX/Y sliders. Pipeline: grayscale → compute affine matrix from params → warpAffine → render.

**warpPerspective.ts**: Interactive — 4 corner handles drawn on canvas. User drags corners to define perspective. Pipeline: compute homography from corner positions → warpPerspective → render. Controls: button "Reset Corners".

- [ ] **Step 1: Create both demos**

- [ ] **Step 2: Register in main.ts**

- [ ] **Step 3: Commit**

```bash
git add demo/src/demos/warpAffine.ts demo/src/demos/warpPerspective.ts demo/src/main.ts
git commit -m "feat(demo): add affine and perspective warp demos"
```

---

### Task 12: Video Stabilization Demo

**Files:**
- Create: `demo/src/demos/videoStab.ts`
- Create: `demo/src/lib/webgl.ts`

The most advanced demo. Split-screen: original left, stabilized right.

**webgl.ts**: WebGL helpers — create shader program, create texture from canvas, render textured quad with perspective transform matrix. Fallback to canvas 2D if WebGL unavailable.

**videoStab.ts**: Controls: dropdown motion model (affine/homography), slider smoothing radius (5-30, default 15), checkbox WebGL rendering. Pipeline per frame:
1. Detect FAST features in current frame
2. Track with Lucas-Kanade from previous frame
3. Estimate motion (affine or homography) via RANSAC
4. Accumulate motion, apply Gaussian smoothing filter
5. Compute correction transform = smoothed - accumulated
6. Render corrected frame via WebGL (or canvas fallback) on right half
7. Render original on left half

- [ ] **Step 1: Create webgl.ts**

- [ ] **Step 2: Create videoStab.ts**

- [ ] **Step 3: Register in main.ts**

- [ ] **Step 4: Commit**

```bash
git add demo/src/demos/videoStab.ts demo/src/lib/webgl.ts demo/src/main.ts
git commit -m "feat(demo): add video stabilization demo with WebGL rendering"
```

---

### Task 13: Extra Demos (Compare, Pipeline, Touch Tracking)

**Files:**
- Create: `demo/src/demos/compare.ts`
- Create: `demo/src/demos/pipeline.ts`
- Create: `demo/src/demos/touchFlow.ts`

**compare.ts**: Side-by-side comparison. Controls: two dropdowns selecting a filter each (grayscale, box blur, gaussian blur, canny edges, sobel, scharr, equalize hist), slider for split position (0-100%). Renders left half with filter A, right half with filter B, vertical divider line.

**pipeline.ts**: Chain operations. Controls: buttons to add/remove stages. Available stages: grayscale, box blur, gaussian blur, canny, sobel, scharr, equalize hist. Shows each intermediate result as a small thumbnail strip below the main canvas.

**touchFlow.ts**: Optical flow for mobile. Same as opticalFlow but adds touch event listeners. Touch/click to add tracking points instead of auto-detecting. Controls: slider win size, button "Clear Points".

- [ ] **Step 1: Create all 3 demos**

- [ ] **Step 2: Register in main.ts**

- [ ] **Step 3: Commit**

```bash
git add demo/src/demos/compare.ts demo/src/demos/pipeline.ts demo/src/demos/touchFlow.ts demo/src/main.ts
git commit -m "feat(demo): add comparison, pipeline builder, and touch tracking demos"
```

---

### Task 14: API Reference Page

**Files:**
- Create: `demo/src/pages/apiReference.ts`

Static HTML page rendered into the main area when `#/api` is navigated. Content organized by module with TypeScript signatures, descriptions, and "Try it" links.

The page is built as a string of HTML rendered into the main content area (replacing the canvas). Includes:
- Module sections: Core, Math, Image Processing, Features, Optical Flow, Detection, Motion, Transform
- Each function: name, TypeScript signature in `<code>` block, one-line description
- "Try it →" link to corresponding demo where applicable
- Syntax highlighting via simple CSS (keyword coloring with `<span class="kw">`)

Content is hand-written for quality (not auto-generated from TypeDoc).

- [ ] **Step 1: Create apiReference.ts**

- [ ] **Step 2: Wire up in main.ts for `#/api` route**

- [ ] **Step 3: Commit**

```bash
git add demo/src/pages/apiReference.ts demo/src/main.ts
git commit -m "feat(demo): add API reference page with TypeScript signatures and demo links"
```

---

### Task 15: About Page

**Files:**
- Create: `demo/src/pages/about.ts`

Simple page with project description, GitHub link, credits, license.

- [ ] **Step 1: Create about.ts**

```typescript
// demo/src/pages/about.ts
export function renderAbout(container: HTMLElement): void {
  container.innerHTML = `
    <div class="page about-page">
      <h1>jsfeat</h1>
      <p class="tagline">Modern TypeScript Computer Vision Library</p>
      <p>
        jsfeat is a comprehensive computer vision library for the browser.
        It provides real-time image processing, feature detection, optical flow,
        object detection, and motion estimation — all in pure TypeScript with zero dependencies.
      </p>
      <h2>Features</h2>
      <ul>
        <li>Image processing: grayscale, blur, edge detection, histogram equalization</li>
        <li>Feature detection: FAST, YAPE, ORB descriptors</li>
        <li>Optical flow: Lucas-Kanade pyramid tracker</li>
        <li>Object detection: HAAR and BBF cascade classifiers</li>
        <li>Motion estimation: RANSAC, LMEDS with affine/homography models</li>
        <li>Linear algebra: LU, Cholesky, SVD, eigenvalues</li>
      </ul>
      <h2>Links</h2>
      <ul>
        <li><a href="https://github.com/v1s10n-4/jsfeat">GitHub Repository</a></li>
        <li><a href="#/api">API Reference</a></li>
      </ul>
      <h2>Credits</h2>
      <p>Original library by <a href="http://www.inspirit.ru/">Eugene Zatepyakin</a>. TypeScript port and modernization.</p>
      <h2>License</h2>
      <p>MIT</p>
    </div>
  `;
}
```

- [ ] **Step 2: Wire up in main.ts for `#/about` route**

- [ ] **Step 3: Commit**

```bash
git add demo/src/pages/about.ts demo/src/main.ts
git commit -m "feat(demo): add about page"
```

---

### Task 16: Final Verification & Deploy Fix

- [ ] **Step 1: Run demo locally**

Run: `cd demo && npm install && npm run dev`
Verify: All 25 demos load and process without errors. Controls work. Profiler displays. Toolbar buttons function. API reference and About pages render. Responsive layout works at narrow width.

- [ ] **Step 2: Build demo**

Run: `cd demo && npm run build`
Expected: `dist-demo/` created with no errors.

- [ ] **Step 3: Push and verify CI**

```bash
git push origin master
```

- [ ] **Step 4: Commit any final fixes**

```bash
git commit -m "chore: final demo verification and fixes"
```
