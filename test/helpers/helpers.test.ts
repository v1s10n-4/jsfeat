import { describe, it, expect } from 'vitest';
import { expectMatricesClose, expectArrayClose } from './comparison';
import {
  filled,
  horizontalGradient,
  checkerboard,
  square,
  rgbaFromGray,
} from './synthetic';
import { Matrix } from '../../src/core/matrix';
import { U8C1, U8C3, F32C1, Channel } from '../../src/core/types';

// ---------------------------------------------------------------------------
// comparison helpers
// ---------------------------------------------------------------------------

describe('expectArrayClose', () => {
  it('passes for identical arrays', () => {
    expectArrayClose([1, 2, 3], [1, 2, 3]);
  });

  it('passes within epsilon', () => {
    expectArrayClose([1.0], [1.0000001], 1e-6);
  });

  it('fails when difference exceeds epsilon', () => {
    expect(() => expectArrayClose([1.0], [2.0], 1e-6)).toThrow();
  });

  it('fails for different lengths', () => {
    expect(() => expectArrayClose([1], [1, 2])).toThrow();
  });
});

describe('expectMatricesClose', () => {
  it('passes for identical matrices', () => {
    const a = filled(3, 3, 42);
    const b = filled(3, 3, 42);
    expectMatricesClose(a, b);
  });

  it('fails for matrices with different values', () => {
    const a = filled(2, 2, 0);
    const b = filled(2, 2, 100);
    expect(() => expectMatricesClose(a, b)).toThrow();
  });

  it('fails for matrices with different dimensions', () => {
    const a = filled(2, 3, 0);
    const b = filled(3, 2, 0);
    expect(() => expectMatricesClose(a, b)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// synthetic image generators
// ---------------------------------------------------------------------------

describe('filled', () => {
  it('creates a matrix of the requested size filled with the given value', () => {
    const m = filled(5, 3, 128);
    expect(m.cols).toBe(5);
    expect(m.rows).toBe(3);
    for (let i = 0; i < 15; i++) {
      expect(m.data[i]).toBe(128);
    }
  });

  it('works with non-default type', () => {
    const m = filled(2, 2, 7.5, F32C1);
    expect(m.data).toBeInstanceOf(Float32Array);
    expect(m.data[0]).toBeCloseTo(7.5);
  });

  it('works with multi-channel type', () => {
    const m = filled(2, 2, 100, U8C3);
    expect(m.channel).toBe(Channel.C3);
    const n = 2 * 2 * 3;
    for (let i = 0; i < n; i++) {
      expect(m.data[i]).toBe(100);
    }
  });
});

describe('horizontalGradient', () => {
  it('left edge is 0, right edge is 255', () => {
    const m = horizontalGradient(256, 1);
    expect(m.data[0]).toBe(0);
    expect(m.data[255]).toBe(255);
  });

  it('values increase left to right', () => {
    const m = horizontalGradient(10, 1);
    for (let c = 1; c < 10; c++) {
      expect(m.data[c]).toBeGreaterThanOrEqual(m.data[c - 1]);
    }
  });

  it('handles 1-pixel wide image', () => {
    const m = horizontalGradient(1, 1);
    expect(m.data[0]).toBe(0);
  });
});

describe('checkerboard', () => {
  it('alternates between 255 and 0', () => {
    const m = checkerboard(4, 4, 2);
    // top-left 2x2 block should be 255
    expect(m.data[0]).toBe(255);
    expect(m.data[1]).toBe(255);
    expect(m.data[4]).toBe(255);
    expect(m.data[5]).toBe(255);
    // next block to the right should be 0
    expect(m.data[2]).toBe(0);
    expect(m.data[3]).toBe(0);
  });

  it('1x1 block size gives pixel checkerboard', () => {
    const m = checkerboard(3, 3, 1);
    expect(m.data[0]).toBe(255); // (0,0)
    expect(m.data[1]).toBe(0);   // (1,0)
    expect(m.data[2]).toBe(255); // (2,0)
    expect(m.data[3]).toBe(0);   // (0,1)
    expect(m.data[4]).toBe(255); // (1,1)
  });
});

describe('square', () => {
  it('places a white square on a black background', () => {
    const m = square(10, 10, 2, 3, 4);
    // Outside the square
    expect(m.data[0]).toBe(0);
    // Inside the square: row 3, col 2  --> index 3*10+2 = 32
    expect(m.data[32]).toBe(255);
    // row 6, col 5  --> index 6*10+5 = 65
    expect(m.data[65]).toBe(255);
    // row 7 is outside (y+size = 7)  --> index 7*10+2 = 72
    expect(m.data[72]).toBe(0);
  });

  it('clips to image bounds', () => {
    const m = square(5, 5, 3, 3, 10);
    // Bottom-right corner should be white
    expect(m.data[4 * 5 + 4]).toBe(255);
    // top-left should be black
    expect(m.data[0]).toBe(0);
  });
});

describe('rgbaFromGray', () => {
  it('converts gray to RGBA with full alpha', () => {
    const g    = filled(2, 2, 128);
    const rgba = rgbaFromGray(g);
    expect(rgba).toBeInstanceOf(Uint8ClampedArray);
    expect(rgba.length).toBe(16); // 2*2*4
    for (let i = 0; i < 4; i++) {
      expect(rgba[i * 4]).toBe(128);     // R
      expect(rgba[i * 4 + 1]).toBe(128); // G
      expect(rgba[i * 4 + 2]).toBe(128); // B
      expect(rgba[i * 4 + 3]).toBe(255); // A
    }
  });

  it('throws for multi-channel input', () => {
    const m = new Matrix(2, 2, U8C3);
    expect(() => rgbaFromGray(m)).toThrow('single-channel');
  });
});
