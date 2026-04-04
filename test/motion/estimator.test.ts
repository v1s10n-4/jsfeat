import { describe, it, expect } from 'vitest';
import { ransac, lmeds, createRansacParams } from '../../src/motion/estimator';
import { homography2d, affine2d } from '../../src/motion/models';
import { Matrix } from '../../src/core/matrix';
import { F32C1 } from '../../src/core/types';

describe('motion estimation', () => {
  describe('ransac with homography2d', () => {
    it('should recover a small translation transform', () => {
      // Use a small known translation rather than identity
      // (identity is degenerate for the eigenvalue-based homography solver)
      const from = [
        { x: 10, y: 20 },
        { x: 110, y: 20 },
        { x: 110, y: 120 },
        { x: 10, y: 120 },
        { x: 60, y: 70 },
        { x: 30, y: 90 },
        { x: 80, y: 40 },
        { x: 50, y: 110 },
      ];
      // Apply a small translation: +5, +3
      const to = from.map(p => ({ x: p.x + 5, y: p.y + 3 }));

      const model = new Matrix(3, 3, F32C1);
      const mask = new Matrix(from.length, 1, F32C1);
      const params = createRansacParams(4, 3, 0.5, 0.99);

      const ok = ransac(params, homography2d, from, to, from.length, model, mask, 1000);
      expect(ok).toBe(true);

      // The resulting model should apply the translation
      // For a pure translation H ≈ [[1,0,tx],[0,1,ty],[0,0,1]]
      const md = model.data;
      // Check that the transform maps a test point correctly
      const testPt = from[0];
      const ww = 1.0 / ((md[6] as number) * testPt.x + (md[7] as number) * testPt.y + (md[8] as number));
      const mappedX = ((md[0] as number) * testPt.x + (md[1] as number) * testPt.y + (md[2] as number)) * ww;
      const mappedY = ((md[3] as number) * testPt.x + (md[4] as number) * testPt.y + (md[5] as number)) * ww;
      expect(mappedX).toBeCloseTo(testPt.x + 5, 0);
      expect(mappedY).toBeCloseTo(testPt.y + 3, 0);
    });

    it('should return true for valid input', () => {
      const from = [
        { x: 10, y: 20 },
        { x: 100, y: 20 },
        { x: 100, y: 120 },
        { x: 10, y: 120 },
        { x: 55, y: 70 },
      ];
      // Small translation
      const to = from.map(p => ({ x: p.x + 5, y: p.y + 3 }));

      const model = new Matrix(3, 3, F32C1);
      const params = createRansacParams(4, 10, 0.5, 0.99);

      const ok = ransac(params, homography2d, from, to, from.length, model, null, 1000);
      expect(ok).toBe(true);
    });

    it('should return false if too few points', () => {
      const from = [{ x: 0, y: 0 }];
      const to = [{ x: 1, y: 1 }];
      const model = new Matrix(3, 3, F32C1);
      const params = createRansacParams(4, 3, 0.5, 0.99);

      const ok = ransac(params, homography2d, from, to, 1, model, null);
      expect(ok).toBe(false);
    });
  });

  describe('ransac with affine2d', () => {
    it('should recover identity-like transform for identical point pairs', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 50, y: 50 },
      ];
      const from = pts.slice();
      const to = pts.slice();

      const model = new Matrix(3, 3, F32C1);
      const params = createRansacParams(3, 3, 0.5, 0.99);

      const ok = ransac(params, affine2d, from, to, pts.length, model, null, 1000);
      expect(ok).toBe(true);

      // Should be near identity
      const md = model.data;
      expect(md[0]).toBeCloseTo(1, 0);
      expect(md[4]).toBeCloseTo(1, 0);
    });
  });

  describe('lmeds', () => {
    it('should return false if too few points', () => {
      const from = [{ x: 0, y: 0 }];
      const to = [{ x: 1, y: 1 }];
      const model = new Matrix(3, 3, F32C1);
      const params = createRansacParams(4, 3, 0.5, 0.99);

      const ok = lmeds(params, homography2d, from, to, 1, model, null);
      expect(ok).toBe(false);
    });
  });

  describe('createRansacParams', () => {
    it('should create params with defaults', () => {
      const p = createRansacParams();
      expect(p.size).toBe(0);
      expect(p.thresh).toBe(0.5);
      expect(p.eps).toBe(0.5);
      expect(p.prob).toBe(0.99);
    });

    it('should create params with custom values', () => {
      const p = createRansacParams(4, 3.0, 0.3, 0.95);
      expect(p.size).toBe(4);
      expect(p.thresh).toBe(3.0);
      expect(p.eps).toBe(0.3);
      expect(p.prob).toBe(0.95);
    });
  });
});
