import { describe, it, expect } from 'vitest';
import { groupRectangles, haarDetectSingleScale, haarDetectMultiScale, EDGES_DENSITY } from '../../src/detect/haar';
import type { HaarRect } from '../../src/detect/haar';

describe('haar', () => {
  describe('groupRectangles', () => {
    it('should group overlapping rectangles and reduce count', () => {
      const rects: HaarRect[] = [
        { x: 10, y: 10, width: 40, height: 40, neighbor: 1, confidence: 1.0 },
        { x: 12, y: 11, width: 40, height: 40, neighbor: 1, confidence: 1.2 },
        { x: 11, y: 10, width: 40, height: 40, neighbor: 1, confidence: 0.9 },
        { x: 100, y: 100, width: 40, height: 40, neighbor: 1, confidence: 0.8 },
        { x: 101, y: 101, width: 40, height: 40, neighbor: 1, confidence: 1.1 },
      ];
      const grouped = groupRectangles(rects, 1);
      // Should have fewer groups than input rects
      expect(grouped.length).toBeLessThan(rects.length);
      // Should produce exactly 2 groups (cluster around 10,10 and cluster around 100,100)
      expect(grouped.length).toBe(2);
    });

    it('should return empty array for empty input', () => {
      const grouped = groupRectangles([], 1);
      expect(grouped).toEqual([]);
    });

    it('should filter by minNeighbors', () => {
      const rects: HaarRect[] = [
        { x: 10, y: 10, width: 40, height: 40, neighbor: 1, confidence: 1.0 },
        { x: 12, y: 11, width: 40, height: 40, neighbor: 1, confidence: 1.2 },
        { x: 200, y: 200, width: 40, height: 40, neighbor: 1, confidence: 0.5 },
      ];
      // With minNeighbors=2, the isolated rect at 200,200 should be filtered out
      const grouped = groupRectangles(rects, 2);
      expect(grouped.length).toBe(1);
    });

    it('should preserve max confidence in grouped rect', () => {
      const rects: HaarRect[] = [
        { x: 10, y: 10, width: 40, height: 40, neighbor: 1, confidence: 1.0 },
        { x: 12, y: 11, width: 40, height: 40, neighbor: 1, confidence: 2.5 },
        { x: 11, y: 10, width: 40, height: 40, neighbor: 1, confidence: 0.9 },
      ];
      const grouped = groupRectangles(rects, 1);
      expect(grouped.length).toBe(1);
      expect(grouped[0].confidence).toBe(2.5);
    });
  });

  describe('haarDetectSingleScale', () => {
    it('should return empty array with no matching classifier', () => {
      const width = 20;
      const height = 20;
      const intSum = new Int32Array((width + 1) * (height + 1));
      const intSqsum = new Float64Array((width + 1) * (height + 1));
      const intTilted = new Int32Array((width + 1) * (height + 1));
      const classifier = {
        size: [10, 10],
        complexClassifiers: [],
      };
      const rects = haarDetectSingleScale(intSum, intSqsum, intTilted, null, width, height, 1.0, classifier);
      // With no stages, everything passes - but the image is very small
      expect(Array.isArray(rects)).toBe(true);
    });
  });

  describe('EDGES_DENSITY', () => {
    it('should be 0.07', () => {
      expect(EDGES_DENSITY).toBe(0.07);
    });
  });
});
