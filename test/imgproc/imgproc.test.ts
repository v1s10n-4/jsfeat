import { describe, it, expect } from 'vitest';
import {
  grayscale,
  resample,
  pyrDown,
  boxBlurGray,
  gaussianBlur,
  cannyEdges,
  sobelDerivatives,
  scharrDerivatives,
  equalizeHistogram,
  computeIntegralImage,
  warpAffine,
} from '../../src/imgproc/imgproc';
import { Matrix } from '../../src/core/matrix';
import { U8C1, S32C1, S32C2, F32C1, ColorCode } from '../../src/core/types';

// ---------------------------------------------------------------------------
// grayscale
// ---------------------------------------------------------------------------

describe('grayscale', () => {
  it('converts white RGBA pixels to ~255 gray', () => {
    const w = 4, h = 2;
    const src = new Uint8Array(w * h * 4);
    // fill with white RGBA
    for (let i = 0; i < src.length; i += 4) {
      src[i] = 255; src[i + 1] = 255; src[i + 2] = 255; src[i + 3] = 255;
    }
    const dst = new Matrix(w, h, U8C1);
    grayscale(src, w, h, dst, ColorCode.RGBA2GRAY);
    for (let i = 0; i < w * h; i++) {
      expect(dst.data[i]).toBeGreaterThanOrEqual(254);
      expect(dst.data[i]).toBeLessThanOrEqual(255);
    }
  });

  it('converts uniform gray RGBA pixels to ~128', () => {
    const w = 8, h = 4;
    const src = new Uint8Array(w * h * 4);
    for (let i = 0; i < src.length; i += 4) {
      src[i] = 128; src[i + 1] = 128; src[i + 2] = 128; src[i + 3] = 255;
    }
    const dst = new Matrix(w, h, U8C1);
    grayscale(src, w, h, dst, ColorCode.RGBA2GRAY);
    for (let i = 0; i < w * h; i++) {
      expect(dst.data[i]).toBeGreaterThanOrEqual(127);
      expect(dst.data[i]).toBeLessThanOrEqual(129);
    }
  });

  it('converts RGB (3-channel) data correctly', () => {
    const w = 4, h = 2;
    const src = new Uint8Array(w * h * 3);
    for (let i = 0; i < src.length; i += 3) {
      src[i] = 255; src[i + 1] = 255; src[i + 2] = 255;
    }
    const dst = new Matrix(w, h, U8C1);
    grayscale(src, w, h, dst, ColorCode.RGB2GRAY);
    for (let i = 0; i < w * h; i++) {
      expect(dst.data[i]).toBeGreaterThanOrEqual(254);
      expect(dst.data[i]).toBeLessThanOrEqual(255);
    }
  });

  it('defaults to RGBA2GRAY when code is omitted', () => {
    const w = 4, h = 2;
    const src = new Uint8Array(w * h * 4);
    for (let i = 0; i < src.length; i += 4) {
      src[i] = 100; src[i + 1] = 100; src[i + 2] = 100; src[i + 3] = 255;
    }
    const dst = new Matrix(w, h, U8C1);
    grayscale(src, w, h, dst);
    // Should produce the same result as RGBA2GRAY
    for (let i = 0; i < w * h; i++) {
      expect(dst.data[i]).toBeGreaterThanOrEqual(99);
      expect(dst.data[i]).toBeLessThanOrEqual(101);
    }
  });
});

// ---------------------------------------------------------------------------
// gaussianBlur
// ---------------------------------------------------------------------------

describe('gaussianBlur', () => {
  it('uniform image stays uniform after blur', () => {
    const w = 16, h = 16;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, U8C1);
    for (let i = 0; i < w * h; i++) src.data[i] = 128;

    gaussianBlur(src, dst, 3);

    for (let i = 0; i < w * h; i++) {
      expect(dst.data[i]).toBeGreaterThanOrEqual(126);
      expect(dst.data[i]).toBeLessThanOrEqual(130);
    }
  });

  it('blurred image differs from non-uniform original', () => {
    const w = 16, h = 16;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, U8C1);
    // Create a pattern: left half bright, right half dark
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        src.data[y * w + x] = x < w / 2 ? 200 : 50;
      }
    }

    gaussianBlur(src, dst, 5, 1.5);

    // The center column should now be blurred (intermediate values)
    let hasDiff = false;
    for (let i = 0; i < w * h; i++) {
      if (dst.data[i] !== src.data[i]) { hasDiff = true; break; }
    }
    expect(hasDiff).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// equalizeHistogram
// ---------------------------------------------------------------------------

describe('equalizeHistogram', () => {
  it('produces wider dynamic range from narrow input', () => {
    const w = 16, h = 16;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, U8C1);
    // Input has narrow range: 100..110
    for (let i = 0; i < w * h; i++) {
      src.data[i] = 100 + (i % 11);
    }

    equalizeHistogram(src, dst);

    let minVal = 255, maxVal = 0;
    for (let i = 0; i < w * h; i++) {
      if (dst.data[i] < minVal) minVal = dst.data[i];
      if (dst.data[i] > maxVal) maxVal = dst.data[i];
    }
    // After equalization the range should be wider than the original 10
    expect(maxVal - minVal).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// sobelDerivatives
// ---------------------------------------------------------------------------

describe('sobelDerivatives', () => {
  it('horizontal gradient produces non-zero x-derivatives', () => {
    const w = 8, h = 8;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, S32C2);
    // Create horizontal gradient: value increases with x
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        src.data[y * w + x] = x * 30;
      }
    }

    sobelDerivatives(src, dst);

    // The gx values (even indices) should have non-zero entries
    let hasNonZeroGx = false;
    for (let i = 0; i < w * h * 2; i += 2) {
      if (dst.data[i] !== 0) { hasNonZeroGx = true; break; }
    }
    expect(hasNonZeroGx).toBe(true);
  });

  it('uniform image has zero derivatives', () => {
    const w = 8, h = 8;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, S32C2);
    for (let i = 0; i < w * h; i++) src.data[i] = 128;

    sobelDerivatives(src, dst);

    for (let i = 0; i < w * h * 2; i++) {
      expect(dst.data[i]).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// scharrDerivatives
// ---------------------------------------------------------------------------

describe('scharrDerivatives', () => {
  it('horizontal gradient produces non-zero x-derivatives', () => {
    const w = 8, h = 8;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, S32C2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        src.data[y * w + x] = x * 30;
      }
    }

    scharrDerivatives(src, dst);

    let hasNonZeroGx = false;
    for (let i = 0; i < w * h * 2; i += 2) {
      if (dst.data[i] !== 0) { hasNonZeroGx = true; break; }
    }
    expect(hasNonZeroGx).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pyrDown
// ---------------------------------------------------------------------------

describe('pyrDown', () => {
  it('halves dimensions', () => {
    const w = 16, h = 16;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(1, 1, U8C1);
    for (let i = 0; i < w * h; i++) src.data[i] = 100;

    pyrDown(src, dst);

    expect(dst.cols).toBe(w >> 1);
    expect(dst.rows).toBe(h >> 1);
  });

  it('uniform input stays uniform', () => {
    const w = 16, h = 16;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(1, 1, U8C1);
    for (let i = 0; i < w * h; i++) src.data[i] = 200;

    pyrDown(src, dst);

    for (let i = 0; i < dst.cols * dst.rows; i++) {
      expect(dst.data[i]).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// boxBlurGray
// ---------------------------------------------------------------------------

describe('boxBlurGray', () => {
  it('uniform input stays uniform', () => {
    const w = 16, h = 16;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, U8C1);
    for (let i = 0; i < w * h; i++) src.data[i] = 100;

    boxBlurGray(src, dst, 2);

    for (let i = 0; i < w * h; i++) {
      expect(dst.data[i]).toBeGreaterThanOrEqual(98);
      expect(dst.data[i]).toBeLessThanOrEqual(102);
    }
  });

  it('produces a blurred result from step function', () => {
    const w = 16, h = 16;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, U8C1);
    // left=0, right=255
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        src.data[y * w + x] = x < w / 2 ? 0 : 255;
      }
    }

    boxBlurGray(src, dst, 2);

    // After blurring, values near the edge should be intermediate
    let hasIntermediate = false;
    for (let i = 0; i < w * h; i++) {
      if (dst.data[i] > 10 && dst.data[i] < 245) {
        hasIntermediate = true;
        break;
      }
    }
    expect(hasIntermediate).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cannyEdges
// ---------------------------------------------------------------------------

describe('cannyEdges', () => {
  it('detects edges in a checkerboard pattern', () => {
    const w = 16, h = 16;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, U8C1);
    // Create 4x4 checkerboard blocks
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const bx = Math.floor(x / 4) % 2;
        const by = Math.floor(y / 4) % 2;
        src.data[y * w + x] = (bx ^ by) ? 255 : 0;
      }
    }

    cannyEdges(src, dst, 20, 40);

    // Should have some edge pixels (255)
    let edgeCount = 0;
    for (let i = 0; i < w * h; i++) {
      if (dst.data[i] === 255) edgeCount++;
    }
    expect(edgeCount).toBeGreaterThan(0);
  });

  it('produces no edges on uniform image', () => {
    const w = 16, h = 16;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, U8C1);
    for (let i = 0; i < w * h; i++) src.data[i] = 128;

    cannyEdges(src, dst, 20, 40);

    let edgeCount = 0;
    for (let i = 0; i < w * h; i++) {
      if (dst.data[i] === 255) edgeCount++;
    }
    expect(edgeCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resample
// ---------------------------------------------------------------------------

describe('resample', () => {
  it('downsamples a uniform U8 image', () => {
    const w = 16, h = 16, nw = 8, nh = 8;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(nw, nh, U8C1);
    for (let i = 0; i < w * h; i++) src.data[i] = 150;

    resample(src, dst, nw, nh);

    expect(dst.cols).toBe(nw);
    expect(dst.rows).toBe(nh);
    for (let i = 0; i < nw * nh; i++) {
      expect(dst.data[i]).toBeGreaterThanOrEqual(148);
      expect(dst.data[i]).toBeLessThanOrEqual(152);
    }
  });
});

// ---------------------------------------------------------------------------
// computeIntegralImage
// ---------------------------------------------------------------------------

describe('computeIntegralImage', () => {
  it('computes correct integral for a known 3x3 matrix', () => {
    // Image:
    // 1 2 3
    // 4 5 6
    // 7 8 9
    const w = 3, h = 3;
    const src = new Matrix(w, h, U8C1);
    src.data[0] = 1; src.data[1] = 2; src.data[2] = 3;
    src.data[3] = 4; src.data[4] = 5; src.data[5] = 6;
    src.data[6] = 7; src.data[7] = 8; src.data[8] = 9;

    const sumSize = (w + 1) * (h + 1);
    const dst_sum = new Int32Array(sumSize);

    computeIntegralImage(src, dst_sum);

    // Expected integral image (w+1 x h+1):
    // 0  0  0   0
    // 0  1  3   6
    // 0  5  12  21
    // 0  12 27  45
    expect(dst_sum[0]).toBe(0);
    expect(dst_sum[1]).toBe(0);
    expect(dst_sum[2]).toBe(0);
    expect(dst_sum[3]).toBe(0);
    // row 1
    expect(dst_sum[4]).toBe(0);   // (1,0) left border
    expect(dst_sum[5]).toBe(1);   // sum of [1]
    expect(dst_sum[6]).toBe(3);   // sum of [1,2]
    expect(dst_sum[7]).toBe(6);   // sum of [1,2,3]
    // row 2
    expect(dst_sum[8]).toBe(0);
    expect(dst_sum[9]).toBe(5);   // 1+4
    expect(dst_sum[10]).toBe(12); // 1+2+4+5
    expect(dst_sum[11]).toBe(21); // 1+2+3+4+5+6
    // row 3
    expect(dst_sum[12]).toBe(0);
    expect(dst_sum[13]).toBe(12); // 1+4+7
    expect(dst_sum[14]).toBe(27); // 1+2+4+5+7+8
    expect(dst_sum[15]).toBe(45); // sum of all
  });

  it('computes sum and sqsum together', () => {
    const w = 2, h = 2;
    const src = new Matrix(w, h, U8C1);
    src.data[0] = 1; src.data[1] = 2;
    src.data[2] = 3; src.data[3] = 4;

    const sumSize = (w + 1) * (h + 1);
    const dst_sum = new Int32Array(sumSize);
    const dst_sqsum = new Int32Array(sumSize);

    computeIntegralImage(src, dst_sum, dst_sqsum);

    // Total sum of all pixels: 1+2+3+4 = 10
    expect(dst_sum[8]).toBe(10);
    // Total sum of squares: 1+4+9+16 = 30
    expect(dst_sqsum[8]).toBe(30);
  });

  it('handles sqsum-only mode', () => {
    const w = 2, h = 2;
    const src = new Matrix(w, h, U8C1);
    src.data[0] = 2; src.data[1] = 3;
    src.data[2] = 4; src.data[3] = 5;

    const sumSize = (w + 1) * (h + 1);
    const dst_sqsum = new Int32Array(sumSize);

    computeIntegralImage(src, null, dst_sqsum);

    // Total: 4+9+16+25 = 54
    expect(dst_sqsum[8]).toBe(54);
  });
});

// ---------------------------------------------------------------------------
// warpAffine
// ---------------------------------------------------------------------------

describe('warpAffine', () => {
  it('identity transform preserves pixel values', () => {
    const w = 8, h = 8;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, U8C1);

    // Fill with a gradient pattern
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        src.data[y * w + x] = (y * w + x) * 3;
      }
    }

    // Identity affine: [1,0,0; 0,1,0; 0,0,1]
    const transform = new Matrix(3, 3, F32C1);
    transform.data[0] = 1; transform.data[1] = 0; transform.data[2] = 0;
    transform.data[3] = 0; transform.data[4] = 1; transform.data[5] = 0;
    transform.data[6] = 0; transform.data[7] = 0; transform.data[8] = 1;

    warpAffine(src, dst, transform, 0);

    // Interior pixels (not on the last row/col due to bilinear interpolation boundary)
    // should match the source exactly
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        expect(dst.data[y * w + x]).toBe(src.data[y * w + x]);
      }
    }
  });

  it('translation shifts pixels correctly', () => {
    const w = 16, h = 16;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, U8C1);

    // Fill the center region with a known value
    for (let y = 4; y < 12; y++) {
      for (let x = 4; x < 12; x++) {
        src.data[y * w + x] = 200;
      }
    }

    // Translate by (2, 3)
    const transform = new Matrix(3, 3, F32C1);
    transform.data[0] = 1; transform.data[1] = 0; transform.data[2] = -2;
    transform.data[3] = 0; transform.data[4] = 1; transform.data[5] = -3;
    transform.data[6] = 0; transform.data[7] = 0; transform.data[8] = 1;

    warpAffine(src, dst, transform, 0);

    // After translating source by (-2,-3), the pixel that was at (6,7) in src
    // should now appear at (6,7) in dst as the value from src(6+2, 7+3) = src(8,10)
    // Since src(8,10) = 200, dst(6,7) should be 200
    expect(dst.data[7 * w + 6]).toBe(200);

    // A pixel outside the translated region should be fillValue (0)
    expect(dst.data[0]).toBe(0);
  });

  it('90-degree rotation produces expected output', () => {
    const w = 16, h = 16;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, U8C1);

    // Place a bright block in the top-left quadrant
    for (let y = 2; y < 6; y++) {
      for (let x = 2; x < 6; x++) {
        src.data[y * w + x] = 255;
      }
    }

    // 90-degree CCW rotation about center: cos(90)=0, sin(90)=1
    // Transform: rotate about center (8,8)
    const cx = w / 2, cy = h / 2;
    const cosA = 0, sinA = 1; // 90 degrees
    const transform = new Matrix(3, 3, F32C1);
    transform.data[0] = cosA;
    transform.data[1] = -sinA;
    transform.data[2] = cx - cx * cosA + cy * sinA;
    transform.data[3] = sinA;
    transform.data[4] = cosA;
    transform.data[5] = cy - cx * sinA - cy * cosA;
    transform.data[6] = 0;
    transform.data[7] = 0;
    transform.data[8] = 1;

    warpAffine(src, dst, transform, 0);

    // After 90-degree CCW rotation about center, the top-left bright block
    // should move to the bottom-left region. Check that the original
    // top-left position is no longer bright.
    let topLeftBright = 0;
    for (let y = 2; y < 6; y++) {
      for (let x = 2; x < 6; x++) {
        if (dst.data[y * w + x] > 200) topLeftBright++;
      }
    }
    // Most of the block should have moved away
    expect(topLeftBright).toBeLessThan(4);

    // The rotated image should have some bright pixels elsewhere
    let totalBright = 0;
    for (let i = 0; i < w * h; i++) {
      if (dst.data[i] > 200) totalBright++;
    }
    expect(totalBright).toBeGreaterThan(0);
  });

  it('fills out-of-bounds pixels with fillValue', () => {
    const w = 8, h = 8;
    const src = new Matrix(w, h, U8C1);
    const dst = new Matrix(w, h, U8C1);

    // Fill entire source with 100
    for (let i = 0; i < w * h; i++) src.data[i] = 100;

    // Translate by large amount so most destination pixels are out of bounds
    const transform = new Matrix(3, 3, F32C1);
    transform.data[0] = 1; transform.data[1] = 0; transform.data[2] = -100;
    transform.data[3] = 0; transform.data[4] = 1; transform.data[5] = -100;
    transform.data[6] = 0; transform.data[7] = 0; transform.data[8] = 1;

    const fillVal = 42;
    warpAffine(src, dst, transform, fillVal);

    // All pixels should be the fill value since source is shifted far away
    for (let i = 0; i < w * h; i++) {
      expect(dst.data[i]).toBe(fillVal);
    }
  });
});
