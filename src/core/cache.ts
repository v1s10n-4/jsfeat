/**
 * BufferPool -- a linked-list pool of pre-allocated DataBuffer nodes.
 *
 * Ported from legacy/jsfeat_cache.js.
 */

import { DataBuffer } from './data';

// ---------------------------------------------------------------------------
// Pool node
// ---------------------------------------------------------------------------

export class PoolNode {
  next: PoolNode | null = null;
  data: DataBuffer;

  size: number;
  buffer: ArrayBuffer;
  u8: Uint8Array;
  i32: Int32Array;
  f32: Float32Array;
  f64: Float64Array;

  constructor(sizeInBytes: number) {
    this.data   = new DataBuffer(sizeInBytes);
    this.size   = this.data.size;
    this.buffer = this.data.buffer;
    this.u8     = this.data.u8;
    this.i32    = this.data.i32;
    this.f32    = this.data.f32;
    this.f64    = this.data.f64;
  }

  /** Replace the internal DataBuffer and update all convenience views. */
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

export class BufferPool {
  private _head: PoolNode;
  private _tail: PoolNode;

  /**
   * @param capacity  Number of additional nodes (total = capacity + 1).
   * @param dataSize  Initial byte-size for each node's DataBuffer.
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
   * Pop a node from the head of the pool.  If `sizeInBytes` exceeds the
   * node's current size the node is resized first.
   */
  get(sizeInBytes: number): PoolNode {
    const node = this._head;
    this._head = this._head.next!;

    if (sizeInBytes > node.size) {
      node.resize(sizeInBytes);
    }

    return node;
  }

  /** Return a node to the tail of the pool. */
  release(node: PoolNode): void {
    this._tail.next = node;
    this._tail = node;
    node.next = null;
  }
}

// ---------------------------------------------------------------------------
// Default singleton (matches legacy: 30 buffers, 640*4 bytes each)
// ---------------------------------------------------------------------------

export const pool = new BufferPool(30, 640 * 4);
