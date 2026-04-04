/* ------------------------------------------------------------------ *
 *  API Reference page
 *
 *  Comprehensive reference organized by module, with TypeScript
 *  signatures read from source and links to relevant demos.
 * ------------------------------------------------------------------ */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiEntry {
  name: string;
  signature: string;
  description: string;
  demoId?: string;
}

interface ApiSection {
  title: string;
  id: string;
  entries: ApiEntry[];
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const sections: ApiSection[] = [
  // ==== Core ====
  {
    title: 'Core',
    id: 'core',
    entries: [
      {
        name: 'Matrix',
        signature: `class Matrix {
  type: number;
  channel: number;
  cols: number;
  rows: number;
  buffer: DataBuffer;
  data: TypedArrayUnion;

  constructor(cols: number, rows: number, dataType: number, dataBuffer?: DataBuffer);
  allocate(): void;
  copyTo(other: Matrix): void;
  resize(cols: number, rows: number, ch?: number): void;
}`,
        description: 'Primary 2-D data structure backed by a DataBuffer with typed-array views.',
      },
      {
        name: 'Keypoint',
        signature: `class Keypoint {
  x: number;
  y: number;
  score: number;
  level: number;
  angle: number;

  constructor(x?: number, y?: number, score?: number, level?: number, angle?: number);
}`,
        description: 'Detected interest point with position, score, pyramid level, and orientation angle.',
      },
      {
        name: 'Pyramid',
        signature: `class Pyramid {
  levels: number;
  data: Matrix[];
  pyrdown: ((src: Matrix, dst: Matrix) => void) | null;

  constructor(levels: number);
  allocate(startW: number, startH: number, dataType: number): void;
  build(input: Matrix, skipFirstLevel?: boolean): void;
}`,
        description: 'Multi-scale image pyramid where each level is half the resolution of the previous one.',
      },
      {
        name: 'DataBuffer',
        signature: `class DataBuffer {
  size: number;
  buffer: ArrayBuffer;
  u8: Uint8Array;
  i32: Int32Array;
  f32: Float32Array;
  f64: Float64Array;

  constructor(sizeInBytes: number, buffer?: ArrayBuffer);
}`,
        description: 'Byte-aligned buffer exposing Uint8, Int32, Float32, and Float64 views of the same ArrayBuffer.',
      },
      {
        name: 'BufferPool',
        signature: `class BufferPool {
  constructor(capacity: number, dataSize: number);
  get(sizeInBytes: number): PoolNode;
  release(node: PoolNode): void;
}`,
        description: 'Linked-list pool of reusable DataBuffer nodes for O(1) allocation without GC pressure.',
      },
      {
        name: 'DataType',
        signature: `const DataType = {
  U8:  0x0100,   // Unsigned 8-bit integer
  S32: 0x0200,   // Signed 32-bit integer
  F32: 0x0400,   // 32-bit floating point
  S64: 0x0800,   // Signed 64-bit integer
  F64: 0x1000,   // 64-bit floating point
} as const;`,
        description: 'Flags for specifying the element type of a Matrix (bits 8-15 of a composite type).',
      },
      {
        name: 'Channel',
        signature: `const Channel = {
  C1: 0x01,   // Single channel (grayscale)
  C2: 0x02,   // Two channels
  C3: 0x03,   // Three channels (RGB)
  C4: 0x04,   // Four channels (RGBA)
} as const;`,
        description: 'Channel count flags (bits 0-7 of a composite type).',
      },
      {
        name: 'Composite Types',
        signature: `const U8C1:  number;  // DataType.U8  | Channel.C1
const U8C3:  number;  // DataType.U8  | Channel.C3
const U8C4:  number;  // DataType.U8  | Channel.C4
const F32C1: number;  // DataType.F32 | Channel.C1
const F32C2: number;  // DataType.F32 | Channel.C2
const S32C1: number;  // DataType.S32 | Channel.C1
const S32C2: number;  // DataType.S32 | Channel.C2`,
        description: 'Pre-combined DataType | Channel shorthand constants for common matrix types.',
      },
      {
        name: 'getDataType',
        signature: `function getDataType(type: number): number;`,
        description: 'Extract the data-type portion (upper byte) from a composite type value.',
      },
      {
        name: 'getChannel',
        signature: `function getChannel(type: number): number;`,
        description: 'Extract the channel portion (lower byte) from a composite type value.',
      },
      {
        name: 'getDataTypeSize',
        signature: `function getDataTypeSize(type: number): number;`,
        description: 'Return the byte-size per element for the given composite or data type flag.',
      },
    ],
  },

  // ==== Math ====
  {
    title: 'Math',
    id: 'math',
    entries: [
      {
        name: 'getGaussianKernel',
        signature: `function getGaussianKernel(
  size: number,
  sigma: number,
  kernel: TypedArrayUnion | number[],
  dataType: number,
): void;`,
        description: 'Generate a 1-D Gaussian kernel; uses hardcoded values for small odd sizes when sigma <= 0.',
      },
      {
        name: 'perspective4PointTransform',
        signature: `function perspective4PointTransform(
  model: Matrix,
  srcX0: number, srcY0: number, dstX0: number, dstY0: number,
  srcX1: number, srcY1: number, dstX1: number, dstY1: number,
  srcX2: number, srcY2: number, dstX2: number, dstY2: number,
  srcX3: number, srcY3: number, dstX3: number, dstY3: number,
): void;`,
        description: 'Compute a 3x3 perspective (homography) transform from 4 point pairs into a Matrix.',
        demoId: 'warpPerspective',
      },
      {
        name: 'qsort',
        signature: `function qsort<T>(
  array: T[],
  low: number,
  high: number,
  cmp: (a: T, b: T) => boolean,
): void;`,
        description: 'BSD-derived quicksort with insertion-sort fallback; sorts array[low..high] in-place.',
      },
      {
        name: 'median',
        signature: `function median(
  array: number[],
  low: number,
  high: number,
): number;`,
        description: 'Quickselect-based median finder; partially sorts the array in-place and returns the median.',
      },
      {
        name: 'identity',
        signature: `function identity(M: Matrix, value?: number): void;`,
        description: 'Set M to the identity matrix (diagonal = value, rest = 0).',
      },
      {
        name: 'transpose',
        signature: `function transpose(At: Matrix, A: Matrix): void;`,
        description: 'Transpose matrix: At = A\'.',
      },
      {
        name: 'multiply',
        signature: `function multiply(C: Matrix, A: Matrix, B: Matrix): void;`,
        description: 'General matrix multiply: C = A * B.',
      },
      {
        name: 'multiplyABt',
        signature: `function multiplyABt(C: Matrix, A: Matrix, B: Matrix): void;`,
        description: 'Multiply A by transpose of B: C = A * B\'.',
      },
      {
        name: 'multiplyAtB',
        signature: `function multiplyAtB(C: Matrix, A: Matrix, B: Matrix): void;`,
        description: 'Multiply transpose of A by B: C = A\' * B.',
      },
      {
        name: 'multiplyAAt',
        signature: `function multiplyAAt(C: Matrix, A: Matrix): void;`,
        description: 'Symmetric product: C = A * A\'.',
      },
      {
        name: 'multiplyAtA',
        signature: `function multiplyAtA(C: Matrix, A: Matrix): void;`,
        description: 'Symmetric product: C = A\' * A.',
      },
      {
        name: 'identity3x3',
        signature: `function identity3x3(M: Matrix, value?: number): void;`,
        description: 'Optimized 3x3 identity (no loops).',
      },
      {
        name: 'invert3x3',
        signature: `function invert3x3(from: Matrix, to: Matrix): void;`,
        description: 'Invert a 3x3 matrix using Cramer\'s rule.',
      },
      {
        name: 'multiply3x3',
        signature: `function multiply3x3(C: Matrix, A: Matrix, B: Matrix): void;`,
        description: 'Optimized 3x3 matrix multiply: C = A * B.',
      },
      {
        name: 'mat3x3Determinant',
        signature: `function mat3x3Determinant(M: Matrix): number;`,
        description: 'Compute the determinant of a 3x3 Matrix.',
      },
      {
        name: 'determinant3x3',
        signature: `function determinant3x3(
  M11: number, M12: number, M13: number,
  M21: number, M22: number, M23: number,
  M31: number, M32: number, M33: number,
): number;`,
        description: 'Compute the determinant of a 3x3 matrix from 9 scalar values.',
      },
      {
        name: 'luSolve',
        signature: `function luSolve(A: Matrix, B: Matrix): number;`,
        description: 'Solve A*x = B using LU decomposition with partial pivoting; returns 1 on success, 0 on failure.',
      },
      {
        name: 'choleskySolve',
        signature: `function choleskySolve(A: Matrix, B: Matrix): number;`,
        description: 'Solve A*x = B using Cholesky decomposition; A must be symmetric positive-definite.',
      },
      {
        name: 'svdDecompose',
        signature: `function svdDecompose(
  A: Matrix,
  W: Matrix | null,
  U: Matrix | null,
  V: Matrix | null,
  options?: number,
): void;`,
        description: 'Singular Value Decomposition via Jacobi: A = U * diag(W) * V^T.',
      },
      {
        name: 'svdSolve',
        signature: `function svdSolve(A: Matrix, X: Matrix, B: Matrix): void;`,
        description: 'Solve A*X = B via SVD pseudo-inverse.',
      },
      {
        name: 'svdInvert',
        signature: `function svdInvert(Ai: Matrix, A: Matrix): void;`,
        description: 'Compute the pseudo-inverse of A via SVD: Ai = V * diag(1/W) * U^T.',
      },
      {
        name: 'eigenVV',
        signature: `function eigenVV(
  A: Matrix,
  vects: Matrix | null,
  vals: Matrix | null,
): void;`,
        description: 'Compute eigenvalues and eigenvectors of a symmetric matrix using the Jacobi iterative method.',
      },
    ],
  },

  // ==== Image Processing ====
  {
    title: 'Image Processing',
    id: 'imgproc',
    entries: [
      {
        name: 'grayscale',
        signature: `function grayscale(
  src: Uint8Array | Uint8ClampedArray,
  w: number,
  h: number,
  dst: Matrix,
  code?: number,
): void;`,
        description: 'Convert RGBA/RGB/BGRA/BGR pixel data to single-channel grayscale.',
        demoId: 'grayscale',
      },
      {
        name: 'gaussianBlur',
        signature: `function gaussianBlur(
  src: Matrix,
  dst: Matrix,
  kernel_size: number,
  sigma?: number,
): void;`,
        description: 'Apply Gaussian blur with the given kernel size and sigma.',
        demoId: 'gaussianBlur',
      },
      {
        name: 'boxBlurGray',
        signature: `function boxBlurGray(
  src: Matrix,
  dst: Matrix,
  radius: number,
  options?: number,
): void;`,
        description: 'Fast box blur for grayscale images; pass BOX_BLUR_NOSCALE to skip normalization.',
        demoId: 'boxBlur',
      },
      {
        name: 'cannyEdges',
        signature: `function cannyEdges(
  src: Matrix,
  dst: Matrix,
  low_thresh: number,
  high_thresh: number,
): void;`,
        description: 'Canny edge detection with hysteresis thresholding.',
        demoId: 'edges',
      },
      {
        name: 'sobelDerivatives',
        signature: `function sobelDerivatives(src: Matrix, dst: Matrix): void;`,
        description: 'Compute Sobel gradient (dx, dy interleaved in 2-channel S32 output).',
        demoId: 'sobel',
      },
      {
        name: 'scharrDerivatives',
        signature: `function scharrDerivatives(src: Matrix, dst: Matrix): void;`,
        description: 'Compute Scharr gradient (dx, dy interleaved in 2-channel S32 output).',
        demoId: 'scharr',
      },
      {
        name: 'equalizeHistogram',
        signature: `function equalizeHistogram(src: Matrix, dst: Matrix): void;`,
        description: 'Equalize the histogram of a grayscale image to improve contrast.',
        demoId: 'equalizeHist',
      },
      {
        name: 'pyrDown',
        signature: `function pyrDown(
  src: Matrix,
  dst: Matrix,
  sx?: number,
  sy?: number,
): void;`,
        description: 'Downsample an image by half using a 5-tap Gaussian kernel.',
        demoId: 'pyrDown',
      },
      {
        name: 'resample',
        signature: `function resample(
  src: Matrix,
  dst: Matrix,
  nw: number,
  nh: number,
): void;`,
        description: 'Area-based image resampling (downscaling only).',
      },
      {
        name: 'computeIntegralImage',
        signature: `function computeIntegralImage(
  src: Matrix,
  dst_sum?: Int32Array | Float32Array | Float64Array | null,
  dst_sqsum?: Int32Array | Float32Array | Float64Array | null,
  dst_tilted?: Int32Array | Float32Array | Float64Array | null,
): void;`,
        description: 'Compute integral image, squared integral, and/or tilted integral.',
        demoId: 'faceDetect',
      },
      {
        name: 'warpAffine',
        signature: `function warpAffine(
  src: Matrix,
  dst: Matrix,
  transform: Matrix,
  fillValue?: number,
): void;`,
        description: 'Apply a 2x3 affine warp to an image with bilinear interpolation.',
        demoId: 'warpAffine',
      },
    ],
  },

  // ==== Features ====
  {
    title: 'Features',
    id: 'features',
    entries: [
      {
        name: 'fastCorners',
        signature: `function fastCorners(
  src: Matrix,
  corners: Keypoint[],
  threshold?: number,
  border?: number,
): number;`,
        description: 'Detect FAST-16 corners with non-maximum suppression; returns the number of detected keypoints.',
        demoId: 'corners',
      },
      {
        name: 'yape06Detect',
        signature: `function yape06Detect(
  src: Matrix,
  points: Keypoint[],
  border?: number,
  laplacianThreshold?: number,
  minEigenThreshold?: number,
): number;`,
        description: 'Detect YAPE06 keypoints using Laplacian and Hessian eigenvalue filtering.',
        demoId: 'yape06',
      },
      {
        name: 'yapeDetect',
        signature: `function yapeDetect(
  src: Matrix,
  points: Keypoint[],
  border?: number,
): number;`,
        description: 'Detect YAPE keypoints; requires yapeInit() to be called first.',
        demoId: 'yape',
      },
      {
        name: 'yapeInit',
        signature: `function yapeInit(
  width: number,
  height: number,
  radius: number,
  pyramidLevels?: number,
): void;`,
        description: 'Initialize YAPE detector lookup tables for the given image dimensions and radius.',
        demoId: 'yape',
      },
      {
        name: 'orbDescribe',
        signature: `function orbDescribe(
  src: Matrix,
  corners: Keypoint[],
  count: number,
  descriptors: Matrix,
): void;`,
        description: 'Compute oriented BRIEF (ORB) descriptors for the given keypoints.',
        demoId: 'orbMatch',
      },
    ],
  },

  // ==== Optical Flow ====
  {
    title: 'Optical Flow',
    id: 'flow',
    entries: [
      {
        name: 'lucasKanade',
        signature: `function lucasKanade(
  prevPyr: Pyramid,
  currPyr: Pyramid,
  prevXY: Float32Array,
  currXY: Float32Array,
  count: number,
  winSize?: number,
  maxIter?: number,
  status?: Uint8Array,
  eps?: number,
  minEigenThreshold?: number,
): void;`,
        description: 'Pyramid-based sparse optical flow using iterative Lucas-Kanade with Scharr gradients.',
        demoId: 'opticalFlow',
      },
    ],
  },

  // ==== Detection ====
  {
    title: 'Detection',
    id: 'detect',
    entries: [
      {
        name: 'haarDetectSingleScale',
        signature: `function haarDetectSingleScale(
  intSum: Int32Array | Float32Array | number[],
  intSqsum: Int32Array | Float32Array | Float64Array | number[],
  intTilted: Int32Array | Float32Array | number[],
  intCannySum: Int32Array | Float32Array | number[] | null,
  width: number,
  height: number,
  scale: number,
  classifier: { size: number[]; complexClassifiers: any[] },
): HaarRect[];`,
        description: 'Run the Haar cascade at a single scale; returns raw detection rectangles.',
        demoId: 'faceDetect',
      },
      {
        name: 'haarDetectMultiScale',
        signature: `function haarDetectMultiScale(
  intSum: Int32Array | Float32Array | number[],
  intSqsum: Int32Array | Float32Array | Float64Array | number[],
  intTilted: Int32Array | Float32Array | number[],
  intCannySum: Int32Array | Float32Array | number[] | null,
  width: number,
  height: number,
  classifier: { size: number[]; complexClassifiers: any[] },
  scaleFactor?: number,
  scaleMin?: number,
): HaarRect[];`,
        description: 'Run Haar cascade at multiple scales, accumulating all raw detections.',
        demoId: 'faceDetect',
      },
      {
        name: 'groupRectangles',
        signature: `function groupRectangles(
  rects: HaarRect[],
  minNeighbors?: number,
): GroupedRect[];`,
        description: 'Merge overlapping Haar detections into averaged bounding boxes.',
        demoId: 'faceDetect',
      },
      {
        name: 'bbfPrepareCascade',
        signature: `function bbfPrepareCascade(cascade: any): void;`,
        description: 'Pre-process a BBF cascade classifier for efficient feature lookup.',
        demoId: 'bbfFace',
      },
      {
        name: 'bbfBuildPyramid',
        signature: `function bbfBuildPyramid(
  src: Matrix,
  minWidth: number,
  minHeight: number,
  interval?: number,
): Pyramid;`,
        description: 'Build the multi-scale pyramid used by the BBF detector.',
        demoId: 'bbfFace',
      },
      {
        name: 'bbfDetect',
        signature: `function bbfDetect(
  pyramid: Pyramid,
  cascade: any,
): BbfRect[];`,
        description: 'Run BBF (Brightness Binary Feature) detection on the pyramid.',
        demoId: 'bbfFace',
      },
      {
        name: 'bbfGroupRectangles',
        signature: `function bbfGroupRectangles(
  rects: BbfRect[],
  minNeighbors?: number,
): GroupedRect[];`,
        description: 'Merge overlapping BBF detections into averaged bounding boxes.',
        demoId: 'bbfFace',
      },
    ],
  },

  // ==== Motion ====
  {
    title: 'Motion',
    id: 'motion',
    entries: [
      {
        name: 'ransac',
        signature: `function ransac(
  params: RansacParams,
  kernel: MotionKernel,
  from: { x: number; y: number }[],
  to: { x: number; y: number }[],
  count: number,
  model: Matrix,
  mask: Matrix | null,
  maxIters?: number,
): boolean;`,
        description: 'RANSAC robust model estimation; returns true if a model was found.',
        demoId: 'videoStab',
      },
      {
        name: 'lmeds',
        signature: `function lmeds(
  params: RansacParams,
  kernel: MotionKernel,
  from: { x: number; y: number }[],
  to: { x: number; y: number }[],
  count: number,
  model: Matrix,
  mask: Matrix | null,
  maxIters?: number,
): boolean;`,
        description: 'Least Median of Squares robust model estimation; returns true if a model was found.',
      },
      {
        name: 'affine2d',
        signature: `const affine2d: MotionKernel;`,
        description: 'Affine 2D motion model kernel (6 DOF) for use with ransac/lmeds.',
        demoId: 'videoStab',
      },
      {
        name: 'homography2d',
        signature: `const homography2d: MotionKernel;`,
        description: 'Homography (perspective) motion model kernel (8 DOF) for use with ransac/lmeds.',
        demoId: 'warpPerspective',
      },
      {
        name: 'createRansacParams',
        signature: `function createRansacParams(
  size?: number,
  thresh?: number,
  eps?: number,
  prob?: number,
): RansacParams;`,
        description: 'Create RANSAC/LMEDS parameters with sensible defaults.',
      },
      {
        name: 'updateIters',
        signature: `function updateIters(
  params: RansacParams,
  eps: number,
  maxIters: number,
): number;`,
        description: 'Update the RANSAC iteration count based on the current outlier ratio.',
      },
    ],
  },

  // ==== Transform ====
  {
    title: 'Transform',
    id: 'transform',
    entries: [
      {
        name: 'affine3PointTransform',
        signature: `function affine3PointTransform(
  model: number[] | Float32Array | Float64Array,
  srcX0: number, srcY0: number, dstX0: number, dstY0: number,
  srcX1: number, srcY1: number, dstX1: number, dstY1: number,
  srcX2: number, srcY2: number, dstX2: number, dstY2: number,
): void;`,
        description: 'Compute a 2x3 affine transform from 3 point pairs using Cramer\'s rule.',
        demoId: 'warpAffine',
      },
      {
        name: 'perspective4PointTransformArray',
        signature: `function perspective4PointTransformArray(
  mat: number[] | Float32Array | Float64Array,
  srcX0: number, srcY0: number, dstX0: number, dstY0: number,
  srcX1: number, srcY1: number, dstX1: number, dstY1: number,
  srcX2: number, srcY2: number, dstX2: number, dstY2: number,
  srcX3: number, srcY3: number, dstX3: number, dstY3: number,
): void;`,
        description: 'Compute a 3x3 perspective transform from 4 point pairs into a plain array.',
        demoId: 'warpPerspective',
      },
      {
        name: 'invertAffineTransform',
        signature: `function invertAffineTransform(
  src: number[] | Float32Array | Float64Array,
  dst: number[] | Float32Array | Float64Array,
): void;`,
        description: 'Invert a 2x3 affine transform matrix.',
        demoId: 'warpAffine',
      },
      {
        name: 'invertPerspectiveTransform',
        signature: `function invertPerspectiveTransform(
  src: number[] | Float32Array | Float64Array,
  dst: number[] | Float32Array | Float64Array,
): void;`,
        description: 'Invert a 3x3 perspective (homography) transform matrix.',
        demoId: 'warpPerspective',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderApiReference(container: HTMLElement): void {
  let html = `<div class="page">`;
  html += `<h1 class="page-title">API Reference</h1>`;
  html += `<p class="page-tagline">Complete TypeScript API for jsfeat modules</p>`;

  // Table of contents
  html += `<nav class="api-toc">`;
  for (const sec of sections) {
    html += `<a href="#api-${sec.id}" class="api-toc-link">${sec.title}</a>`;
  }
  html += `</nav>`;

  // Sections
  for (const sec of sections) {
    html += `<section class="api-section" id="api-${sec.id}">`;
    html += `<h2 class="api-section-title">${sec.title}</h2>`;

    for (const entry of sec.entries) {
      html += `<div class="api-entry">`;
      html += `<h3 class="api-entry-name">${escapeHtml(entry.name)}`;
      if (entry.demoId) {
        html += ` <a href="#/demos/${entry.demoId}" class="api-try-link">Try it &rarr;</a>`;
      }
      html += `</h3>`;
      html += `<pre class="api-sig"><code>${escapeHtml(entry.signature)}</code></pre>`;
      html += `<p class="api-desc">${escapeHtml(entry.description)}</p>`;
      html += `</div>`;
    }

    html += `</section>`;
  }

  html += `</div>`;

  // Inject styles
  html += `<style>
    .page { max-width: 900px; margin: 0 auto; }
    .page-title { color: var(--accent); font-size: 1.8rem; margin-bottom: 4px; }
    .page-tagline { color: var(--text-muted); margin-bottom: 24px; font-size: 0.95rem; }

    .api-toc {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .api-toc-link {
      color: var(--text-muted);
      text-decoration: none;
      padding: 4px 12px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 0.82rem;
      transition: background 0.12s, color 0.12s;
    }
    .api-toc-link:hover { background: var(--border); color: #fff; }

    .api-section { margin-bottom: 40px; }
    .api-section-title {
      color: var(--accent);
      font-size: 1.2rem;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    .api-entry {
      margin-bottom: 20px;
      padding: 12px 16px;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 6px;
    }
    .api-entry-name {
      font-size: 1rem;
      color: var(--text);
      margin-bottom: 8px;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    }
    .api-try-link {
      font-size: 0.75rem;
      color: var(--accent);
      text-decoration: none;
      margin-left: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 400;
    }
    .api-try-link:hover { text-decoration: underline; }

    .api-sig {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 10px 14px;
      overflow-x: auto;
      margin-bottom: 8px;
    }
    .api-sig code {
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 0.82rem;
      color: var(--info);
      white-space: pre;
    }

    .api-desc {
      color: var(--text-muted);
      font-size: 0.85rem;
      line-height: 1.5;
      margin: 0;
    }
  </style>`;

  container.innerHTML = html;
}
