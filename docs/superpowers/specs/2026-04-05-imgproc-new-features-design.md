# New imgproc Features — Design Specification

## Overview

Add three missing CV primitives to the jsfeat core library: `findContours`, `adaptiveThreshold`, and `warpPerspective`. These fill critical gaps exposed during real-world usage (card detection demo) and align jsfeat with OpenCV's feature set.

All three functions follow the existing imgproc conventions: `src/dst` Matrix parameters, void return, BufferPool for temporaries, pointer arithmetic for performance.

---

## 1. findContours

Finds connected contour boundaries in a binary edge image.

### Types

```typescript
export interface Contour {
  points: { x: number; y: number }[];
  area: number;
  perimeter: number;
  boundingRect: { x: number; y: number; width: number; height: number };
}

export enum ContourMode {
  EXTERNAL = 0,  // Only outermost contours
  LIST = 1,      // All contours, no hierarchy
}
```

### Function

```typescript
export function findContours(src: Matrix, mode?: ContourMode): Contour[];
```

- **Input:** U8C1 binary image (0 = background, non-zero = foreground/edge)
- **Output:** Array of `Contour` objects, sorted by area descending
- **Default mode:** `ContourMode.LIST`

### Algorithm: Suzuki-Abe Border Following

1. Create a copy of the input (border following modifies the image)
2. Scan left-to-right, top-to-bottom for border pixels
3. For each border pixel, trace the contour using 8-connectivity Moore boundary tracing
4. Mark traced pixels to avoid re-tracing
5. For EXTERNAL mode, fill interior after tracing to skip inner contours
6. For each traced contour, compute:
   - `area`: shoelace formula
   - `perimeter`: sum of distances between consecutive points
   - `boundingRect`: min/max x/y

### Helper: approxPoly

```typescript
export function approxPoly(
  contour: Contour,
  epsilon: number,
): { x: number; y: number }[];
```

Douglas-Peucker polygon simplification. Returns simplified point array. `epsilon` controls approximation accuracy (larger = fewer points).

### Buffer Management

- Uses `pool.get((w * h) << 2)` for the working copy of the input image
- Uses `pool.get((w * h) << 2)` for the label/visited map
- Both released after function returns

---

## 2. adaptiveThreshold

Per-pixel thresholding based on local neighborhood statistics.

### Types

```typescript
export enum AdaptiveMethod {
  MEAN = 0,
  GAUSSIAN = 1,
}
```

### Function

```typescript
export function adaptiveThreshold(
  src: Matrix,
  dst: Matrix,
  maxValue: number,
  method: AdaptiveMethod,
  blockSize: number,
  constant: number,
): void;
```

- **Input:** U8C1 grayscale image
- **Output:** U8C1 binary image (0 or maxValue)
- **blockSize:** Must be odd, >= 3. Size of the local neighborhood.
- **constant:** Value subtracted from the local mean before comparison.
- **method:** MEAN uses box blur for local average; GAUSSIAN uses Gaussian blur.

### Algorithm

1. Compute local mean image:
   - MEAN: `boxBlurGray(src, meanImg, blockSize / 2)`
   - GAUSSIAN: `gaussianBlur(src, meanImg, blockSize, 0)`
2. For each pixel: `dst[i] = (src[i] > meanImg[i] - constant) ? maxValue : 0`

### Buffer Management

- Allocates one temporary Matrix for the local mean computation (via pool)
- Reuses existing `boxBlurGray` or `gaussianBlur` internally

---

## 3. warpPerspective

Perspective transformation using a 3×3 homography matrix. Supports multi-channel images.

### Function

```typescript
export function warpPerspective(
  src: Matrix,
  dst: Matrix,
  transform: Matrix,  // 3×3 homography (F32C1 or F64C1)
  fillValue?: number, // Default: 0
): void;
```

- **Input:** Any single or multi-channel Matrix (U8C1, U8C3, U8C4, F32C1, etc.)
- **Output:** Same type/channels as input, dimensions from dst
- **transform:** 3×3 matrix where `[x', y', w'] = H * [x, y, 1]`, source coords = `(x'/w', y'/w')`

### Algorithm

Backward mapping with bilinear interpolation (same approach as existing `warpAffine`):

1. Extract 9 coefficients from transform matrix
2. For each destination pixel `(dx, dy)`:
   - Compute `w = H[6]*dx + H[7]*dy + H[8]`
   - Compute source coords: `sx = (H[0]*dx + H[1]*dy + H[2]) / w`, `sy = (H[3]*dx + H[4]*dy + H[5]) / w`
   - Bilinear interpolation from 4 source neighbors
   - If out of bounds, fill with `fillValue`
3. For multi-channel images, interpolate each channel independently

### Multi-Channel Support

- **C1:** Direct scalar interpolation (same as warpAffine)
- **C2/C3/C4:** Loop over channels at each pixel, computing bilinear for each

### Performance

- Row-level precomputation: `ry = H[1]*dy + H[2]`, `ry2 = H[4]*dy + H[5]`, `rw = H[7]*dy + H[8]`
- Inner loop: `sx = (H[0]*dx + ry) / (H[6]*dx + rw)` — 2 multiplies + 1 add + 1 divide per component

---

## Testing

### findContours tests
- Empty image → empty array
- Single rectangle → 1 contour with correct area/perimeter/boundingRect
- Two separate rectangles → 2 contours sorted by area
- EXTERNAL mode on nested rectangles → only outer contour
- approxPoly on a circle of points → ~4 points with large epsilon

### adaptiveThreshold tests
- Uniform bright image → all maxValue
- Uniform dark image → all 0
- Image with gradient → threshold adapts to local mean
- Known pattern: checkerboard with varying brightness → correctly segmented
- blockSize validation: must be odd, >= 3

### warpPerspective tests
- Identity transform → output equals input
- Translation → pixels shifted
- 90-degree rotation → rotated output
- Multi-channel (U8C4) → channels preserved independently
- Out-of-bounds → filled with fillValue
- Compared with warpAffine for affine subset (should match)

---

## Files Changed

- **Modify:** `src/imgproc/imgproc.ts` — Add all three functions + types
- **Modify:** `src/imgproc/index.ts` — Export new functions and types
- **Modify:** `test/imgproc/imgproc.test.ts` — Add tests for all three functions
