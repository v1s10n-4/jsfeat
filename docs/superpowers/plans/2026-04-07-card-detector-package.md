# @v1s10n-4/card-detector Package — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new npm package `@v1s10n-4/card-detector` by extracting card detection code from the jsfeat demo into a standalone React library with radix/shadcn-style API.

**Architecture:** New repo at `/Users/konect/WebstormProjects/card-detector`. Library code in `src/` (published), dev workbench in `dev/` (not published). Depends on `jsfeat` for CV primitives. Exports headless `detectCard()`, React hook `useCardScanner()`, and composable components.

**Tech Stack:** TypeScript, React 19, Vite (library + dev), jsfeat (dependency), Tailwind v4 (dev only), GitHub Packages for publishing.

---

### Task 1: Scaffold new repo

**Files to create:**
- `/Users/konect/WebstormProjects/card-detector/package.json`
- `/Users/konect/WebstormProjects/card-detector/tsconfig.json`
- `/Users/konect/WebstormProjects/card-detector/tsconfig.lib.json`
- `/Users/konect/WebstormProjects/card-detector/vite.config.ts` (dev server)
- `/Users/konect/WebstormProjects/card-detector/vite.lib.config.ts` (library build)
- `/Users/konect/WebstormProjects/card-detector/.gitignore`
- `/Users/konect/WebstormProjects/card-detector/src/index.ts` (public exports stub)

- [ ] **Step 1: Create directory and initialize**

```bash
mkdir -p /Users/konect/WebstormProjects/card-detector
cd /Users/konect/WebstormProjects/card-detector
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@v1s10n-4/card-detector",
  "version": "0.1.0",
  "type": "module",
  "private": false,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/v1s10n-4/card-detector.git"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "dependencies": {
    "jsfeat": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "~5.8.3",
    "vite": "^6.3.5",
    "@vitejs/plugin-react": "^4.5.2",
    "@tailwindcss/vite": "^4.2.2",
    "tailwindcss": "^4.2.2",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.14.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.3.0",
    "lucide-react": "^1.7.0",
    "@radix-ui/react-switch": "^1.2.5",
    "@radix-ui/react-label": "^2.1.6",
    "@radix-ui/react-slider": "^1.3.5",
    "@radix-ui/react-dialog": "^1.1.14",
    "@radix-ui/react-slot": "^1.2.3"
  },
  "scripts": {
    "dev": "vite --config vite.config.ts",
    "build": "tsc -p tsconfig.lib.json && vite build --config vite.lib.config.ts",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  }
}
```

- [ ] **Step 3: Create tsconfig.json (dev)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./dev/src/*"],
      "@card-detector/*": ["./src/*"]
    }
  },
  "include": ["src", "dev/src"]
}
```

- [ ] **Step 4: Create tsconfig.lib.json (library build)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create vite.config.ts (dev server)**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'dev',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'dev/src'),
      '@card-detector': resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 6: Create vite.lib.config.ts (library build)**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', /^jsfeat\//],
    },
    outDir: 'dist',
  },
});
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
dist/
.DS_Store
*.tsbuildinfo
```

- [ ] **Step 8: Create src/index.ts stub**

```typescript
// @v1s10n-4/card-detector — public API
export { detectCard, type DetectCardResult } from './core/detect-card';
export { DETECTION_DEFAULTS, type DetectionParams, type DetectionParamKey } from './core/detection-defaults';
```

- [ ] **Step 9: Install dependencies, verify build**

```bash
cd /Users/konect/WebstormProjects/card-detector
npm install
npx tsc --noEmit
```

- [ ] **Step 10: Initial commit**

```bash
git add -A
git commit -m "chore: scaffold @v1s10n-4/card-detector package"
```

---

### Task 2: Migrate core detection files

**Files to copy from jsfeat demo → card-detector src/:**

- [ ] **Step 1: Copy core detection files**

```bash
cd /Users/konect/WebstormProjects/card-detector
mkdir -p src/core src/utils src/workers

# Core detection
cp /Users/konect/WebstormProjects/jsfeat/demo/src/lib/detect-card.ts src/core/detect-card.ts
cp /Users/konect/WebstormProjects/jsfeat/demo/src/lib/detection-constants.ts src/core/detection-defaults.ts
cp /Users/konect/WebstormProjects/jsfeat/demo/src/workers/detection-worker.ts src/workers/detection-worker.ts
```

- [ ] **Step 2: Fix imports in copied files**

In `src/core/detect-card.ts`: Change `import { DETECTION_DEFAULTS } from './detection-constants'` to `import { DETECTION_DEFAULTS } from './detection-defaults'`.

In `src/workers/detection-worker.ts`: Change `import { detectCard } from '../lib/detect-card'` to `import { detectCard } from '../core/detect-card'`. Change `import { computeAccuracy } from '../lib/test-manifest'` — this is a dev dependency. Move `computeAccuracy` into the worker inline or import from a shared location. For now, copy the `computeAccuracy` function into the worker file directly.

In `src/core/detection-defaults.ts`: Remove display-only params (`debugFontSize`, `warpPreviewSize`, `qualityChartWidth`) from `DETECTION_DEFAULTS`. Remove `MAIN_SLIDERS` and `ADVANCED_SLIDERS` arrays (those are UI concerns, move to dev workbench). Keep only the detection params and types.

- [ ] **Step 3: Create perspective warp utility**

Create `src/utils/perspective-warp.ts` — extract the `computeHomography` function and create a `warpCard()` utility:

```typescript
export function warpCard(
  sourceRgba: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  corners: { x: number; y: number }[],
  outputWidth?: number,
  outputHeight?: number,
): ImageData
```

Extract the homography + inverse warp logic from DebugCanvas.tsx's warp preview section.

- [ ] **Step 4: Update src/index.ts exports**

```typescript
export { detectCard, type DetectCardResult } from './core/detect-card';
export { DETECTION_DEFAULTS, type DetectionParams, type DetectionParamKey } from './core/detection-defaults';
export { warpCard } from './utils/perspective-warp';
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: migrate core detection files from jsfeat demo"
```

---

### Task 3: Create useCardScanner React hook

**Files:**
- Create: `src/hooks/use-card-scanner.ts`

- [ ] **Step 1: Create the hook**

The hook manages:
- Camera access via `getUserMedia`
- Video element ref
- Processing loop (requestAnimationFrame)
- Calling `detectCard()` on each frame
- Temporal smoothing of corners
- Perspective warp of detected card
- State: detected, corners, cardImage, scanning, fps

Key implementation: use an OffscreenCanvas for processing at the selected `scale`, keeping the video at full resolution.

```typescript
import { useState, useRef, useCallback, useEffect } from 'react';
import { detectCard, type DetectCardResult } from '../core/detect-card';
import { DETECTION_DEFAULTS, type DetectionParams } from '../core/detection-defaults';
import { warpCard } from '../utils/perspective-warp';

export interface ScanResult {
  corners: { x: number; y: number }[];
  cardImage: ImageData;
  qualityScore: number;
}

export interface UseCardScannerOptions {
  scale?: number;
  params?: Partial<DetectionParams>;
  onDetect?: (result: ScanResult) => void;
  onLost?: () => void;
  autoStart?: boolean;
  facingMode?: 'user' | 'environment';
}

export function useCardScanner(options: UseCardScannerOptions = {}) {
  // ... implementation
}
```

The hook should:
1. Create a video element ref for consumers to attach
2. On `start()`: call `getUserMedia` with the specified facingMode
3. On each animation frame: draw video to offscreen canvas at `scale`, run `detectCard()`, apply temporal smoothing
4. When card detected: call `warpCard()` to get the corrected card image, call `onDetect`
5. When card lost: call `onLost`
6. On `stop()`: stop media stream, cancel animation frame
7. Return `{ videoRef, detected, corners, cardImage, scanning, fps, start, stop, freeze, unfreeze, setParam }`

- [ ] **Step 2: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { useCardScanner, type UseCardScannerOptions, type ScanResult } from './hooks/use-card-scanner';
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: create useCardScanner React hook"
```

---

### Task 4: Create composable components

**Files:**
- Create: `src/components/card-scanner.tsx`
- Create: `src/components/card-scanner-viewport.tsx`
- Create: `src/components/card-scanner-overlay.tsx`
- Create: `src/components/card-scanner-guide.tsx`

- [ ] **Step 1: Create CardScanner context provider**

`src/components/card-scanner.tsx` — uses `useCardScanner` internally, provides context to children:

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import { useCardScanner, type UseCardScannerOptions, type ScanResult } from '../hooks/use-card-scanner';

interface CardScannerContextValue {
  videoRef: React.RefObject<HTMLVideoElement>;
  detected: boolean;
  corners: { x: number; y: number }[] | null;
  cardImage: ImageData | null;
  scanning: boolean;
  fps: number;
}

const CardScannerContext = createContext<CardScannerContextValue | null>(null);

export function useCardScannerContext() {
  const ctx = useContext(CardScannerContext);
  if (!ctx) throw new Error('useCardScannerContext must be used within <CardScanner>');
  return ctx;
}

interface CardScannerProps extends UseCardScannerOptions {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function CardScanner({ children, className, style, ...options }: CardScannerProps) {
  const scanner = useCardScanner(options);
  return (
    <CardScannerContext.Provider value={scanner}>
      <div
        className={className}
        style={{ position: 'relative', ...style }}
        data-scanning={scanner.scanning || undefined}
        data-detected={scanner.detected || undefined}
      >
        {children}
      </div>
    </CardScannerContext.Provider>
  );
}
```

- [ ] **Step 2: Create CardScannerViewport**

`src/components/card-scanner-viewport.tsx` — renders the video element:

```tsx
import { forwardRef } from 'react';
import { useCardScannerContext } from './card-scanner';

interface CardScannerViewportProps extends React.VideoHTMLAttributes<HTMLVideoElement> {}

export const CardScannerViewport = forwardRef<HTMLVideoElement, CardScannerViewportProps>(
  ({ className, style, ...props }, ref) => {
    const { videoRef } = useCardScannerContext();
    return (
      <video
        ref={(el) => {
          (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        autoPlay
        playsInline
        muted
        className={className}
        style={style}
        {...props}
      />
    );
  }
);
CardScannerViewport.displayName = 'CardScannerViewport';
```

- [ ] **Step 3: Create CardScannerOverlay**

`src/components/card-scanner-overlay.tsx` — render prop for custom overlays:

```tsx
import { useCardScannerContext } from './card-scanner';

interface OverlayRenderProps {
  detected: boolean;
  corners: { x: number; y: number }[] | null;
  scanning: boolean;
  fps: number;
}

interface CardScannerOverlayProps {
  children: (props: OverlayRenderProps) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function CardScannerOverlay({ children, className, style }: CardScannerOverlayProps) {
  const { detected, corners, scanning, fps } = useCardScannerContext();
  return (
    <div
      className={className}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}
      data-detected={detected || undefined}
    >
      {children({ detected, corners, scanning, fps })}
    </div>
  );
}
```

- [ ] **Step 4: Create CardScannerGuide**

`src/components/card-scanner-guide.tsx` — optional aspect ratio guide overlay:

```tsx
interface CardScannerGuideProps {
  ratio?: number; // width/height, default 5/7
  className?: string;
  style?: React.CSSProperties;
}

export function CardScannerGuide({ ratio = 5 / 7, className, style }: CardScannerGuideProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        ...style,
      }}
    >
      <div
        className={className}
        style={{
          aspectRatio: `${ratio}`,
          height: '70%',
          border: '2px solid rgba(255,255,255,0.3)',
          borderRadius: '8px',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Export all components from index.ts**

Add to `src/index.ts`:
```typescript
export { CardScanner, useCardScannerContext } from './components/card-scanner';
export { CardScannerViewport } from './components/card-scanner-viewport';
export { CardScannerOverlay } from './components/card-scanner-overlay';
export { CardScannerGuide } from './components/card-scanner-guide';
```

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: create composable CardScanner components (radix-style)"
```

---

### Task 5: Migrate dev workbench

**Files to copy from jsfeat demo → card-detector dev/:**

- [ ] **Step 1: Create dev directory structure and copy files**

```bash
cd /Users/konect/WebstormProjects/card-detector
mkdir -p dev/src/components/dev dev/src/components/ui dev/src/hooks dev/src/lib dev/src/pages dev/public

# Dev components
cp /Users/konect/WebstormProjects/jsfeat/demo/src/components/dev/DebugCanvas.tsx dev/src/components/dev/
cp /Users/konect/WebstormProjects/jsfeat/demo/src/components/dev/DetectionPanel.tsx dev/src/components/dev/
cp /Users/konect/WebstormProjects/jsfeat/demo/src/components/dev/PipelineStages.tsx dev/src/components/dev/
cp /Users/konect/WebstormProjects/jsfeat/demo/src/components/dev/TestImageStrip.tsx dev/src/components/dev/

# UI components (shadcn)
cp /Users/konect/WebstormProjects/jsfeat/demo/src/components/ui/*.tsx dev/src/components/ui/

# Hooks
cp /Users/konect/WebstormProjects/jsfeat/demo/src/hooks/*.ts dev/src/hooks/

# Lib files
cp /Users/konect/WebstormProjects/jsfeat/demo/src/lib/test-manifest.ts dev/src/lib/
cp /Users/konect/WebstormProjects/jsfeat/demo/src/lib/videoOrientation.ts dev/src/lib/
cp /Users/konect/WebstormProjects/jsfeat/demo/src/lib/stages.ts dev/src/lib/ 2>/dev/null || true

# Pages
cp /Users/konect/WebstormProjects/jsfeat/demo/src/pages/DevPage.tsx dev/src/pages/

# Test images
cp -r /Users/konect/WebstormProjects/jsfeat/demo/public/test-images dev/public/

# Dev entry files
cp /Users/konect/WebstormProjects/jsfeat/demo/index.html dev/
```

- [ ] **Step 2: Create dev/src/main.tsx entry point**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import DevPage from './pages/DevPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<DevPage />} />
      </Routes>
    </HashRouter>
  </StrictMode>
);
```

- [ ] **Step 3: Create dev/src/index.css**

```css
@import "tailwindcss";
```

- [ ] **Step 4: Create dev/src/lib/utils.ts**

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Fix imports in dev files**

All dev files need import path updates:
- `import { detectCard } from '@/lib/detect-card'` → `import { detectCard } from '@card-detector/core/detect-card'`
- `import { DETECTION_DEFAULTS } from '@/lib/detection-constants'` → `import { DETECTION_DEFAULTS, MAIN_SLIDERS, ADVANCED_SLIDERS } from '@/lib/detection-ui-constants'`
- `import { cardDetectionDemo, getCardDebugBuffers, resetCardTemporalState } from '@/lib/demos'` — this needs a card-pipeline wrapper in dev/src/lib/

Create `dev/src/lib/detection-ui-constants.ts` that re-exports detection defaults AND adds the UI-specific constants (MAIN_SLIDERS, ADVANCED_SLIDERS, display params).

Create `dev/src/lib/card-pipeline.ts` that wraps the `detectCard()` function with temporal smoothing and module-level state — essentially the `cardDetectionDemo` object from demos.ts but importing from `@card-detector/`.

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Open in browser, verify the workbench loads.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: migrate dev workbench from jsfeat demo"
```

---

### Task 6: Set up GitHub Packages publishing

**Files:**
- Create: `.github/workflows/publish.yml`
- Create: `.npmrc`

- [ ] **Step 1: Create .npmrc**

```
@v1s10n-4:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

- [ ] **Step 2: Create publish workflow**

```yaml
# .github/workflows/publish.yml
name: Publish Package
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://npm.pkg.github.com
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: add GitHub Packages publish workflow"
```

---

### Task 7: Build verification and first publish

- [ ] **Step 1: Verify library builds**

```bash
npm run build
ls dist/
# Should see: index.js, index.d.ts, and type declarations
```

- [ ] **Step 2: Verify dev workbench works**

```bash
npm run dev
```

Open in browser. Verify:
- DevPage loads with test images
- Run All produces results
- Webcam toggle works
- Pipeline stages show
- Controls adjust detection params

- [ ] **Step 3: Create GitHub repo and push**

```bash
gh repo create v1s10n-4/card-detector --private
git remote add origin https://github.com/v1s10n-4/card-detector.git
git push -u origin main
```

- [ ] **Step 4: Create initial release to trigger publish**

```bash
gh release create v0.1.0 --title "v0.1.0" --notes "Initial release: detectCard(), useCardScanner(), CardScanner components"
```

- [ ] **Step 5: Verify package is published**

Check https://github.com/v1s10n-4/card-detector/packages

---

### Task 8: Clean up jsfeat (separate sub-project)

This task is intentionally deferred — only execute AFTER Tasks 1-7 are validated.

- [ ] **Step 1: Remove card-detection-specific files from jsfeat demo**

```bash
cd /Users/konect/WebstormProjects/jsfeat
rm demo/src/lib/detect-card.ts
rm demo/src/lib/detection-constants.ts
rm demo/src/workers/detection-worker.ts
rm -rf demo/src/components/dev/
rm demo/src/pages/DevPage.tsx
rm demo/src/lib/test-manifest.ts
rm -rf demo/public/test-images/
```

- [ ] **Step 2: Remove cardDetectionDemo from demos.ts**

In `demo/src/lib/demos.ts`: delete the `cardDetectionDemo` object and all its helper functions (`sortCorners`, `buildCardCorners`, `getCardDebugBuffers`, `resetCardTemporalState`, `setCardPipelineOverlays`). Delete all `_card*` module-level state variables. Remove from the demo registry array.

- [ ] **Step 3: Remove training game docs**

```bash
rm docs/TRAINING_*.md
rm docs/QUEST_*.md
```

- [ ] **Step 4: Clean up unused imports in demos.ts**

Remove imports only used by cardDetectionDemo (if not used by other demos).

- [ ] **Step 5: Verify jsfeat demo still works**

```bash
npm run build
cd demo && npm run dev
```

Verify other demos (blur, Canny, ORB, etc.) still work.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove card detection code from jsfeat demo

Card detection extracted to @v1s10n-4/card-detector package.
jsfeat is now a pure CV primitives library."
```
