import { describe, it, expect } from 'vitest';
import { Keypoint } from '../../src/core/keypoint';

describe('Keypoint', () => {
  it('has correct defaults', () => {
    const kp = new Keypoint();
    expect(kp.x).toBe(0);
    expect(kp.y).toBe(0);
    expect(kp.score).toBe(0);
    expect(kp.level).toBe(0);
    expect(kp.angle).toBe(-1.0);
  });

  it('accepts custom values', () => {
    const kp = new Keypoint(10, 20, 0.95, 3, 1.5);
    expect(kp.x).toBe(10);
    expect(kp.y).toBe(20);
    expect(kp.score).toBe(0.95);
    expect(kp.level).toBe(3);
    expect(kp.angle).toBe(1.5);
  });

  it('partial arguments use defaults for the rest', () => {
    const kp = new Keypoint(5, 10);
    expect(kp.x).toBe(5);
    expect(kp.y).toBe(10);
    expect(kp.score).toBe(0);
    expect(kp.level).toBe(0);
    expect(kp.angle).toBe(-1.0);
  });

  it('properties are mutable', () => {
    const kp = new Keypoint();
    kp.x     = 100;
    kp.score = 0.5;
    expect(kp.x).toBe(100);
    expect(kp.score).toBe(0.5);
  });
});
