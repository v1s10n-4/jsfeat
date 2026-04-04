import { describe, it, expect } from 'vitest';
import { bbfPrepareCascade, bbfBuildPyramid, bbfDetect, bbfGroupRectangles } from '../../src/detect/bbf';

describe('bbf', () => {
  describe('bbfPrepareCascade', () => {
    it('should be a function', () => {
      expect(typeof bbfPrepareCascade).toBe('function');
    });

    it('should prepare cascade by creating _feature arrays', () => {
      const cascade = {
        stage_classifier: [
          {
            count: 2,
            feature: [
              { size: 3, px: [0, 1, 2], py: [0, 1, 2], pz: [0, 0, 0], nx: [0, 1, 2], ny: [0, 1, 2], nz: [0, 0, 0] },
              { size: 2, px: [0, 1], py: [0, 1], pz: [0, 0], nx: [0, 1], ny: [0, 1], nz: [0, 0] },
            ],
          },
        ],
      };
      bbfPrepareCascade(cascade);
      expect(cascade.stage_classifier[0]._feature).toBeDefined();
      expect(cascade.stage_classifier[0]._feature.length).toBe(2);
      expect(cascade.stage_classifier[0]._feature[0].size).toBe(3);
      expect(cascade.stage_classifier[0]._feature[0].px.length).toBe(3);
      expect(cascade.stage_classifier[0]._feature[1].size).toBe(2);
    });
  });

  describe('bbfGroupRectangles', () => {
    it('should group overlapping rectangles', () => {
      const rects = [
        { x: 10, y: 10, width: 40, height: 40, neighbor: 1, confidence: 1.0 },
        { x: 12, y: 11, width: 40, height: 40, neighbor: 1, confidence: 1.2 },
        { x: 11, y: 10, width: 40, height: 40, neighbor: 1, confidence: 0.9 },
      ];
      const grouped = bbfGroupRectangles(rects, 1);
      expect(grouped.length).toBeLessThanOrEqual(rects.length);
      expect(grouped.length).toBe(1);
    });

    it('should return empty array for empty input', () => {
      const grouped = bbfGroupRectangles([], 1);
      expect(grouped).toEqual([]);
    });
  });

  describe('exports', () => {
    it('should export bbfBuildPyramid', () => {
      expect(typeof bbfBuildPyramid).toBe('function');
    });

    it('should export bbfDetect', () => {
      expect(typeof bbfDetect).toBe('function');
    });
  });
});
