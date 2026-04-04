/**
 * DataBuffer -- a byte-aligned buffer with multiple typed-array views.
 *
 * Ported from `data_t` in legacy/jsfeat_struct.js (lines 58-74).
 */

export class DataBuffer {
  /** Usable size in bytes (aligned to multiple of 8). */
  size: number;
  /** Underlying raw buffer. */
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
   * @param sizeInBytes  Requested size (will be aligned up to multiple of 8).
   * @param buffer       Optional pre-existing ArrayBuffer to wrap.
   */
  constructor(sizeInBytes: number, buffer?: ArrayBuffer) {
    // Align size to next multiple of 8
    this.size = ((sizeInBytes + 7) | 0) & -8;

    if (buffer !== undefined) {
      this.buffer = buffer;
      this.size = buffer.byteLength;
    } else {
      this.buffer = new ArrayBuffer(this.size);
    }

    this.u8  = new Uint8Array(this.buffer);
    this.i32 = new Int32Array(this.buffer);
    this.f32 = new Float32Array(this.buffer);
    this.f64 = new Float64Array(this.buffer);
  }
}
