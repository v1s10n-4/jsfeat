import { describe, it, expect } from 'vitest';
import {
  EPSILON,
  FLT_MIN,
  DataType,
  Channel,
  U8C1, U8C3, U8C4,
  F32C1, F32C2,
  S32C1, S32C2,
  ColorCode,
  BOX_BLUR_NOSCALE,
  SVD_U_T,
  SVD_V_T,
  _dataTypeSize,
  getDataType,
  getChannel,
  getDataTypeSize,
} from '../../src/core/types';

// ---------------------------------------------------------------------------
// Numeric constants
// ---------------------------------------------------------------------------

describe('numeric constants', () => {
  it('EPSILON matches the legacy value', () => {
    expect(EPSILON).toBe(0.0000001192092896);
  });

  it('FLT_MIN matches the legacy value', () => {
    expect(FLT_MIN).toBe(1e-37);
  });
});

// ---------------------------------------------------------------------------
// DataType flags
// ---------------------------------------------------------------------------

describe('DataType', () => {
  it('has U8 = 0x0100', () => expect(DataType.U8).toBe(0x0100));
  it('has S32 = 0x0200', () => expect(DataType.S32).toBe(0x0200));
  it('has F32 = 0x0400', () => expect(DataType.F32).toBe(0x0400));
  it('has S64 = 0x0800', () => expect(DataType.S64).toBe(0x0800));
  it('has F64 = 0x1000', () => expect(DataType.F64).toBe(0x1000));

  it('all flags are distinct powers of two', () => {
    const flags = Object.values(DataType);
    for (let i = 0; i < flags.length; i++) {
      for (let j = i + 1; j < flags.length; j++) {
        expect(flags[i] & flags[j]).toBe(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Channel flags
// ---------------------------------------------------------------------------

describe('Channel', () => {
  it('has C1 = 0x01', () => expect(Channel.C1).toBe(0x01));
  it('has C2 = 0x02', () => expect(Channel.C2).toBe(0x02));
  it('has C3 = 0x03', () => expect(Channel.C3).toBe(0x03));
  it('has C4 = 0x04', () => expect(Channel.C4).toBe(0x04));
});

// ---------------------------------------------------------------------------
// Composite shortcuts
// ---------------------------------------------------------------------------

describe('composite type shortcuts', () => {
  it('U8C1 = DataType.U8 | Channel.C1', () => {
    expect(U8C1).toBe(DataType.U8 | Channel.C1);
  });
  it('U8C3 = DataType.U8 | Channel.C3', () => {
    expect(U8C3).toBe(DataType.U8 | Channel.C3);
  });
  it('U8C4 = DataType.U8 | Channel.C4', () => {
    expect(U8C4).toBe(DataType.U8 | Channel.C4);
  });
  it('F32C1 = DataType.F32 | Channel.C1', () => {
    expect(F32C1).toBe(DataType.F32 | Channel.C1);
  });
  it('F32C2 = DataType.F32 | Channel.C2', () => {
    expect(F32C2).toBe(DataType.F32 | Channel.C2);
  });
  it('S32C1 = DataType.S32 | Channel.C1', () => {
    expect(S32C1).toBe(DataType.S32 | Channel.C1);
  });
  it('S32C2 = DataType.S32 | Channel.C2', () => {
    expect(S32C2).toBe(DataType.S32 | Channel.C2);
  });

  it('composites round-trip through getDataType + getChannel', () => {
    expect(getDataType(U8C1)).toBe(DataType.U8);
    expect(getChannel(U8C1)).toBe(Channel.C1);
    expect(getDataType(F32C2)).toBe(DataType.F32);
    expect(getChannel(F32C2)).toBe(Channel.C2);
  });
});

// ---------------------------------------------------------------------------
// ColorCode
// ---------------------------------------------------------------------------

describe('ColorCode', () => {
  it('RGBA2GRAY = 0', () => expect(ColorCode.RGBA2GRAY).toBe(0));
  it('RGB2GRAY = 1', () => expect(ColorCode.RGB2GRAY).toBe(1));
  it('BGRA2GRAY = 2', () => expect(ColorCode.BGRA2GRAY).toBe(2));
  it('BGR2GRAY = 3', () => expect(ColorCode.BGR2GRAY).toBe(3));
});

// ---------------------------------------------------------------------------
// Option flags
// ---------------------------------------------------------------------------

describe('option flags', () => {
  it('BOX_BLUR_NOSCALE = 0x01', () => expect(BOX_BLUR_NOSCALE).toBe(0x01));
  it('SVD_U_T = 0x01', () => expect(SVD_U_T).toBe(0x01));
  it('SVD_V_T = 0x02', () => expect(SVD_V_T).toBe(0x02));
});

// ---------------------------------------------------------------------------
// _dataTypeSize lookup
// ---------------------------------------------------------------------------

describe('_dataTypeSize', () => {
  it('is an Int32Array of length 17', () => {
    expect(_dataTypeSize).toBeInstanceOf(Int32Array);
    expect(_dataTypeSize.length).toBe(17);
  });

  it('matches the legacy lookup table', () => {
    const expected = [-1, 1, 4, -1, 4, -1, -1, -1, 8, -1, -1, -1, -1, -1, -1, -1, 8];
    expect(Array.from(_dataTypeSize)).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe('getDataType', () => {
  it('extracts U8 from U8C1', () => {
    expect(getDataType(U8C1)).toBe(DataType.U8);
  });
  it('extracts F32 from F32C2', () => {
    expect(getDataType(F32C2)).toBe(DataType.F32);
  });
  it('extracts S32 from S32C1', () => {
    expect(getDataType(S32C1)).toBe(DataType.S32);
  });
  it('returns 0 for bare channel value', () => {
    expect(getDataType(Channel.C1)).toBe(0);
  });
});

describe('getChannel', () => {
  it('extracts C1 from U8C1', () => {
    expect(getChannel(U8C1)).toBe(Channel.C1);
  });
  it('extracts C3 from U8C3', () => {
    expect(getChannel(U8C3)).toBe(Channel.C3);
  });
  it('extracts C4 from U8C4', () => {
    expect(getChannel(U8C4)).toBe(Channel.C4);
  });
  it('returns 0 for bare data-type value', () => {
    expect(getChannel(DataType.U8)).toBe(0);
  });
});

describe('getDataTypeSize', () => {
  it('U8 elements are 1 byte', () => {
    expect(getDataTypeSize(DataType.U8)).toBe(1);
    expect(getDataTypeSize(U8C1)).toBe(1);
  });
  it('S32 elements are 4 bytes', () => {
    expect(getDataTypeSize(DataType.S32)).toBe(4);
    expect(getDataTypeSize(S32C2)).toBe(4);
  });
  it('F32 elements are 4 bytes', () => {
    expect(getDataTypeSize(DataType.F32)).toBe(4);
    expect(getDataTypeSize(F32C1)).toBe(4);
  });
  it('S64 elements are 8 bytes', () => {
    expect(getDataTypeSize(DataType.S64)).toBe(8);
  });
  it('F64 elements are 8 bytes', () => {
    expect(getDataTypeSize(DataType.F64)).toBe(8);
  });
});
