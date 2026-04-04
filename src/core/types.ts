/**
 * Core type system for jsfeat.
 *
 * Ported from legacy/jsfeat_struct.js (constants, data-type helpers, and
 * composite type shortcuts).
 */

// ---------------------------------------------------------------------------
// Numeric constants
// ---------------------------------------------------------------------------

/** Machine epsilon for single-precision floating point. */
export const EPSILON = 0.0000001192092896;

/** Minimum positive value for single-precision floating point. */
export const FLT_MIN = 1e-37;

// ---------------------------------------------------------------------------
// Data-type flags  (occupy bits 8-15 of a composite type)
// ---------------------------------------------------------------------------

/**
 * Data type flags used to specify the element type of a Matrix.
 *
 * These occupy bits 8--15 of a composite type value and can be combined
 * with a {@link Channel} flag via bitwise OR.
 */
export const DataType = {
  /** Unsigned 8-bit integer. */
  U8:  0x0100,
  /** Signed 32-bit integer. */
  S32: 0x0200,
  /** 32-bit floating point. */
  F32: 0x0400,
  /** Signed 64-bit integer (rarely used). */
  S64: 0x0800,
  /** 64-bit floating point. */
  F64: 0x1000,
} as const;

/** Union type of all valid DataType flag values. */
export type DataTypeFlag = (typeof DataType)[keyof typeof DataType];

// ---------------------------------------------------------------------------
// Channel flags  (occupy bits 0-7 of a composite type)
// ---------------------------------------------------------------------------

/**
 * Channel count flags.
 *
 * These occupy bits 0--7 of a composite type value and can be combined
 * with a {@link DataType} flag via bitwise OR.
 */
export const Channel = {
  /** Single channel (grayscale). */
  C1: 0x01,
  /** Two channels. */
  C2: 0x02,
  /** Three channels (e.g. RGB). */
  C3: 0x03,
  /** Four channels (e.g. RGBA). */
  C4: 0x04,
} as const;

/** Union type of all valid Channel flag values. */
export type ChannelFlag = (typeof Channel)[keyof typeof Channel];

// ---------------------------------------------------------------------------
// Composite shortcuts  (DataType | Channel)
// ---------------------------------------------------------------------------

/**
 * A composite type combining a {@link DataType} and {@link Channel} flag.
 * Stored as a single number with the data type in the upper byte and
 * the channel count in the lower byte.
 */
export type CompositeType = number;

/** Unsigned 8-bit, single channel (grayscale). */
export const U8C1:  CompositeType = DataType.U8  | Channel.C1;
/** Unsigned 8-bit, three channels (RGB). */
export const U8C3:  CompositeType = DataType.U8  | Channel.C3;
/** Unsigned 8-bit, four channels (RGBA). */
export const U8C4:  CompositeType = DataType.U8  | Channel.C4;
/** 32-bit float, single channel. */
export const F32C1: CompositeType = DataType.F32 | Channel.C1;
/** 32-bit float, two channels. */
export const F32C2: CompositeType = DataType.F32 | Channel.C2;
/** Signed 32-bit integer, single channel. */
export const S32C1: CompositeType = DataType.S32 | Channel.C1;
/** Signed 32-bit integer, two channels. */
export const S32C2: CompositeType = DataType.S32 | Channel.C2;

// ---------------------------------------------------------------------------
// Typed-array union
// ---------------------------------------------------------------------------

/** Union of all typed arrays used as Matrix backing stores. */
export type TypedArrayUnion =
  | Uint8Array
  | Int32Array
  | Float32Array
  | Float64Array;

// ---------------------------------------------------------------------------
// Color conversion codes
// ---------------------------------------------------------------------------

/**
 * Color conversion codes for the {@link grayscale} function.
 */
export const ColorCode = {
  /** RGBA to grayscale (default browser pixel format). */
  RGBA2GRAY: 0,
  /** RGB to grayscale. */
  RGB2GRAY:  1,
  /** BGRA to grayscale. */
  BGRA2GRAY: 2,
  /** BGR to grayscale. */
  BGR2GRAY:  3,
} as const;

// ---------------------------------------------------------------------------
// Option flags
// ---------------------------------------------------------------------------

/** When set, {@link boxBlurGray} skips the normalization step. */
export const BOX_BLUR_NOSCALE = 0x01;

/** When set, {@link svdDecompose} stores U transposed. */
export const SVD_U_T = 0x01;

/** When set, {@link svdDecompose} stores V transposed. */
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

/**
 * Extract the data-type portion (upper byte) of a composite type.
 *
 * @param type - Composite type value.
 * @returns The data-type flag (e.g. `DataType.U8`).
 */
export function getDataType(type: number): number {
  return type & 0xff00;
}

/**
 * Extract the channel portion (lower byte) of a composite type.
 *
 * @param type - Composite type value.
 * @returns The channel flag (e.g. `Channel.C1`).
 */
export function getChannel(type: number): number {
  return type & 0xff;
}

/**
 * Return the byte-size per element for the given composite / data type.
 *
 * @param type - Composite or data-type flag.
 * @returns Size in bytes (1 for U8, 4 for S32/F32, 8 for S64/F64).
 */
export function getDataTypeSize(type: number): number {
  return _dataTypeSize[(type & 0xff00) >> 8];
}
