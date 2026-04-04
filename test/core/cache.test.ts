import { describe, it, expect } from 'vitest';
import { BufferPool, PoolNode, pool } from '../../src/core/cache';

describe('PoolNode', () => {
  it('has typed-array views matching its DataBuffer', () => {
    const n = new PoolNode(64);
    expect(n.u8).toBeInstanceOf(Uint8Array);
    expect(n.i32).toBeInstanceOf(Int32Array);
    expect(n.f32).toBeInstanceOf(Float32Array);
    expect(n.f64).toBeInstanceOf(Float64Array);
    expect(n.buffer).toBe(n.data.buffer);
    expect(n.size).toBe(n.data.size);
  });

  it('resize replaces the data and updates views', () => {
    const n       = new PoolNode(16);
    const oldBuf  = n.buffer;
    n.resize(128);
    expect(n.size).toBeGreaterThanOrEqual(128);
    expect(n.buffer).not.toBe(oldBuf);
    expect(n.u8.buffer).toBe(n.buffer);
  });
});

describe('BufferPool', () => {
  it('get returns a PoolNode', () => {
    const bp   = new BufferPool(5, 32);
    const node = bp.get(16);
    expect(node).toBeInstanceOf(PoolNode);
  });

  it('get resizes the node when requested size exceeds current', () => {
    const bp   = new BufferPool(3, 16);
    const node = bp.get(256);
    expect(node.size).toBeGreaterThanOrEqual(256);
  });

  it('get does NOT resize when requested size fits', () => {
    const bp   = new BufferPool(3, 128);
    const node = bp.get(64);
    expect(node.size).toBe(128); // keeps original aligned size
  });

  it('release returns a node so it can be obtained again', () => {
    const bp = new BufferPool(2, 32);     // 3 nodes total: n0 -> n1 -> n2
    const a  = bp.get(16);               // pops n0; head = n1
    bp.release(a);                        // pushes a (n0) to tail: n1 -> n2 -> n0
    const _b = bp.get(16);               // pops n1
    const _c = bp.get(16);               // pops n2
    const d  = bp.get(16);               // pops n0 (a)
    expect(d).toBe(a);
    bp.release(_b);
    bp.release(_c);
    bp.release(d);
  });

  it('multiple get/release cycles work', () => {
    const bp = new BufferPool(4, 32);

    // Get two, release two, repeat several times
    for (let cycle = 0; cycle < 3; cycle++) {
      const a = bp.get(16);
      const b = bp.get(16);
      expect(a).toBeInstanceOf(PoolNode);
      expect(b).toBeInstanceOf(PoolNode);
      bp.release(a);
      bp.release(b);
    }
  });
});

describe('default pool singleton', () => {
  it('is a BufferPool instance', () => {
    expect(pool).toBeInstanceOf(BufferPool);
  });

  it('can get and release a node', () => {
    const node = pool.get(64);
    expect(node).toBeInstanceOf(PoolNode);
    pool.release(node);
  });
});
