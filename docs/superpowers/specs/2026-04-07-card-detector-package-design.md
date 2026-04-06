# @v1s10n-4/card-detector — NPM Package Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract all card detection logic from the jsfeat demo into a standalone React npm package with a radix-ui/shadcn-style API: headless hooks, unstyled composable primitives, and a pure `detectCard()` function.

**Architecture:** New repo `card-detector` depends on `jsfeat` for CV primitives. Exports a React hook `useCardScanner()`, composable components `<CardScanner>`, and a headless `detectCard()` function. Includes a dev workbench (the current jsfeat debug page) as its development environment.

**Tech Stack:** TypeScript, React 19, jsfeat (dependency), Vite (library build + dev server).

---

## 1. Package Identity

- **Name:** `@v1s10n-4/card-detector`
- **Repo:** `github.com/v1s10n-4/card-detector` (new repo)
- **Dependencies:** `jsfeat` (runtime)
- **Peer dependencies:** `react` >= 18, `react-dom` >= 18
- **Exports:** ESM only, TypeScript declarations

## 2. What Moves from jsfeat

### To `src/` (published library):
| Source (jsfeat) | Destination (card-detector) | Notes |
|---|---|---|
| `demo/src/lib/detect-card.ts` | `src/core/detect-card.ts` | Pure stateless detection — unchanged |
| `demo/src/lib/detection-constants.ts` | `src/core/detection-defaults.ts` | Detection params only (remove display params like debugFontSize, warpPreviewSize) |
| `demo/src/lib/demos.ts` (cardDetectionDemo) | `src/core/card-pipeline.ts` | Stateful pipeline with temporal smoothing, extracted from the demo registry |
| `demo/src/workers/detection-worker.ts` | `src/workers/detection-worker.ts` | Parallel batch processing |
| Warp logic from `DebugCanvas.tsx` | `src/utils/perspective-warp.ts` | `warpCard(imageData, corners) → ImageData` utility |
| New | `src/hooks/use-card-scanner.ts` | Primary React hook |
| New | `src/components/card-scanner.tsx` | Context provider (compound component root) |
| New | `src/components/card-scanner-viewport.tsx` | Video display primitive |
| New | `src/components/card-scanner-overlay.tsx` | Render-prop overlay |
| New | `src/components/card-scanner-guide.tsx` | Optional aspect ratio guide |

### To `dev/` (NOT published, development only):
| Source (jsfeat) | Destination (card-detector) |
|---|---|
| `demo/src/components/dev/DebugCanvas.tsx` | `dev/src/components/DebugCanvas.tsx` |
| `demo/src/components/dev/DetectionPanel.tsx` | `dev/src/components/DetectionPanel.tsx` |
| `demo/src/components/dev/PipelineStages.tsx` | `dev/src/components/PipelineStages.tsx` |
| `demo/src/components/dev/TestImageStrip.tsx` | `dev/src/components/TestImageStrip.tsx` |
| `demo/src/pages/DevPage.tsx` | `dev/src/pages/DevPage.tsx` |
| `demo/src/lib/test-manifest.ts` | `dev/src/lib/test-manifest.ts` |
| `demo/public/test-images/*` | `dev/public/test-images/*` |
| `demo/src/hooks/useWebcam.ts` | `dev/src/hooks/useWebcam.ts` |
| `demo/src/components/ui/*` | `dev/src/components/ui/*` (shadcn components for workbench) |

## 3. Public API

### 3a. Headless detection (no React)

```typescript
import { detectCard, type DetectCardResult } from '@v1s10n-4/card-detector';
import { DETECTION_DEFAULTS, type DetectionParams } from '@v1s10n-4/card-detector';

const result: DetectCardResult = detectCard(rgbaPixels, width, height, params?);
// result.detected: boolean
// result.corners: {x,y}[] | null (4 sorted corners: TL, TR, BR, BL)
// result.qualityScore: number (0-1, aspect match to 5:7)
// result.debugInfo: string
// result.rectFill: number
// result.aspect: number
```

### 3b. React hook

```typescript
import { useCardScanner } from '@v1s10n-4/card-detector';

const scanner = useCardScanner({
  scale?: number;                    // processing resolution (default 0.5)
  params?: Partial<DetectionParams>; // override detection params
  onDetect?: (result: ScanResult) => void;  // card detected callback
  onLost?: () => void;               // detection lost callback
  autoStart?: boolean;               // start camera on mount (default true)
  facingMode?: 'user' | 'environment'; // camera selection (default 'environment')
});

// Returns:
scanner.videoRef: RefObject<HTMLVideoElement>
scanner.detected: boolean
scanner.corners: {x,y}[] | null
scanner.cardImage: ImageData | null    // perspective-corrected card
scanner.scanning: boolean
scanner.fps: number
scanner.start(): Promise<void>
scanner.stop(): void
scanner.freeze(): void
scanner.unfreeze(): void
scanner.setParam(key, value): void
```

### 3c. Composable components

```tsx
import {
  CardScanner,
  CardScannerViewport,
  CardScannerOverlay,
  CardScannerGuide,
} from '@v1s10n-4/card-detector';

// Compound component pattern (radix-style)
<CardScanner
  scale={0.5}
  onDetect={({ cardImage }) => identify(cardImage)}
  // data-scanning / data-detected attributes on root
>
  <CardScannerViewport
    // Renders <video> — unstyled, className/style accepted
    className="w-full h-full object-cover"
  />
  <CardScannerOverlay>
    {/* Render prop with detection state */}
    {({ detected, corners, scanning }) => (
      <div data-detected={detected}>
        {corners && <MyCustomQuad corners={corners} />}
      </div>
    )}
  </CardScannerOverlay>
  <CardScannerGuide
    // Optional rectangle guide overlay
    ratio={5/7}
    className="border-2 border-white/50"
  />
</CardScanner>
```

### 3d. Utilities

```typescript
import { warpCard } from '@v1s10n-4/card-detector';

// Perspective-correct a detected card region
const correctedImage: ImageData = warpCard(sourceImageData, corners, outputWidth?, outputHeight?);
```

### 3e. Worker (advanced)

```typescript
import { createDetectionWorkerPool } from '@v1s10n-4/card-detector';

const pool = createDetectionWorkerPool(numWorkers?);
const results = await pool.processImages(images, params);
pool.terminate();
```

## 4. Component Design Principles

Following radix-ui/shadcn philosophy:

- **Unstyled by default** — no built-in CSS. Components accept `className`, `style`, `asChild`.
- **Data attributes** — `data-scanning`, `data-detected`, `data-frozen` for CSS selectors.
- **Render props** — `<CardScannerOverlay>` uses children-as-function for custom rendering.
- **Composable** — each sub-component is optional. Use only `<CardScannerViewport>` if you don't need overlays.
- **Context-based** — `<CardScanner>` provides context, children consume it. No prop drilling.
- **Ref forwarding** — all components forward refs to their DOM elements.
- **Accessible** — proper ARIA attributes for the video and overlay regions.

## 5. Package.json

```json
{
  "name": "@v1s10n-4/card-detector",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "dependencies": {
    "jsfeat": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^6.x",
    "@vitejs/plugin-react": "^4.x",
    "tailwindcss": "^4.x"
  },
  "scripts": {
    "dev": "vite dev/",
    "build": "vite build --config vite.lib.config.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

## 6. jsfeat Cleanup (after extraction)

Remove from jsfeat:
- `demo/src/lib/detect-card.ts`
- `demo/src/lib/detection-constants.ts`
- `demo/src/workers/detection-worker.ts`
- `cardDetectionDemo` from `demo/src/lib/demos.ts`
- `demo/src/components/dev/` (entire folder)
- `demo/src/pages/DevPage.tsx`
- `demo/src/lib/test-manifest.ts`
- `demo/public/test-images/`
- Training game docs (`TRAINING_*.md`)

jsfeat demo keeps: basic CV demos (blur, Canny, Scharr, contours, ORB, optical flow).

## 7. Dev Workbench

The dev workbench (current jsfeat debug page) moves to `dev/` in the card-detector repo. It becomes the development/testing environment:

- `npm run dev` — starts Vite dev server with the workbench
- `npm run build` — builds the library (NOT the workbench)
- The workbench imports from `../src/` during development
- Test images, ground truth manifest, pipeline stages, detection panel — all in `dev/`

## 8. Integration in sorcery-companion

```tsx
// src/components/scanner/scanner-view.tsx
import { CardScanner, CardScannerViewport, CardScannerOverlay } from '@v1s10n-4/card-detector';

export function ScannerView() {
  const handleDetect = async ({ cardImage }: ScanResult) => {
    // Send cropped card to sorcery-lens API for identification
    const blob = await cardImageToBlob(cardImage);
    const match = await fetch('/api/identify', { method: 'POST', body: blob });
    // Show result...
  };

  return (
    <CardScanner scale={0.5} onDetect={handleDetect}>
      <CardScannerViewport className="h-full w-full object-cover rounded-xl" />
      <CardScannerOverlay>
        {({ detected }) => (
          <div className={cn(
            "absolute inset-0 border-2 rounded-xl transition-colors",
            detected ? "border-green-500" : "border-white/30"
          )} />
        )}
      </CardScannerOverlay>
      <CardScannerGuide ratio={5/7} />
    </CardScanner>
  );
}
```

## 9. Testing

- Dev workbench "Run All" must produce 37/48 at 50px threshold (same as current)
- `useCardScanner()` hook tested with webcam in dev workbench
- Components render without errors in SSR (Next.js compatible — `'use client'` directive)
- TypeScript strict mode throughout
- Library build produces clean ESM output with declarations
