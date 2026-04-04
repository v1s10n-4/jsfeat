/**
 * Core type system for jsfeat.
 *
 * Ported from legacy/jsfeat_struct.js (constants, data-type helpers, and
 * composite type shortcuts).
 */

// ---------------------------------------------------------------------------
// Numeric constants
// ---------------------------------------------------------------------------

export const EPSILON = 0.0000001192092896;
export const FLT_MIN = 1e-37;

// ---------------------------------------------------------------------------
// Data-type flags  (occupy bits 8-15 of a composite type)
// ---------------------------------------------------------------------------

export const DataType = {
  U8:  0x0100,
  S32: 0x0200,
  F32: 0x0400,
  S64: 0x0800,
  F64: 0x1000,
} as const;

export type DataTypeFlag = (typeof DataType)[keyof typeof DataType];

// ---------------------------------------------------------------------------
// Channel flags  (occupy bits 0-7 of a composite type)
// ---------------------------------------------------------------------------

export const Channel = {
  C1: 0x01,
  C2: 0x02,
  C3: 0x03,
  C4: 0x04,
} as const;

export type ChannelFlag = (typeof Channel)[keyof typeof Channel];

// ---------------------------------------------------------------------------
// Composite shortcuts  (DataType | Channel)
// ---------------------------------------------------------------------------

export type CompositeType = number;

export const U8C1:  CompositeType = DataType.U8  | Channel.C1;
export const U8C3:  CompositeType = DataType.U8  | Channel.C3;
export const U8C4:  CompositeType = DataType.U8  | Channel.C4;
export const F32C1: CompositeType = DataType.F32 | Channel.C1;
export const F32C2: CompositeType = DataType.F32 | Channel.C2;
export const S32C1: CompositeType = DataType.S32 | Channel.C1;
export const S32C2: CompositeType = DataType.S32 | Channel.C2;

// ---------------------------------------------------------------------------
// Typed-array union
// ---------------------------------------------------------------------------

export type TypedArrayUnion =
  | Uint8Array
  | Int32Array
  | Float32Array
  | Float64Array;

// ---------------------------------------------------------------------------
// Color conversion codes
// ---------------------------------------------------------------------------

export const ColorCode = {
  RGBA2GRAY: 0,
  RGB2GRAY:  1,
  BGRA2GRAY: 2,
  BGR2GRAY:  3,
} as const;

// ---------------------------------------------------------------------------
// Option flags
// ---------------------------------------------------------------------------

export const BOX_BLUR_NOSCALE = 0x01;
export const SVD_U_T = 0x01;
export const SVD_V_T = 0x02;

// ---------------------------------------------------------------------------
// Internal size lookup
// ---------------------------------------------------------------------------

/** Maps (typeFlag >> 8) index to byte-size of that data type. */
export const _dataTypeSize = new Int32Array([
  -1, 1, 4, -1, 4, -1, -1, -1, 8, -1, -1, -1, -1, -1, -1, -1, 8,
]);

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Extract the data-type portion (upper byte) of a composite type. */
export function getDataType(type: number): number {
  return type & 0xff00;
}

/** Extract the channel portion (lower byte) of a composite type. */
export function getChannel(type: number): number {
  return type & 0xff;
}

/** Return the byte-size per element for the given composite / data type. */
export function getDataTypeSize(type: number): number {
  return _dataTypeSize[(type & 0xff00) >> 8];
}
