# jsfeat TypeScript Recode - Design Specification

## Overview

A modern recode of [jsfeat](https://github.com/inspirit/jsfeat), a JavaScript Computer Vision library. The recode converts the library from legacy JavaScript (IIFE patterns, Ant build, Bower) to idiomatic TypeScript with modern tooling while preserving all core CV algorithms.

**Approach:** Incremental port (Phase 1: TypeScript port preserving logic, Phase 2: modernize patterns). The original source serves as a regression oracle throughout.

**Priority:** Personal use > Community fork > Published npm package.

---

## Decisions

| Aspect | Decision |
|---|---|
| Runtime | Browser-only |
| Build | Vite library mode |
| Imports | Subpath exports (`jsfeat/imgproc`, `jsfeat/math`, etc.) |
| Naming | camelCase |
| Data structures | Classes (`Matrix`, `Keypoint`, `Pyramid`, `BufferPool`) |
| Type system | Bitflag approach preserved, wrapped in TypeScript types |
| Module APIs | Standalone exported functions, stateless |
| Cascades | In-package, tree-shakeable via `jsfeat/cascades` |
| Tests | Vitest, comprehensive coverage |
| API docs | TypeDoc, auto-generated |
| Examples | Standalone scripts covering key features |
| Demo | Vanilla TS Vite SPA, webcam-based, GitHub Pages |
| Source docs | `docs/` directory in main branch |
| Built output | `gh-pages` branch (demo + API docs) |
| CI | GitHub Actions: test, build, deploy |

---

## Project Structure

```
jsfeat/
├── src/
│   ├── core/
│   │   ├── types.ts              # Data type constants, type aliases
│   │   ├── matrix.ts             # Matrix class (was matrix_t)
│   │   ├── data.ts               # Data buffer class (was data_t)
│   │   ├── pyramid.ts            # Image pyramid class (was pyramid_t)
│   │   ├── keypoint.ts           # Keypoint class (was keypoint_t)
│   │   ├── cache.ts              # Buffer pool
│   │   └── index.ts
│   ├── math/
│   │   ├── math.ts               # Gaussian kernels, quicksort
│   │   ├── linalg.ts             # LU, Cholesky, SVD, eigenvalues
│   │   ├── matmath.ts            # Matrix arithmetic
│   │   └── index.ts
│   ├── imgproc/
│   │   ├── imgproc.ts            # All image processing functions
│   │   └── index.ts
│   ├── features/
│   │   ├── fast.ts               # FAST corner detection
│   │   ├── yape06.ts             # YAPE06 detector
│   │   ├── yape.ts               # YAPE detector
│   │   ├── orb.ts                # ORB descriptor
│   │   └── index.ts
│   ├── flow/
│   │   ├── lucasKanade.ts        # Lucas-Kanade optical flow
│   │   └── index.ts
│   ├── detect/
│   │   ├── haar.ts               # HAAR cascade classifier
│   │   ├── bbf.ts                # BBF detector
│   │   └── index.ts
│   ├── motion/
│   │   ├── estimator.ts          # RANSAC, LMEDS
│   │   ├── models.ts             # Affine2D, Homography2D
│   │   └── index.ts
│   ├── transform/
│   │   ├── transform.ts          # Perspective/affine transforms
│   │   └── index.ts
│   └── cascades/
│       ├── frontalface.ts
│       ├── profileface.ts
│       ├── eye.ts
│       ├── mouth.ts
│       ├── upperbody.ts
│       ├── handopen.ts
│       ├── handfist.ts
│       ├── bbfFace.ts
│       └── index.ts
├── test/
│   ├── core/
│   │   ├── matrix.test.ts
│   │   ├── data.test.ts
│   │   ├── pyramid.test.ts
│   │   └── keypoint.test.ts
│   ├── math/
│   │   ├── linalg.test.ts
│   │   ├── matmath.test.ts
│   │   └── math.test.ts
│   ├── imgproc/
│   │   └── imgproc.test.ts
│   ├── features/
│   │   ├── fast.test.ts
│   │   ├── yape.test.ts
│   │   └── orb.test.ts
│   ├── flow/
│   │   └── lucasKanade.test.ts
│   ├── detect/
│   │   ├── haar.test.ts
│   │   └── bbf.test.ts
│   ├── motion/
│   │   └── estimator.test.ts
│   ├── transform/
│   │   └── transform.test.ts
│   └── helpers/
│       ├── synthetic.ts          # Generate test images
│       └── comparison.ts         # Matrix equality with epsilon
├── examples/
│   ├── grayscale-conversion.ts
│   ├── edge-detection.ts
│   ├── corner-detection.ts
│   ├── face-detection.ts
│   ├── optical-flow.ts
│   ├── feature-matching.ts
│   └── motion-estimation.ts
├── demo/
│   ├── index.html
│   ├── src/
│   │   ├── main.ts
│   │   ├── demos/
│   │   │   ├── grayscale.ts
│   │   │   ├── edges.ts
│   │   │   ├── corners.ts
│   │   │   ├── faceDetect.ts
│   │   │   ├── opticalFlow.ts
│   │   │   └── orb.ts
│   │   └── ui/
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   └── (source documentation, guides)
├── legacy/                       # Original source kept during port for regression testing
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── .gitignore
```

---

## Core Data Structures

### Type System

Preserves the original bitflag approach for data types and channels, wrapped in TypeScript:

```typescript
// types.ts
export const DataType = {
  U8:  0x0100,
  S32: 0x0200,
  F32: 0x0400,
  F64: 0x0800,
} as const;

export const Channel = {
  C1: 0x01,
  C2: 0x02,
  C3: 0x03,
  C4: 0x04,
} as const;

// Composite shortcuts
export const U8C1  = DataType.U8  | Channel.C1;  // 0x0101
export const U8C3  = DataType.U8  | Channel.C3;  // 0x0103
export const U8C4  = DataType.U8  | Channel.C4;  // 0x0104
export const F32C1 = DataType.F32 | Channel.C1;  // 0x0401
export const F32C2 = DataType.F32 | Channel.C2;  // 0x0402
export const S32C1 = DataType.S32 | Channel.C1;  // 0x0201
export const S32C2 = DataType.S32 | Channel.C2;  // 0x0202

export type DataTypeFlag = typeof DataType[keyof typeof DataType];
export type ChannelFlag = typeof Channel[keyof typeof Channel];
export type CompositeType = number;
export type TypedArrayUnion = Uint8Array | Int32Array | Float32Array | Float64Array;

// Color conversion codes
export enum ColorCode {
  RGBA2GRAY = 0,
  RGB2GRAY = 1,
  BGRA2GRAY = 2,
  BGR2GRAY = 3,
}

// Helper functions
export function getDataType(type: CompositeType): DataTypeFlag;
export function getChannel(type: CompositeType): number;
export function getDataTypeSize(type: CompositeType): number;
```

### Matrix

The heart of the library. Multi-channel matrix backed by typed arrays:

```typescript
export class Matrix {
  rows: number;
  cols: number;
  type: CompositeType;
  channel: number;
  data: TypedArrayUnion;
  buffer: DataBuffer;

  constructor(cols: number, rows: number, type: CompositeType, buffer?: ArrayBuffer);
  resize(cols: number, rows: number, channel?: number): void;
}
```

### Keypoint

```typescript
export class Keypoint {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public score: number = 0,
    public level: number = 0,
    public angle: number = -1.0,
  ) {}
}
```

### Pyramid

```typescript
export class Pyramid {
  levels: number;
  data: Matrix[];
  pyrdown: (src: Matrix, dst: Matrix, sx?: number, sy?: number) => void;

  constructor(levels: number);
  build(input: Matrix, skipFirstLevel?: boolean): void;
}
```

### BufferPool

```typescript
export class BufferPool {
  get(size: number, type?: CompositeType): Matrix;
  release(buffer: Matrix): void;
}

export const pool: BufferPool;
```

---

## Supporting Types

Types used across module APIs, defined in their respective modules:

```typescript
// detect/haar.ts
export interface HaarCascade {
  stages: HaarStage[];
  size: [number, number];
  tilted: boolean;
}
export interface Rect {
  x: number; y: number; width: number; height: number;
  confidence: number; neighbors: number;
}

// detect/bbf.ts
export interface BbfCascade {
  stages: BbfStage[];
  size: [number, number];
}

// motion/estimator.ts
export interface RansacParams {
  size: number;
  thresh: number;
  eps: number;
  prob: number;
}
export interface LmedsParams {
  size: number;
  eps: number;
  prob: number;
}

// motion/models.ts
export interface MotionKernel {
  run(from: number[], to: number[], model: Matrix, count: number): number;
  error(from: number[], to: number[], model: Matrix, err: Float64Array, count: number): void;
  checkSubset(from: number[], to: number[], count: number): boolean;
}
```

---

## Module APIs

All modules export standalone functions. No class wrappers for stateless operations.

### `jsfeat/imgproc`

```typescript
export function grayscale(src: ImageData | Uint8Array, dst: Matrix, code?: ColorCode): void;
export function resample(src: Matrix, dst: Matrix, newWidth: number, newHeight: number): void;
export function pyrDown(src: Matrix, dst: Matrix, sx?: number, sy?: number): void;
export function boxBlur(src: Matrix, dst: Matrix, kernelSize: number): void;
export function gaussianBlur(src: Matrix, dst: Matrix, kernelSize: number, sigma?: number): void;
export function cannyEdges(src: Matrix, dst: Matrix, lowThreshold: number, highThreshold: number): void;
export function sobelDerivatives(src: Matrix, dst: Matrix): void;
export function scharrDerivatives(src: Matrix, dst: Matrix): void;
export function equalizeHistogram(src: Matrix, dst: Matrix): void;
export function computeIntegralImage(src: Matrix, dst: Matrix, sqDst?: Matrix, tilted?: Matrix): void;
```

### `jsfeat/math`

```typescript
// Math utilities
export function getGaussianKernel(size: number, sigma: number, kernel?: Float64Array): Float64Array;
export function perspectiveTransform(src: Matrix, dst: Matrix, transform: Matrix): void;
export function qsort<T>(array: T[], low: number, high: number, cmp: (a: T, b: T) => boolean): void;

// Linear algebra
export function luSolve(A: Matrix, B: Matrix): void;
export function luInverse(src: Matrix, dst: Matrix): void;
export function luDet(src: Matrix): number;
export function choleskyDecompose(A: Matrix): number;
export function choleskyInverse(A: Matrix, dst: Matrix): void;
export function svdDecompose(A: Matrix, W: Matrix, U: Matrix, V: Matrix, options?: number): void;
export function svdSolve(A: Matrix, x: Matrix, b: Matrix): void;
export function eigenvalues(A: Matrix, eigenvalues: Matrix): void;

// Matrix arithmetic
export function identity(dst: Matrix): void;
export function transpose(At: Matrix, A: Matrix): void;
export function multiply(C: Matrix, A: Matrix, B: Matrix): void;
export function multiplyABt(C: Matrix, A: Matrix, B: Matrix): void;
export function multiplyAtB(C: Matrix, A: Matrix, B: Matrix): void;
export function multiplyAtA(C: Matrix, A: Matrix): void;
export function add(dst: Matrix, A: Matrix, B: Matrix): void;
export function sub(dst: Matrix, A: Matrix, B: Matrix): void;
export function scale(dst: Matrix, A: Matrix, alpha: number): void;
```

### `jsfeat/features`

```typescript
export function fastCorners(src: Matrix, points: Keypoint[], threshold?: number, border?: number): number;
export function yape06Detect(src: Matrix, points: Keypoint[], border?: number): number;
export function yapeDetect(src: Matrix, pyramid: Pyramid, points: Keypoint[], border?: number): number;
export function orbDescribe(src: Matrix, corners: Keypoint[], count: number, descriptors: Matrix): void;
```

### `jsfeat/flow`

```typescript
export function lucasKanade(
  prevPyr: Pyramid, currPyr: Pyramid,
  prevXY: Float32Array, currXY: Float32Array,
  count: number, winSize?: number, maxIterations?: number,
  status?: Uint8Array, eps?: number, minEigen?: number,
): void;
```

### `jsfeat/detect`

```typescript
export function haarDetectMultiScale(
  integralSum: Matrix, integralSqSum: Matrix,
  cascade: HaarCascade, width: number, height: number,
  scaleFactor?: number, scaleMin?: number, rects?: Rect[],
): Rect[];

export function bbfDetect(
  src: Matrix, cascade: BbfCascade,
  interval?: number, minScale?: number,
): Rect[];
```

### `jsfeat/motion`

```typescript
export function ransac(
  params: RansacParams, kernel: MotionKernel,
  from: Matrix, to: Matrix, model: Matrix, mask: Matrix,
  maxIterations?: number,
): boolean;

export function lmeds(
  params: LmedsParams, kernel: MotionKernel,
  from: Matrix, to: Matrix, model: Matrix, mask: Matrix,
): boolean;

export const affine2d: MotionKernel;
export const homography2d: MotionKernel;
```

### `jsfeat/transform`

```typescript
export function affine3PointTransform(src: Matrix, dst: number[], srcPoints: number[]): void;
export function perspective4PointTransform(src: Matrix, dst: number[], srcPoints: number[]): void;
export function invertAffineTransform(src: number[], dst: number[]): void;
export function invertPerspectiveTransform(src: number[], dst: number[]): void;
```

### `jsfeat/cascades`

```typescript
export { frontalface } from './frontalface';
export { profileface } from './profileface';
export { eye } from './eye';
export { mouth } from './mouth';
export { upperbody } from './upperbody';
export { handopen } from './handopen';
export { handfist } from './handfist';
export { bbfFace } from './bbfFace';
```

---

## Testing Strategy

### Approach

- **Regression oracle:** Keep original source in `legacy/` during port. Run same inputs through both implementations, assert identical outputs.
- **Comprehensive coverage:** Every public API function tested with valid inputs, edge cases, type variations, and numerical accuracy checks.
- **Remove `legacy/` once all modules pass.**

### Test Helpers

- `test/helpers/synthetic.ts` — Generate deterministic test images (gradients, checkerboards, circles, squares). No external fixtures.
- `test/helpers/comparison.ts` — `expectMatricesClose(a, b, epsilon)` for float comparisons.

### What Gets Tested Per Module

- All public API functions with valid inputs
- Edge cases (empty matrix, 1x1 matrix, zero-value inputs)
- Type handling (U8 vs F32 code paths)
- Numerical accuracy (epsilon comparisons for floating-point)
- Output dimensions and types

### Test Files

Mirror the source structure: `test/core/matrix.test.ts`, `test/math/linalg.test.ts`, etc.

---

## Documentation & Demo

### API Documentation

- **TypeDoc** generates static HTML from TSDoc comments in source
- Output: `docs/api/` (gitignored, built in CI)

### Examples

Seven standalone scripts in `examples/`:

1. `grayscale-conversion.ts` — Load image, convert to grayscale
2. `edge-detection.ts` — Canny edges on a canvas image
3. `corner-detection.ts` — FAST corners visualized
4. `face-detection.ts` — HAAR cascade with frontalface
5. `optical-flow.ts` — LK tracking between two frames
6. `feature-matching.ts` — ORB descriptors + matching
7. `motion-estimation.ts` — RANSAC homography from point pairs

### Demo SPA

- Vanilla TypeScript Vite app in `demo/`
- Live webcam-based demos using `getUserMedia`
- Each demo runs in a `<canvas>`, user picks from a sidebar
- No framework dependencies

### Deployment

- `docs/` in main branch: source documentation, guides, specs
- `gh-pages` branch: built output (demo SPA + TypeDoc API docs)
- GitHub Actions workflow: build and deploy on push to main

---

## Build & Tooling

### package.json

```json
{
  "name": "jsfeat",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    "./core": { "types": "./dist/core/index.d.ts", "default": "./dist/core/index.js" },
    "./math": { "types": "./dist/math/index.d.ts", "default": "./dist/math/index.js" },
    "./imgproc": { "types": "./dist/imgproc/index.d.ts", "default": "./dist/imgproc/index.js" },
    "./features": { "types": "./dist/features/index.d.ts", "default": "./dist/features/index.js" },
    "./flow": { "types": "./dist/flow/index.d.ts", "default": "./dist/flow/index.js" },
    "./detect": { "types": "./dist/detect/index.d.ts", "default": "./dist/detect/index.js" },
    "./motion": { "types": "./dist/motion/index.d.ts", "default": "./dist/motion/index.js" },
    "./transform": { "types": "./dist/transform/index.d.ts", "default": "./dist/transform/index.js" },
    "./cascades": { "types": "./dist/cascades/index.d.ts", "default": "./dist/cascades/index.js" }
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "docs": "typedoc",
    "demo:dev": "vite --config demo/vite.config.ts",
    "demo:build": "vite build --config demo/vite.config.ts",
    "lint": "eslint src/",
    "format": "prettier --write src/"
  }
}
```

### Formatting & Linting

- **Prettier** for code formatting
- **ESLint** with TypeScript rules
- Configs at project root

---

## Migration Phases

### Phase 1: TypeScript Port

For each module (in dependency order):
1. Copy original JS to `legacy/`
2. Create new `.ts` file in proper location
3. Port the code to TypeScript, preserving logic exactly
4. Add comprehensive tests
5. Verify regression against legacy

Module order:
1. `core/types` (constants, helpers)
2. `core/data`, `core/matrix`, `core/keypoint`, `core/pyramid` (data structures)
3. `core/cache` (buffer pool)
4. `math/math` (utilities)
5. `math/matmath` (matrix arithmetic)
6. `math/linalg` (linear algebra)
7. `imgproc/imgproc` (image processing)
8. `features/fast`, `features/yape06`, `features/yape` (detectors)
9. `features/orb` (descriptor)
10. `flow/lucasKanade` (optical flow)
11. `detect/haar`, `detect/bbf` (object detection)
12. `motion/models`, `motion/estimator` (motion estimation)
13. `transform/transform` (geometric transforms)
14. `cascades/*` (detector data)

### Phase 2: Modernization

After all modules are ported and tested:
1. Convert closure-based objects to classes
2. Rename all public API to camelCase
3. Add TSDoc comments to all public functions
4. Clean up internal patterns (replace `var` with `const`/`let`, etc.)
5. Optimize imports and tree-shaking

### Phase 3: Documentation & Demo

1. Add TypeDoc configuration
2. Write examples
3. Build demo SPA
4. Set up GitHub Actions for CI and deployment
5. Update README

---

## Original Module Inventory

For reference, the original library contains ~5,800 lines across 16 modules:

| Original File | Lines | New Location |
|---|---|---|
| `jsfeat.js` | 6 | `core/types.ts` |
| `jsfeat_struct.js` | 232 | `core/matrix.ts`, `core/data.ts`, `core/keypoint.ts`, `core/pyramid.ts` |
| `jsfeat_cache.js` | 79 | `core/cache.ts` |
| `jsfeat_math.js` | 414 | `math/math.ts` |
| `jsfeat_mat_math.js` | 232 | `math/matmath.ts` |
| `jsfeat_linalg.js` | 687 | `math/linalg.ts` |
| `jsfeat_imgproc.js` | 1,254 | `imgproc/imgproc.ts` |
| `jsfeat_fast_corners.js` | 254 | `features/fast.ts` |
| `jsfeat_yape06.js` | 100 | `features/yape06.ts` |
| `jsfeat_yape.js` | 409 | `features/yape.ts` |
| `jsfeat_orb.js` | 364 | `features/orb.ts` |
| `jsfeat_optical_flow_lk.js` | 246 | `flow/lucasKanade.ts` |
| `jsfeat_haar.js` | 290 | `detect/haar.ts` |
| `jsfeat_bbf.js` | 394 | `detect/bbf.ts` |
| `jsfeat_motion_estimator.js` | 660 | `motion/estimator.ts`, `motion/models.ts` |
| `jsfeat_transform.js` | 171 | `transform/transform.ts` |
| `jsfeat_export.js` | 15 | (replaced by ES module exports) |
