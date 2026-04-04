import { describe, it, expect } from 'vitest';
import {
  affine3PointTransform,
  perspective4PointTransformArray,
  invertAffineTransform,
  invertPerspectiveTransform,
} from '../../src/transform/transform';

describe('transform', () => {
  describe('affine3PointTransform', () => {
    it('should produce identity-like model when src and dst points are the same', () => {
      const model = new Float64Array(6);
      affine3PointTransform(
        model,
        0, 0, 0, 0,
        100, 0, 100, 0,
        0, 100, 0, 100,
      );
      // Should be identity: a=1, b=0, tx=0, c=0, d=1, ty=0
      expect(model[0]).toBeCloseTo(1, 10);
      expect(model[1]).toBeCloseTo(0, 10);
      expect(model[2]).toBeCloseTo(0, 10);
      expect(model[3]).toBeCloseTo(0, 10);
      expect(model[4]).toBeCloseTo(1, 10);
      expect(model[5]).toBeCloseTo(0, 10);
    });

    it('should produce a translation model', () => {
      const model = new Float64Array(6);
      const tx = 5, ty = 10;
      affine3PointTransform(
        model,
        0, 0, tx, ty,
        100, 0, 100 + tx, ty,
        0, 100, tx, 100 + ty,
      );
      expect(model[0]).toBeCloseTo(1, 10);
      expect(model[1]).toBeCloseTo(0, 10);
      expect(model[2]).toBeCloseTo(tx, 10);
      expect(model[3]).toBeCloseTo(0, 10);
      expect(model[4]).toBeCloseTo(1, 10);
      expect(model[5]).toBeCloseTo(ty, 10);
    });
  });

  describe('perspective4PointTransformArray', () => {
    it('should produce identity-like model when src and dst points are the same', () => {
      const mat = new Float64Array(9);
      perspective4PointTransformArray(
        mat,
        0, 0, 0, 0,
        100, 0, 100, 0,
        100, 100, 100, 100,
        0, 100, 0, 100,
      );
      // Should be close to identity (possibly scaled)
      // Normalize by mat[8]
      const s = 1.0 / mat[8];
      expect(mat[0] * s).toBeCloseTo(1, 5);
      expect(mat[4] * s).toBeCloseTo(1, 5);
      expect(mat[1] * s).toBeCloseTo(0, 5);
      expect(mat[3] * s).toBeCloseTo(0, 5);
    });
  });

  describe('invertAffineTransform', () => {
    it('should invert an affine transform', () => {
      // Translation: tx=5, ty=10
      const src = [1, 0, 5, 0, 1, 10];
      const dst = new Array(6);
      invertAffineTransform(src, dst);
      // Inverse of translation(5,10) is translation(-5,-10)
      expect(dst[0]).toBeCloseTo(1, 10);
      expect(dst[1]).toBeCloseTo(0, 10);
      expect(dst[2]).toBeCloseTo(-5, 10);
      expect(dst[3]).toBeCloseTo(0, 10);
      expect(dst[4]).toBeCloseTo(1, 10);
      expect(dst[5]).toBeCloseTo(-10, 10);
    });

    it('should satisfy invertibility: invert(invert(T)) ≈ T', () => {
      // A non-trivial affine: scale + rotation + translation
      const original = [2, -0.5, 3, 0.5, 2, -1];
      const inv = new Array(6);
      const restored = new Array(6);
      invertAffineTransform(original, inv);
      invertAffineTransform(inv, restored);
      for (let i = 0; i < 6; i++) {
        expect(restored[i]).toBeCloseTo(original[i], 10);
      }
    });
  });

  describe('invertPerspectiveTransform', () => {
    it('should invert a perspective transform', () => {
      // Identity
      const src = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      const dst = new Array(9);
      invertPerspectiveTransform(src, dst);
      expect(dst[0]).toBeCloseTo(1, 10);
      expect(dst[4]).toBeCloseTo(1, 10);
      expect(dst[8]).toBeCloseTo(1, 10);
      expect(dst[1]).toBeCloseTo(0, 10);
      expect(dst[3]).toBeCloseTo(0, 10);
    });

    it('should satisfy invertibility: invert(invert(T)) ≈ T', () => {
      // A non-trivial perspective matrix
      const original = [1.5, 0.2, 10, -0.1, 1.3, 5, 0.001, -0.002, 1];
      const inv = new Array(9);
      const restored = new Array(9);
      invertPerspectiveTransform(original, inv);
      invertPerspectiveTransform(inv, restored);
      for (let i = 0; i < 9; i++) {
        expect(restored[i]).toBeCloseTo(original[i], 8);
      }
    });
  });
});
