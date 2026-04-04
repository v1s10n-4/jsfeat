import { describe, it, expect, vi } from 'vitest';
import { Pyramid } from '../../src/core/pyramid';
import { Matrix } from '../../src/core/matrix';
import { U8C1 } from '../../src/core/types';

describe('Pyramid', () => {
  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  it('creates a Pyramid with the specified number of levels', () => {
    const p = new Pyramid(4);
    expect(p.levels).toBe(4);
    expect(p.data.length).toBe(4);
    expect(p.pyrdown).toBeNull();
  });

  // -----------------------------------------------------------------------
  // allocate
  // -----------------------------------------------------------------------

  it('allocate creates matrices with halving dimensions', () => {
    const p = new Pyramid(3);
    p.allocate(640, 480, U8C1);

    expect(p.data[0].cols).toBe(640);
    expect(p.data[0].rows).toBe(480);

    expect(p.data[1].cols).toBe(320);
    expect(p.data[1].rows).toBe(240);

    expect(p.data[2].cols).toBe(160);
    expect(p.data[2].rows).toBe(120);
  });

  it('each level is a Matrix of the given data type', () => {
    const p = new Pyramid(2);
    p.allocate(64, 64, U8C1);
    for (let i = 0; i < 2; i++) {
      expect(p.data[i]).toBeInstanceOf(Matrix);
    }
  });

  // -----------------------------------------------------------------------
  // build
  // -----------------------------------------------------------------------

  it('build with skipFirstLevel=false copies input data to level 0', () => {
    const p = new Pyramid(2);
    p.allocate(4, 4, U8C1);

    // Provide a mock pyrdown that just zeroes the destination
    p.pyrdown = vi.fn((_src: Matrix, dst: Matrix) => {
      for (let i = 0; i < dst.data.length; i++) dst.data[i] = 0;
    });

    const input = new Matrix(4, 4, U8C1);
    for (let i = 0; i < 16; i++) input.data[i] = i + 1;

    p.build(input, false);

    // Level 0 should have the input data
    for (let i = 0; i < 16; i++) {
      expect(p.data[0].data[i]).toBe(i + 1);
    }

    // pyrdown should have been called once (level 0 -> level 1)
    expect(p.pyrdown).toHaveBeenCalledTimes(1);
  });

  it('build with skipFirstLevel=true (default) does not copy to level 0', () => {
    const p = new Pyramid(2);
    p.allocate(4, 4, U8C1);

    p.pyrdown = vi.fn((_src: Matrix, _dst: Matrix) => {});

    const input = new Matrix(4, 4, U8C1);
    for (let i = 0; i < 16; i++) input.data[i] = 99;

    p.build(input);

    // Level 0 should NOT have been touched (remains 0)
    expect(p.data[0].data[0]).toBe(0);
    expect(p.pyrdown).toHaveBeenCalledTimes(1);
  });

  it('build calls pyrdown for each subsequent level', () => {
    const p = new Pyramid(4);
    p.allocate(32, 32, U8C1);

    p.pyrdown = vi.fn((_src: Matrix, _dst: Matrix) => {});

    const input = new Matrix(32, 32, U8C1);
    p.build(input);

    // levels 1, 2, 3  -->  3 calls
    expect(p.pyrdown).toHaveBeenCalledTimes(3);
  });
});
