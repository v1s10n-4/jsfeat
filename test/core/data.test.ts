import { describe, it, expect } from 'vitest';
import { DataBuffer } from '../../src/core/data';

describe('DataBuffer', () => {
  it('aligns size up to a multiple of 8', () => {
    expect(new DataBuffer(1).size).toBe(8);
    expect(new DataBuffer(7).size).toBe(8);
    expect(new DataBuffer(8).size).toBe(8);
    expect(new DataBuffer(9).size).toBe(16);
    expect(new DataBuffer(15).size).toBe(16);
    expect(new DataBuffer(16).size).toBe(16);
  });

  it('size 0 produces an 8-byte aligned buffer', () => {
    const d = new DataBuffer(0);
    // (0 + 7) | 0 = 7;  7 & -8 = 0  -- but that would be empty
    expect(d.size).toBe(0);
    expect(d.buffer.byteLength).toBe(0);
  });

  it('creates all four typed-array views over the same ArrayBuffer', () => {
    const d = new DataBuffer(16);
    expect(d.u8.buffer).toBe(d.buffer);
    expect(d.i32.buffer).toBe(d.buffer);
    expect(d.f32.buffer).toBe(d.buffer);
    expect(d.f64.buffer).toBe(d.buffer);
  });

  it('views have consistent byte lengths', () => {
    const d = new DataBuffer(32);
    expect(d.u8.byteLength).toBe(32);
    expect(d.i32.byteLength).toBe(32);
    expect(d.f32.byteLength).toBe(32);
    expect(d.f64.byteLength).toBe(32);
  });

  it('accepts an external ArrayBuffer', () => {
    const ab = new ArrayBuffer(64);
    const d  = new DataBuffer(0, ab);
    expect(d.buffer).toBe(ab);
    expect(d.size).toBe(64);
    expect(d.u8.length).toBe(64);
  });

  it('writing through one view is visible through another', () => {
    const d = new DataBuffer(16);
    d.u8[0] = 1;
    // i32 should see it (little-endian on most platforms)
    expect(d.i32[0]).not.toBe(0); // at least non-zero
  });
});
