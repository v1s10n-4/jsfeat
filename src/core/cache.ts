/**
 * BufferPool -- a linked-list pool of pre-allocated DataBuffer nodes.
 *
 * Ported from legacy/jsfeat_cache.js.
 */

import { DataBuffer } from './data';

// ---------------------------------------------------------------------------
// Pool node
// ---------------------------------------------------------------------------

/**
 * A node in the {@link BufferPool} linked list.
 *
 * Each node wraps a {@link DataBuffer} and exposes convenience views.
 */
export class PoolNode {
  /** Link to the next node in the pool (null if tail). */
  next: PoolNode | null = null;
  /** The underlying DataBuffer. */
  data: DataBuffer;

  /** Usable size in bytes. */
  size: number;
  /** Raw ArrayBuffer. */
  buffer: ArrayBuffer;
  /** Uint8 view. */
  u8: Uint8Array;
  /** Int32 view. */
  i32: Int32Array;
  /** Float32 view. */
  f32: Float32Array;
  /** Float64 view. */
  f64: Float64Array;

  /**
   * Create a new PoolNode.
   *
   * @param sizeInBytes - Initial buffer size (aligned to 8 bytes).
   */
  constructor(sizeInBytes: number) {
    this.data   = new DataBuffer(sizeInBytes);
    this.size   = this.data.size;
    this.buffer = this.data.buffer;
    this.u8     = this.data.u8;
    this.i32    = this.data.i32;
    this.f32    = this.data.f32;
    this.f64    = this.data.f64;
  }

  /**
   * Replace the internal DataBuffer and update all convenience views.
   *
   * @param sizeInBytes - New buffer size.
   */
  resize(sizeInBytes: number): void {
    this.data   = new DataBuffer(sizeInBytes);
    this.size   = this.data.size;
    this.buffer = this.data.buffer;
    this.u8     = this.data.u8;
    this.i32    = this.data.i32;
    this.f32    = this.data.f32;
    this.f64    = this.data.f64;
  }
}

// ---------------------------------------------------------------------------
// Buffer pool
// ---------------------------------------------------------------------------

/**
 * A pool of reusable {@link PoolNode} buffers managed as a linked list.
 *
 * Buffers are popped from the head and returned to the tail,
 * providing O(1) allocation without GC pressure.
 */
export class BufferPool {
  private _head: PoolNode;
  private _tail: PoolNode;

  /**
   * Create a new BufferPool.
   *
   * @param capacity - Number of additional nodes (total = capacity + 1).
   * @param dataSize - Initial byte-size for each node's DataBuffer.
   */
  constructor(capacity: number, dataSize: number) {
    this._head = new PoolNode(dataSize);
    this._tail = this._head;

    for (let i = 0; i < capacity; ++i) {
      const node = new PoolNode(dataSize);
      this._tail.next = node;
      this._tail = node;
    }
  }

  /**
   * Pop a node from the head of the pool. If `sizeInBytes` exceeds the
   * node's current size the node is resized first.
   *
   * @param sizeInBytes - Minimum required size in bytes.
   * @returns A PoolNode with at least the requested capacity.
   */
  get(sizeInBytes: number): PoolNode {
    const node = this._head;
    this._head = this._head.next!;

    if (sizeInBytes > node.size) {
      node.resize(sizeInBytes);
    }

    return node;
  }

  /**
   * Return a node to the tail of the pool.
   *
   * @param node - The node to release back to the pool.
   */
  release(node: PoolNode): void {
    this._tail.next = node;
    this._tail = node;
    node.next = null;
  }
}

// ---------------------------------------------------------------------------
// Default singleton (matches legacy: 30 buffers, 640*4 bytes each)
// ---------------------------------------------------------------------------

/** Default shared buffer pool (31 nodes, 2560 bytes each). */
export const pool = new BufferPool(30, 640 * 4);
