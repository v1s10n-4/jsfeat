import { describe, it, expect } from 'vitest';
import { Matrix } from '../../src/core/matrix';
import { DataBuffer } from '../../src/core/data';
import {
  DataType, Channel,
  U8C1, U8C3, U8C4,
  F32C1, F32C2,
  S32C1, S32C2,
} from '../../src/core/types';

describe('Matrix', () => {
  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  it('stores cols, rows, type, and channel', () => {
    const m = new Matrix(10, 20, U8C1);
    expect(m.cols).toBe(10);
    expect(m.rows).toBe(20);
    expect(m.type).toBe(DataType.U8);
    expect(m.channel).toBe(Channel.C1);
  });

  it('auto-allocates when no DataBuffer is provided', () => {
    const m = new Matrix(4, 4, U8C1);
    expect(m.buffer).toBeInstanceOf(DataBuffer);
    expect(m.data).toBeInstanceOf(Uint8Array);
    expect(m.data.length).toBeGreaterThanOrEqual(16);
  });

  it('uses an external DataBuffer when provided', () => {
    const buf = new DataBuffer(64);
    const m   = new Matrix(4, 4, U8C1, buf);
    expect(m.buffer).toBe(buf);
  });

  // -----------------------------------------------------------------------
  // Data-type view selection
  // -----------------------------------------------------------------------

  it('selects Uint8Array for U8 types', () => {
    const m = new Matrix(2, 2, U8C1);
    expect(m.data).toBeInstanceOf(Uint8Array);
  });

  it('selects Int32Array for S32 types', () => {
    const m = new Matrix(2, 2, S32C1);
    expect(m.data).toBeInstanceOf(Int32Array);
  });

  it('selects Float32Array for F32 types', () => {
    const m = new Matrix(2, 2, F32C1);
    expect(m.data).toBeInstanceOf(Float32Array);
  });

  it('selects Float64Array for F64 types', () => {
    const m = new Matrix(2, 2, DataType.F64 | Channel.C1);
    expect(m.data).toBeInstanceOf(Float64Array);
  });

  // -----------------------------------------------------------------------
  // allocate
  // -----------------------------------------------------------------------

  it('allocate replaces the buffer', () => {
    const m    = new Matrix(4, 4, U8C1);
    const old  = m.buffer;
    m.cols = 8;
    m.rows = 8;
    m.allocate();
    expect(m.buffer).not.toBe(old);
  });

  // -----------------------------------------------------------------------
  // copyTo
  // -----------------------------------------------------------------------

  it('copies data element-by-element', () => {
    const a = new Matrix(3, 3, U8C1);
    const b = new Matrix(3, 3, U8C1);
    for (let i = 0; i < 9; i++) a.data[i] = i + 1;
    a.copyTo(b);
    for (let i = 0; i < 9; i++) {
      expect(b.data[i]).toBe(i + 1);
    }
  });

  it('copyTo works for multi-channel matrices', () => {
    const a = new Matrix(2, 2, U8C3);
    const b = new Matrix(2, 2, U8C3);
    const n = 2 * 2 * 3;
    for (let i = 0; i < n; i++) a.data[i] = i;
    a.copyTo(b);
    for (let i = 0; i < n; i++) {
      expect(b.data[i]).toBe(i);
    }
  });

  // -----------------------------------------------------------------------
  // resize
  // -----------------------------------------------------------------------

  it('resize within buffer does not reallocate', () => {
    const m   = new Matrix(10, 10, U8C1);
    const buf = m.buffer;
    m.resize(5, 5);
    expect(m.buffer).toBe(buf);
    expect(m.cols).toBe(5);
    expect(m.rows).toBe(5);
  });

  it('resize beyond buffer reallocates', () => {
    const m   = new Matrix(4, 4, U8C1);
    const buf = m.buffer;
    m.resize(100, 100);
    expect(m.buffer).not.toBe(buf);
    expect(m.cols).toBe(100);
    expect(m.rows).toBe(100);
  });

  it('resize preserves channel when not provided', () => {
    const m = new Matrix(4, 4, U8C3);
    m.resize(8, 8);
    expect(m.channel).toBe(Channel.C3);
  });

  it('resize accepts a new channel count', () => {
    const m = new Matrix(4, 4, U8C1);
    m.resize(4, 4, Channel.C4);
    expect(m.channel).toBe(Channel.C4);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('1x1 matrix works correctly', () => {
    const m = new Matrix(1, 1, F32C1);
    m.data[0] = 42.5;
    expect(m.data[0]).toBeCloseTo(42.5);
  });

  it('handles F32C2 correctly', () => {
    const m = new Matrix(3, 3, F32C2);
    expect(m.data).toBeInstanceOf(Float32Array);
    expect(m.channel).toBe(Channel.C2);
    expect(m.data.length).toBeGreaterThanOrEqual(3 * 3 * 2);
  });

  it('handles S32C2 correctly', () => {
    const m = new Matrix(3, 3, S32C2);
    expect(m.data).toBeInstanceOf(Int32Array);
    expect(m.channel).toBe(Channel.C2);
  });
});
