/**
 * Matrix -- the primary 2-D data structure used throughout jsfeat.
 *
 * Ported from `matrix_t` in legacy/jsfeat_struct.js (lines 76-129).
 */

import { DataBuffer } from './data';
import { DataType, getChannel, getDataType, getDataTypeSize, type TypedArrayUnion } from './types';

export class Matrix {
  /** Data-type flag (upper byte of the composite type). */
  type: number;
  /** Number of channels (lower byte of the composite type). */
  channel: number;
  /** Number of columns. */
  cols: number;
  /** Number of rows. */
  rows: number;
  /** Underlying DataBuffer. */
  buffer!: DataBuffer;
  /** Typed-array view into the buffer, matching the data type. */
  data!: TypedArrayUnion;

  /**
   * @param cols       Number of columns.
   * @param rows       Number of rows.
   * @param dataType   Composite type (DataType | Channel).
   * @param dataBuffer Optional pre-existing DataBuffer.
   */
  constructor(cols: number, rows: number, dataType: number, dataBuffer?: DataBuffer) {
    this.type    = getDataType(dataType) | 0;
    this.channel = getChannel(dataType) | 0;
    this.cols    = cols | 0;
    this.rows    = rows | 0;

    if (dataBuffer === undefined) {
      this.allocate();
    } else {
      this.buffer = dataBuffer;
      this.data   = this._selectView(dataBuffer);
    }
  }

  /** Allocate (or re-allocate) the backing buffer for the current dimensions. */
  allocate(): void {
    const byteSize = (this.cols * getDataTypeSize(this.type) * this.channel) * this.rows;
    this.buffer = new DataBuffer(byteSize);
    this.data   = this._selectView(this.buffer);
  }

  /** Copy this matrix's data into `other` element-by-element. */
  copyTo(other: Matrix): void {
    const od = other.data;
    const td = this.data;
    const n  = (this.cols * this.rows * this.channel) | 0;

    let i = 0;
    // Unrolled loop (matches legacy behaviour)
    for (; i < n - 4; i += 4) {
      od[i]     = td[i];
      od[i + 1] = td[i + 1];
      od[i + 2] = td[i + 2];
      od[i + 3] = td[i + 3];
    }
    for (; i < n; ++i) {
      od[i] = td[i];
    }
  }

  /**
   * Resize the matrix.  Only re-allocates if the new dimensions exceed the
   * current buffer size.
   */
  resize(cols: number, rows: number, ch?: number): void {
    if (ch === undefined) {
      ch = this.channel;
    }

    const newSize = (cols * getDataTypeSize(this.type) * ch) * rows;

    if (newSize > this.buffer.size) {
      this.cols    = cols;
      this.rows    = rows;
      this.channel = ch;
      this.allocate();
    } else {
      this.cols    = cols;
      this.rows    = rows;
      this.channel = ch;
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Pick the typed-array view that matches `this.type`. */
  private _selectView(buf: DataBuffer): TypedArrayUnion {
    if (this.type & DataType.U8)  return buf.u8;
    if (this.type & DataType.S32) return buf.i32;
    if (this.type & DataType.F32) return buf.f32;
    return buf.f64;
  }
}
