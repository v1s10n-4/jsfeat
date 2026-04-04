import { describe, it, expect } from 'vitest';
import { Matrix } from '../../src/core/matrix';
import { DataType, Channel } from '../../src/core/types';
import {
  identity,
  transpose,
  multiply,
  multiplyABt,
  multiplyAtB,
  multiplyAAt,
  multiplyAtA,
  identity3x3,
  invert3x3,
  multiply3x3,
  mat3x3Determinant,
  determinant3x3,
} from '../../src/math/matmath';

const F32C1 = DataType.F32 | Channel.C1;
const F64C1 = DataType.F64 | Channel.C1;

function makeMatrix(
  rows: number,
  cols: number,
  values: number[],
  dt: number = F64C1,
): Matrix {
  const m = new Matrix(cols, rows, dt);
  for (let i = 0; i < values.length; i++) m.data[i] = values[i];
  return m;
}

describe('identity', () => {
  it('sets a 3x3 matrix to identity', () => {
    const M = new Matrix(3, 3, F64C1);
    identity(M);
    const expected = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    for (let i = 0; i < 9; i++) {
      expect(M.data[i]).toBe(expected[i]);
    }
  });

  it('sets a 3x3 matrix to scaled identity', () => {
    const M = new Matrix(3, 3, F64C1);
    identity(M, 5);
    expect(M.data[0]).toBe(5);
    expect(M.data[4]).toBe(5);
    expect(M.data[8]).toBe(5);
    expect(M.data[1]).toBe(0);
    expect(M.data[3]).toBe(0);
  });

  it('works for non-square matrices', () => {
    const M = new Matrix(4, 2, F64C1);
    identity(M);
    // 2x4: [1,0,0,0, 0,1,0,0]
    expect(M.data[0]).toBe(1);
    expect(M.data[5]).toBe(1);
    expect(M.data[1]).toBe(0);
    expect(M.data[4]).toBe(0);
  });
});

describe('transpose', () => {
  it('transposes a 2x3 matrix to 3x2', () => {
    // A is 2 rows x 3 cols = [1,2,3, 4,5,6]
    const A = makeMatrix(2, 3, [1, 2, 3, 4, 5, 6]);
    const At = new Matrix(2, 3, F64C1); // 3 rows x 2 cols
    transpose(At, A);
    // At should be: [1,4, 2,5, 3,6]
    expect(At.data[0]).toBe(1);
    expect(At.data[1]).toBe(4);
    expect(At.data[2]).toBe(2);
    expect(At.data[3]).toBe(5);
    expect(At.data[4]).toBe(3);
    expect(At.data[5]).toBe(6);
  });

  it('transposes a 3x3 matrix', () => {
    const A = makeMatrix(3, 3, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const At = new Matrix(3, 3, F64C1);
    transpose(At, A);
    const expected = [1, 4, 7, 2, 5, 8, 3, 6, 9];
    for (let i = 0; i < 9; i++) {
      expect(At.data[i]).toBe(expected[i]);
    }
  });
});

describe('multiply', () => {
  it('multiplies two 2x2 matrices', () => {
    // A = [1,2; 3,4], B = [5,6; 7,8]
    const A = makeMatrix(2, 2, [1, 2, 3, 4]);
    const B = makeMatrix(2, 2, [5, 6, 7, 8]);
    const C = new Matrix(2, 2, F64C1);
    multiply(C, A, B);
    // C = [1*5+2*7, 1*6+2*8; 3*5+4*7, 3*6+4*8] = [19,22; 43,50]
    expect(C.data[0]).toBe(19);
    expect(C.data[1]).toBe(22);
    expect(C.data[2]).toBe(43);
    expect(C.data[3]).toBe(50);
  });

  it('multiplies 3x3 matrices', () => {
    const A = makeMatrix(3, 3, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const B = makeMatrix(3, 3, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const C = new Matrix(3, 3, F64C1);
    multiply(C, A, B);
    for (let i = 0; i < 9; i++) {
      expect(C.data[i]).toBe(B.data[i]);
    }
  });

  it('multiplies 2x3 by 3x2', () => {
    // A(2x3) = [1,2,3; 4,5,6], B(3x2) = [7,8; 9,10; 11,12]
    const A = makeMatrix(2, 3, [1, 2, 3, 4, 5, 6]);
    const B = makeMatrix(3, 2, [7, 8, 9, 10, 11, 12]);
    const C = new Matrix(2, 2, F64C1);
    multiply(C, A, B);
    // C = [1*7+2*9+3*11, 1*8+2*10+3*12; 4*7+5*9+6*11, 4*8+5*10+6*12]
    //   = [58, 64; 139, 154]
    expect(C.data[0]).toBe(58);
    expect(C.data[1]).toBe(64);
    expect(C.data[2]).toBe(139);
    expect(C.data[3]).toBe(154);
  });
});

describe('multiplyABt', () => {
  it('computes C = A * B^T for 2x2', () => {
    const A = makeMatrix(2, 2, [1, 2, 3, 4]);
    const B = makeMatrix(2, 2, [5, 6, 7, 8]);
    const C = new Matrix(2, 2, F64C1);
    multiplyABt(C, A, B);
    // B^T = [5,7; 6,8], A*B^T = [1*5+2*6, 1*7+2*8; 3*5+4*6, 3*7+4*8] = [17,23; 39,53]
    expect(C.data[0]).toBe(17);
    expect(C.data[1]).toBe(23);
    expect(C.data[2]).toBe(39);
    expect(C.data[3]).toBe(53);
  });
});

describe('multiplyAtB', () => {
  it('computes C = A^T * B for 2x2', () => {
    const A = makeMatrix(2, 2, [1, 2, 3, 4]);
    const B = makeMatrix(2, 2, [5, 6, 7, 8]);
    const C = new Matrix(2, 2, F64C1);
    multiplyAtB(C, A, B);
    // A^T = [1,3; 2,4], A^T*B = [1*5+3*7, 1*6+3*8; 2*5+4*7, 2*6+4*8] = [26,30; 38,44]
    expect(C.data[0]).toBe(26);
    expect(C.data[1]).toBe(30);
    expect(C.data[2]).toBe(38);
    expect(C.data[3]).toBe(44);
  });
});

describe('multiplyAAt', () => {
  it('computes C = A * A^T (symmetric)', () => {
    const A = makeMatrix(2, 3, [1, 2, 3, 4, 5, 6]);
    const C = new Matrix(2, 2, F64C1);
    multiplyAAt(C, A);
    // A*A^T = [1*1+2*2+3*3, 1*4+2*5+3*6; 1*4+2*5+3*6, 4*4+5*5+6*6]
    //       = [14, 32; 32, 77]
    expect(C.data[0]).toBe(14);
    expect(C.data[1]).toBe(32);
    expect(C.data[2]).toBe(32);
    expect(C.data[3]).toBe(77);
  });
});

describe('multiplyAtA', () => {
  it('computes C = A^T * A (symmetric)', () => {
    const A = makeMatrix(2, 3, [1, 2, 3, 4, 5, 6]);
    const C = new Matrix(3, 3, F64C1);
    multiplyAtA(C, A);
    // A^T*A = [1*1+4*4, 1*2+4*5, 1*3+4*6; 2*1+5*4, 2*2+5*5, 2*3+5*6; 3*1+6*4, 3*2+6*5, 3*3+6*6]
    //       = [17,22,27; 22,29,36; 27,36,45]
    expect(C.data[0]).toBe(17);
    expect(C.data[1]).toBe(22);
    expect(C.data[2]).toBe(27);
    expect(C.data[3]).toBe(22);
    expect(C.data[4]).toBe(29);
    expect(C.data[5]).toBe(36);
    expect(C.data[6]).toBe(27);
    expect(C.data[7]).toBe(36);
    expect(C.data[8]).toBe(45);
  });
});

describe('identity3x3', () => {
  it('sets a 3x3 matrix to identity', () => {
    const M = new Matrix(3, 3, F64C1);
    identity3x3(M);
    const expected = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    for (let i = 0; i < 9; i++) {
      expect(M.data[i]).toBe(expected[i]);
    }
  });

  it('accepts a custom diagonal value', () => {
    const M = new Matrix(3, 3, F64C1);
    identity3x3(M, 3);
    expect(M.data[0]).toBe(3);
    expect(M.data[4]).toBe(3);
    expect(M.data[8]).toBe(3);
    expect(M.data[1]).toBe(0);
  });
});

describe('invert3x3', () => {
  it('inverts a 3x3 matrix so A * Ainv = I', () => {
    const A = makeMatrix(3, 3, [1, 2, 3, 0, 1, 4, 5, 6, 0]);
    const Ai = new Matrix(3, 3, F64C1);
    invert3x3(A, Ai);

    // Verify A * Ai = I
    const result = new Matrix(3, 3, F64C1);
    multiply3x3(result, A, Ai);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const expected = i === j ? 1 : 0;
        expect(result.data[i * 3 + j]).toBeCloseTo(expected, 10);
      }
    }
  });

  it('inverts the identity to itself', () => {
    const I = makeMatrix(3, 3, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const Ii = new Matrix(3, 3, F64C1);
    invert3x3(I, Ii);
    for (let i = 0; i < 9; i++) {
      expect(Ii.data[i]).toBeCloseTo(I.data[i], 10);
    }
  });
});

describe('multiply3x3', () => {
  it('multiplies two 3x3 matrices', () => {
    const A = makeMatrix(3, 3, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const B = makeMatrix(3, 3, [9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const C = new Matrix(3, 3, F64C1);
    multiply3x3(C, A, B);
    // Row 0: [1*9+2*6+3*3, 1*8+2*5+3*2, 1*7+2*4+3*1] = [30,24,18]
    // Row 1: [4*9+5*6+6*3, 4*8+5*5+6*2, 4*7+5*4+6*1] = [84,69,54]
    // Row 2: [7*9+8*6+9*3, 7*8+8*5+9*2, 7*7+8*4+9*1] = [138,114,90]
    expect(C.data[0]).toBe(30);
    expect(C.data[1]).toBe(24);
    expect(C.data[2]).toBe(18);
    expect(C.data[3]).toBe(84);
    expect(C.data[4]).toBe(69);
    expect(C.data[5]).toBe(54);
    expect(C.data[6]).toBe(138);
    expect(C.data[7]).toBe(114);
    expect(C.data[8]).toBe(90);
  });

  it('gives same result as generic multiply for 3x3', () => {
    const A = makeMatrix(3, 3, [2, -1, 0, 3, 4, -2, 1, 0, 5]);
    const B = makeMatrix(3, 3, [1, 0, 3, -1, 2, 1, 0, 4, -1]);
    const C1 = new Matrix(3, 3, F64C1);
    const C2 = new Matrix(3, 3, F64C1);
    multiply(C1, A, B);
    multiply3x3(C2, A, B);
    for (let i = 0; i < 9; i++) {
      expect(C2.data[i]).toBeCloseTo(C1.data[i], 10);
    }
  });
});

describe('mat3x3Determinant', () => {
  it('computes determinant of identity as 1', () => {
    const I = makeMatrix(3, 3, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(mat3x3Determinant(I)).toBe(1);
  });

  it('computes determinant of a known matrix', () => {
    // det([1,2,3; 0,1,4; 5,6,0]) = 1(0-24) - 2(0-20) + 3(0-5) = -24+40-15 = 1
    const M = makeMatrix(3, 3, [1, 2, 3, 0, 1, 4, 5, 6, 0]);
    expect(mat3x3Determinant(M)).toBe(1);
  });

  it('computes determinant of singular matrix as 0', () => {
    const M = makeMatrix(3, 3, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(mat3x3Determinant(M)).toBe(0);
  });
});

describe('determinant3x3', () => {
  it('computes determinant from scalars', () => {
    const d = determinant3x3(1, 2, 3, 0, 1, 4, 5, 6, 0);
    expect(d).toBe(1);
  });

  it('matches mat3x3Determinant for the same values', () => {
    const vals = [2, -1, 0, 3, 4, -2, 1, 0, 5];
    const M = makeMatrix(3, 3, vals);
    const d1 = mat3x3Determinant(M);
    const d2 = determinant3x3(
      vals[0], vals[1], vals[2],
      vals[3], vals[4], vals[5],
      vals[6], vals[7], vals[8],
    );
    expect(d2).toBe(d1);
  });
});
