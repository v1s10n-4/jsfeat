# jsfeat TypeScript Recode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the jsfeat computer vision library from legacy JavaScript to modern TypeScript with Vite, Vitest, comprehensive tests, generated docs, examples, and a demo SPA.

**Architecture:** Incremental port in dependency order. Each module is ported to TypeScript preserving logic exactly, then tested. Original source in `legacy/` serves as regression oracle. After all modules pass, a modernization pass converts to camelCase, adds TSDoc, and cleans up patterns. Finally, documentation and demo are built.

**Tech Stack:** TypeScript, Vite (library mode), Vitest, TypeDoc, ESLint, Prettier

**Spec:** `docs/superpowers/specs/2026-04-04-jsfeat-typescript-recode-design.md`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json` (replace existing)
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore` (replace existing)
- Create: `.prettierrc`
- Create: `eslint.config.js`
- Create: `legacy/` (move original source)

- [ ] **Step 1: Move original source to legacy/**

```bash
mkdir -p legacy
cp src/jsfeat.js legacy/
cp src/jsfeat_struct.js legacy/
cp src/jsfeat_cache.js legacy/
cp src/jsfeat_math.js legacy/
cp src/jsfeat_mat_math.js legacy/
cp src/jsfeat_linalg.js legacy/
cp src/jsfeat_imgproc.js legacy/
cp src/jsfeat_fast_corners.js legacy/
cp src/jsfeat_yape06.js legacy/
cp src/jsfeat_yape.js legacy/
cp src/jsfeat_orb.js legacy/
cp src/jsfeat_optical_flow_lk.js legacy/
cp src/jsfeat_haar.js legacy/
cp src/jsfeat_bbf.js legacy/
cp src/jsfeat_motion_estimator.js legacy/
cp src/jsfeat_transform.js legacy/
cp src/jsfeat_export.js legacy/
```

- [ ] **Step 2: Clean out old source and build artifacts**

```bash
rm -rf src/
rm -rf build/
rm -rf compile/
rm -f bower.json
rm -f package.json
rm -f .gitignore
mkdir -p src/core src/math src/imgproc src/features src/flow src/detect src/motion src/transform src/cascades
mkdir -p test/core test/math test/imgproc test/features test/flow test/detect test/motion test/transform test/helpers
```

- [ ] **Step 3: Create package.json**

```json
{
  "name": "jsfeat",
  "version": "1.0.0",
  "description": "JavaScript Computer Vision library",
  "type": "module",
  "license": "MIT",
  "author": "Eugene Zatepyakin (http://www.inspirit.ru/)",
  "exports": {
    "./core": {
      "types": "./dist/core/index.d.ts",
      "default": "./dist/core/index.js"
    },
    "./math": {
      "types": "./dist/math/index.d.ts",
      "default": "./dist/math/index.js"
    },
    "./imgproc": {
      "types": "./dist/imgproc/index.d.ts",
      "default": "./dist/imgproc/index.js"
    },
    "./features": {
      "types": "./dist/features/index.d.ts",
      "default": "./dist/features/index.js"
    },
    "./flow": {
      "types": "./dist/flow/index.d.ts",
      "default": "./dist/flow/index.js"
    },
    "./detect": {
      "types": "./dist/detect/index.d.ts",
      "default": "./dist/detect/index.js"
    },
    "./motion": {
      "types": "./dist/motion/index.d.ts",
      "default": "./dist/motion/index.js"
    },
    "./transform": {
      "types": "./dist/transform/index.d.ts",
      "default": "./dist/transform/index.js"
    },
    "./cascades": {
      "types": "./dist/cascades/index.d.ts",
      "default": "./dist/cascades/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "format": "prettier --write 'src/**/*.ts' 'test/**/*.ts'",
    "docs": "typedoc",
    "demo:dev": "vite --config demo/vite.config.ts",
    "demo:build": "vite build --config demo/vite.config.ts"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vite-plugin-dts": "^4.0.0",
    "vitest": "^3.0.0",
    "eslint": "^9.0.0",
    "@eslint/js": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "typedoc": "^0.27.0"
  }
}
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "legacy", "test", "demo"]
}
```

- [ ] **Step 5: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ rollupTypes: false })],
  build: {
    lib: {
      formats: ['es'],
      entry: {
        'core/index': resolve(__dirname, 'src/core/index.ts'),
        'math/index': resolve(__dirname, 'src/math/index.ts'),
        'imgproc/index': resolve(__dirname, 'src/imgproc/index.ts'),
        'features/index': resolve(__dirname, 'src/features/index.ts'),
        'flow/index': resolve(__dirname, 'src/flow/index.ts'),
        'detect/index': resolve(__dirname, 'src/detect/index.ts'),
        'motion/index': resolve(__dirname, 'src/motion/index.ts'),
        'transform/index': resolve(__dirname, 'src/transform/index.ts'),
        'cascades/index': resolve(__dirname, 'src/cascades/index.ts'),
      },
    },
    rollupOptions: {
      output: {
        preserveModules: false,
      },
    },
  },
});
```

- [ ] **Step 6: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
dist/
coverage/
docs/api/
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 8: Create .prettierrc**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 9: Create eslint.config.js**

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', 'legacy/', 'demo/', 'node_modules/'],
  },
);
```

- [ ] **Step 10: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 11: Verify toolchain works**

Run: `npx tsc --noEmit` (should succeed with no source files to check)
Run: `npx vitest run` (should exit cleanly with 0 test files)

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold TypeScript project with Vite, Vitest, ESLint, Prettier

Replace legacy Ant/Bower build system with modern tooling.
Original source preserved in legacy/ for regression testing."
```

---

### Task 2: Core Types & Constants

**Files:**
- Create: `src/core/types.ts`
- Test: `test/core/types.test.ts`

Port from: `legacy/jsfeat.js` (lines 1-6) and `legacy/jsfeat_struct.js` (lines 10-55, 186-226)

- [ ] **Step 1: Write the failing test**

```typescript
// test/core/types.test.ts
import { describe, it, expect } from 'vitest';
import {
  DataType,
  Channel,
  U8C1,
  U8C3,
  U8C4,
  F32C1,
  F32C2,
  S32C1,
  S32C2,
  EPSILON,
  FLT_MIN,
  ColorCode,
  BOX_BLUR_NOSCALE,
  SVD_U_T,
  SVD_V_T,
  getDataType,
  getChannel,
  getDataTypeSize,
} from '../../src/core/types';

describe('DataType constants', () => {
  it('has correct bitflag values', () => {
    expect(DataType.U8).toBe(0x0100);
    expect(DataType.S32).toBe(0x0200);
    expect(DataType.F32).toBe(0x0400);
    expect(DataType.S64).toBe(0x0800);
    expect(DataType.F64).toBe(0x1000);
  });
});

describe('Channel constants', () => {
  it('has correct values', () => {
    expect(Channel.C1).toBe(0x01);
    expect(Channel.C2).toBe(0x02);
    expect(Channel.C3).toBe(0x03);
    expect(Channel.C4).toBe(0x04);
  });
});

describe('Composite type shortcuts', () => {
  it('combines DataType and Channel correctly', () => {
    expect(U8C1).toBe(DataType.U8 | Channel.C1);
    expect(U8C3).toBe(DataType.U8 | Channel.C3);
    expect(U8C4).toBe(DataType.U8 | Channel.C4);
    expect(F32C1).toBe(DataType.F32 | Channel.C1);
    expect(F32C2).toBe(DataType.F32 | Channel.C2);
    expect(S32C1).toBe(DataType.S32 | Channel.C1);
    expect(S32C2).toBe(DataType.S32 | Channel.C2);
  });
});

describe('getDataType', () => {
  it('extracts data type from composite type', () => {
    expect(getDataType(U8C1)).toBe(DataType.U8);
    expect(getDataType(F32C2)).toBe(DataType.F32);
    expect(getDataType(S32C1)).toBe(DataType.S32);
  });
});

describe('getChannel', () => {
  it('extracts channel count from composite type', () => {
    expect(getChannel(U8C1)).toBe(1);
    expect(getChannel(U8C3)).toBe(3);
    expect(getChannel(F32C2)).toBe(2);
    expect(getChannel(U8C4)).toBe(4);
  });
});

describe('getDataTypeSize', () => {
  it('returns correct byte sizes', () => {
    expect(getDataTypeSize(U8C1)).toBe(1);
    expect(getDataTypeSize(S32C1)).toBe(4);
    expect(getDataTypeSize(F32C1)).toBe(4);
    expect(getDataTypeSize(DataType.S64 | Channel.C1)).toBe(8);
    expect(getDataTypeSize(DataType.F64 | Channel.C1)).toBe(8);
  });
});

describe('Constants', () => {
  it('has EPSILON close to float epsilon', () => {
    expect(EPSILON).toBeCloseTo(0.0000001192092896, 15);
  });
  it('has FLT_MIN', () => {
    expect(FLT_MIN).toBe(1e-37);
  });
});

describe('ColorCode', () => {
  it('has correct enum values', () => {
    expect(ColorCode.RGBA2GRAY).toBe(0);
    expect(ColorCode.RGB2GRAY).toBe(1);
    expect(ColorCode.BGRA2GRAY).toBe(2);
    expect(ColorCode.BGR2GRAY).toBe(3);
  });
});

describe('Option flags', () => {
  it('has correct values', () => {
    expect(BOX_BLUR_NOSCALE).toBe(0x01);
    expect(SVD_U_T).toBe(0x01);
    expect(SVD_V_T).toBe(0x02);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/types.test.ts`
Expected: FAIL — module `../../src/core/types` not found.

- [ ] **Step 3: Write implementation**

```typescript
// src/core/types.ts

export const EPSILON = 0.0000001192092896;
export const FLT_MIN = 1e-37;

export const DataType = {
  U8: 0x0100,
  S32: 0x0200,
  F32: 0x0400,
  S64: 0x0800,
  F64: 0x1000,
} as const;

export const Channel = {
  C1: 0x01,
  C2: 0x02,
  C3: 0x03,
  C4: 0x04,
} as const;

export const U8C1 = DataType.U8 | Channel.C1;
export const U8C3 = DataType.U8 | Channel.C3;
export const U8C4 = DataType.U8 | Channel.C4;
export const F32C1 = DataType.F32 | Channel.C1;
export const F32C2 = DataType.F32 | Channel.C2;
export const S32C1 = DataType.S32 | Channel.C1;
export const S32C2 = DataType.S32 | Channel.C2;

export type DataTypeFlag = (typeof DataType)[keyof typeof DataType];
export type ChannelFlag = (typeof Channel)[keyof typeof Channel];
export type CompositeType = number;
export type TypedArrayUnion = Uint8Array | Int32Array | Float32Array | Float64Array;

export enum ColorCode {
  RGBA2GRAY = 0,
  RGB2GRAY = 1,
  BGRA2GRAY = 2,
  BGR2GRAY = 3,
}

export const BOX_BLUR_NOSCALE = 0x01;
export const SVD_U_T = 0x01;
export const SVD_V_T = 0x02;

const _dataTypeSize = new Int32Array([
  -1, 1, 4, -1, 4, -1, -1, -1, 8, -1, -1, -1, -1, -1, -1, -1, 8,
]);

export function getDataType(type: CompositeType): number {
  return type & 0xff00;
}

export function getChannel(type: CompositeType): number {
  return type & 0xff;
}

export function getDataTypeSize(type: CompositeType): number {
  return _dataTypeSize[(type & 0xff00) >> 8];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/core/types.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts test/core/types.test.ts
git commit -m "feat(core): add type system — DataType, Channel, composite shortcuts, helpers"
```

---

### Task 3: Core Data Structures

**Files:**
- Create: `src/core/data.ts`
- Create: `src/core/matrix.ts`
- Create: `src/core/keypoint.ts`
- Create: `src/core/pyramid.ts`
- Create: `src/core/index.ts`
- Test: `test/core/data.test.ts`
- Test: `test/core/matrix.test.ts`
- Test: `test/core/keypoint.test.ts`
- Test: `test/core/pyramid.test.ts`

Port from: `legacy/jsfeat_struct.js` (lines 58-183)

- [ ] **Step 1: Write failing tests for DataBuffer**

```typescript
// test/core/data.test.ts
import { describe, it, expect } from 'vitest';
import { DataBuffer } from '../../src/core/data';

describe('DataBuffer', () => {
  it('aligns size to multiple of 8', () => {
    const buf = new DataBuffer(10);
    expect(buf.size).toBe(16);
  });

  it('creates typed array views', () => {
    const buf = new DataBuffer(32);
    expect(buf.u8).toBeInstanceOf(Uint8Array);
    expect(buf.i32).toBeInstanceOf(Int32Array);
    expect(buf.f32).toBeInstanceOf(Float32Array);
    expect(buf.f64).toBeInstanceOf(Float64Array);
    expect(buf.u8.buffer).toBe(buf.buffer);
  });

  it('accepts an existing ArrayBuffer', () => {
    const ab = new ArrayBuffer(64);
    const buf = new DataBuffer(64, ab);
    expect(buf.buffer).toBe(ab);
    expect(buf.size).toBe(64);
  });

  it('size 0 aligns to 0', () => {
    const buf = new DataBuffer(0);
    expect(buf.size).toBe(0);
  });

  it('already-aligned sizes stay the same', () => {
    const buf = new DataBuffer(16);
    expect(buf.size).toBe(16);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/data.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement DataBuffer**

```typescript
// src/core/data.ts
export class DataBuffer {
  size: number;
  buffer: ArrayBuffer;
  u8: Uint8Array;
  i32: Int32Array;
  f32: Float32Array;
  f64: Float64Array;

  constructor(sizeInBytes: number, buffer?: ArrayBuffer) {
    this.size = ((sizeInBytes + 7) | 0) & -8;
    if (buffer === undefined) {
      this.buffer = new ArrayBuffer(this.size);
    } else {
      this.buffer = buffer;
      this.size = buffer.byteLength;
    }
    this.u8 = new Uint8Array(this.buffer);
    this.i32 = new Int32Array(this.buffer);
    this.f32 = new Float32Array(this.buffer);
    this.f64 = new Float64Array(this.buffer);
  }
}
```

- [ ] **Step 4: Run DataBuffer tests**

Run: `npx vitest run test/core/data.test.ts`
Expected: All PASS.

- [ ] **Step 5: Write failing tests for Matrix**

```typescript
// test/core/matrix.test.ts
import { describe, it, expect } from 'vitest';
import { Matrix } from '../../src/core/matrix';
import { DataType, Channel, U8C1, F32C1, S32C2, getDataType } from '../../src/core/types';
import { DataBuffer } from '../../src/core/data';

describe('Matrix', () => {
  it('constructs with correct dimensions and type', () => {
    const m = new Matrix(640, 480, U8C1);
    expect(m.cols).toBe(640);
    expect(m.rows).toBe(480);
    expect(m.type).toBe(DataType.U8);
    expect(m.channel).toBe(Channel.C1);
    expect(m.data).toBeInstanceOf(Uint8Array);
  });

  it('allocates correct buffer size', () => {
    const m = new Matrix(10, 10, U8C1);
    expect(m.data.length).toBeGreaterThanOrEqual(100);
  });

  it('uses Float32Array for F32 type', () => {
    const m = new Matrix(10, 10, F32C1);
    expect(m.data).toBeInstanceOf(Float32Array);
  });

  it('uses Int32Array for S32 type', () => {
    const m = new Matrix(10, 10, S32C2);
    expect(m.data).toBeInstanceOf(Int32Array);
    expect(m.channel).toBe(2);
  });

  it('accepts external DataBuffer', () => {
    const buf = new DataBuffer(640 * 480);
    const m = new Matrix(640, 480, U8C1, buf);
    expect(m.buffer).toBe(buf);
    expect(m.data).toBe(buf.u8);
  });

  it('resize allocates new buffer when needed', () => {
    const m = new Matrix(10, 10, U8C1);
    const oldData = m.data;
    m.resize(100, 100);
    expect(m.cols).toBe(100);
    expect(m.rows).toBe(100);
    expect(m.data.length).toBeGreaterThanOrEqual(10000);
  });

  it('resize reuses buffer when new size fits', () => {
    const m = new Matrix(100, 100, U8C1);
    const oldBuffer = m.buffer;
    m.resize(10, 10);
    expect(m.cols).toBe(10);
    expect(m.rows).toBe(10);
    expect(m.buffer).toBe(oldBuffer);
  });

  it('copyTo copies data to another matrix', () => {
    const src = new Matrix(4, 4, U8C1);
    src.data[0] = 42;
    src.data[15] = 99;
    const dst = new Matrix(4, 4, U8C1);
    src.copyTo(dst);
    expect(dst.data[0]).toBe(42);
    expect(dst.data[15]).toBe(99);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run test/core/matrix.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implement Matrix**

```typescript
// src/core/matrix.ts
import { DataBuffer } from './data';
import { DataType, getDataType, getChannel, getDataTypeSize, type CompositeType, type TypedArrayUnion } from './types';

export class Matrix {
  type: number;
  channel: number;
  cols: number;
  rows: number;
  buffer!: DataBuffer;
  data!: TypedArrayUnion;

  constructor(cols: number, rows: number, dataType: CompositeType, dataBuffer?: DataBuffer) {
    this.type = getDataType(dataType) | 0;
    this.channel = getChannel(dataType) | 0;
    this.cols = cols | 0;
    this.rows = rows | 0;
    if (dataBuffer === undefined) {
      this.allocate();
    } else {
      this.buffer = dataBuffer;
      this.data = this._getTypedArray(this.buffer);
    }
  }

  allocate(): void {
    this.buffer = new DataBuffer(this.cols * getDataTypeSize(this.type) * this.channel * this.rows);
    this.data = this._getTypedArray(this.buffer);
  }

  copyTo(other: Matrix): void {
    const od = other.data;
    const td = this.data;
    const n = (this.cols * this.rows * this.channel) | 0;
    for (let i = 0; i < n; i++) {
      od[i] = td[i];
    }
  }

  resize(cols: number, rows: number, ch?: number): void {
    if (ch === undefined) ch = this.channel;
    const newSize = cols * getDataTypeSize(this.type) * ch * rows;
    if (newSize > this.buffer.size) {
      this.cols = cols;
      this.rows = rows;
      this.channel = ch;
      this.allocate();
    } else {
      this.cols = cols;
      this.rows = rows;
      this.channel = ch;
    }
  }

  private _getTypedArray(buf: DataBuffer): TypedArrayUnion {
    if (this.type & DataType.U8) return buf.u8;
    if (this.type & DataType.S32) return buf.i32;
    if (this.type & DataType.F32) return buf.f32;
    return buf.f64;
  }
}
```

- [ ] **Step 8: Run Matrix tests**

Run: `npx vitest run test/core/matrix.test.ts`
Expected: All PASS.

- [ ] **Step 9: Write failing tests for Keypoint**

```typescript
// test/core/keypoint.test.ts
import { describe, it, expect } from 'vitest';
import { Keypoint } from '../../src/core/keypoint';

describe('Keypoint', () => {
  it('constructs with default values', () => {
    const kp = new Keypoint();
    expect(kp.x).toBe(0);
    expect(kp.y).toBe(0);
    expect(kp.score).toBe(0);
    expect(kp.level).toBe(0);
    expect(kp.angle).toBe(-1.0);
  });

  it('constructs with provided values', () => {
    const kp = new Keypoint(10, 20, 0.5, 2, 1.57);
    expect(kp.x).toBe(10);
    expect(kp.y).toBe(20);
    expect(kp.score).toBe(0.5);
    expect(kp.level).toBe(2);
    expect(kp.angle).toBeCloseTo(1.57);
  });
});
```

- [ ] **Step 10: Implement Keypoint**

```typescript
// src/core/keypoint.ts
export class Keypoint {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public score: number = 0,
    public level: number = 0,
    public angle: number = -1.0,
  ) {}
}
```

- [ ] **Step 11: Run Keypoint tests**

Run: `npx vitest run test/core/keypoint.test.ts`
Expected: All PASS.

- [ ] **Step 12: Write failing tests for Pyramid**

```typescript
// test/core/pyramid.test.ts
import { describe, it, expect } from 'vitest';
import { Pyramid } from '../../src/core/pyramid';
import { Matrix } from '../../src/core/matrix';
import { U8C1 } from '../../src/core/types';

describe('Pyramid', () => {
  it('constructs with correct level count', () => {
    const pyr = new Pyramid(3);
    expect(pyr.levels).toBe(3);
    expect(pyr.data.length).toBe(3);
  });

  it('allocate creates matrices at each level with halved dimensions', () => {
    const pyr = new Pyramid(3);
    pyr.allocate(64, 64, U8C1);
    expect(pyr.data[0].cols).toBe(64);
    expect(pyr.data[0].rows).toBe(64);
    expect(pyr.data[1].cols).toBe(32);
    expect(pyr.data[1].rows).toBe(32);
    expect(pyr.data[2].cols).toBe(16);
    expect(pyr.data[2].rows).toBe(16);
  });
});
```

- [ ] **Step 13: Implement Pyramid**

Note: Pyramid.build depends on `imgproc.pyrDown` which is ported later. For now, implement allocate and defer build's `pyrdown` reference.

```typescript
// src/core/pyramid.ts
import { Matrix } from './matrix';
import type { CompositeType } from './types';

export class Pyramid {
  levels: number;
  data: Matrix[];
  pyrdown: ((src: Matrix, dst: Matrix) => void) | null = null;

  constructor(levels: number) {
    this.levels = levels | 0;
    this.data = new Array(levels);
  }

  allocate(startW: number, startH: number, dataType: CompositeType): void {
    for (let i = this.levels - 1; i >= 0; i--) {
      this.data[i] = new Matrix(startW >> i, startH >> i, dataType);
    }
  }

  build(input: Matrix, skipFirstLevel = true): void {
    if (!this.pyrdown) {
      throw new Error('pyrdown function not set. Assign a pyrdown implementation before calling build.');
    }
    const b0 = this.data[0];
    if (!skipFirstLevel) {
      const n = input.cols * input.rows;
      for (let j = n - 1; j >= 0; j--) {
        b0.data[j] = input.data[j];
      }
    }
    let a: Matrix = input;
    let b = this.data[1];
    this.pyrdown(a, b);
    for (let i = 2; i < this.levels; i++) {
      a = b;
      b = this.data[i];
      this.pyrdown(a, b);
    }
  }
}
```

- [ ] **Step 14: Run Pyramid tests**

Run: `npx vitest run test/core/pyramid.test.ts`
Expected: All PASS.

- [ ] **Step 15: Create core index**

```typescript
// src/core/index.ts
export { DataBuffer } from './data';
export { Matrix } from './matrix';
export { Keypoint } from './keypoint';
export { Pyramid } from './pyramid';
export {
  DataType,
  Channel,
  U8C1,
  U8C3,
  U8C4,
  F32C1,
  F32C2,
  S32C1,
  S32C2,
  EPSILON,
  FLT_MIN,
  ColorCode,
  BOX_BLUR_NOSCALE,
  SVD_U_T,
  SVD_V_T,
  getDataType,
  getChannel,
  getDataTypeSize,
  type DataTypeFlag,
  type ChannelFlag,
  type CompositeType,
  type TypedArrayUnion,
} from './types';
```

- [ ] **Step 16: Run all core tests**

Run: `npx vitest run test/core/`
Expected: All PASS.

- [ ] **Step 17: Commit**

```bash
git add src/core/ test/core/
git commit -m "feat(core): add DataBuffer, Matrix, Keypoint, Pyramid classes

Port core data structures from legacy jsfeat_struct.js.
Preserves bitflag type system and typed array allocation."
```

---

### Task 4: Buffer Pool (Cache)

**Files:**
- Create: `src/core/cache.ts`
- Modify: `src/core/index.ts` (add export)
- Test: `test/core/cache.test.ts`

Port from: `legacy/jsfeat_cache.js`

- [ ] **Step 1: Write failing test**

```typescript
// test/core/cache.test.ts
import { describe, it, expect } from 'vitest';
import { BufferPool } from '../../src/core/cache';

describe('BufferPool', () => {
  it('get returns a DataBuffer', () => {
    const pool = new BufferPool(5, 256);
    const buf = pool.get(64);
    expect(buf.u8).toBeInstanceOf(Uint8Array);
    expect(buf.size).toBeGreaterThanOrEqual(64);
  });

  it('get resizes if requested size is larger', () => {
    const pool = new BufferPool(5, 64);
    const buf = pool.get(256);
    expect(buf.size).toBeGreaterThanOrEqual(256);
  });

  it('release returns buffer to pool for reuse', () => {
    const pool = new BufferPool(5, 256);
    const buf1 = pool.get(64);
    pool.release(buf1);
    const buf2 = pool.get(64);
    // After release and re-get, we should get a buffer back (may or may not be same instance)
    expect(buf2.u8).toBeInstanceOf(Uint8Array);
  });

  it('multiple gets work without error', () => {
    const pool = new BufferPool(10, 128);
    const buffers = [];
    for (let i = 0; i < 10; i++) {
      buffers.push(pool.get(128));
    }
    expect(buffers).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/core/cache.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement BufferPool**

```typescript
// src/core/cache.ts
import { DataBuffer } from './data';

class PoolNode {
  next: PoolNode | null = null;
  data: DataBuffer;
  size: number;
  buffer: ArrayBuffer;
  u8: Uint8Array;
  i32: Int32Array;
  f32: Float32Array;
  f64: Float64Array;

  constructor(sizeInBytes: number) {
    this.data = new DataBuffer(sizeInBytes);
    this.size = this.data.size;
    this.buffer = this.data.buffer;
    this.u8 = this.data.u8;
    this.i32 = this.data.i32;
    this.f32 = this.data.f32;
    this.f64 = this.data.f64;
  }

  resize(sizeInBytes: number): void {
    this.data = new DataBuffer(sizeInBytes);
    this.size = this.data.size;
    this.buffer = this.data.buffer;
    this.u8 = this.data.u8;
    this.i32 = this.data.i32;
    this.f32 = this.data.f32;
    this.f64 = this.data.f64;
  }
}

export class BufferPool {
  private _head: PoolNode;
  private _tail: PoolNode;

  constructor(capacity: number, dataSize: number) {
    this._head = new PoolNode(dataSize);
    this._tail = this._head;
    for (let i = 0; i < capacity; i++) {
      const node = new PoolNode(dataSize);
      this._tail.next = node;
      this._tail = node;
    }
  }

  get(sizeInBytes: number): PoolNode {
    const node = this._head;
    this._head = this._head.next!;
    if (sizeInBytes > node.size) {
      node.resize(sizeInBytes);
    }
    return node;
  }

  release(node: PoolNode): void {
    this._tail.next = node;
    this._tail = node;
    node.next = null;
  }
}

// Default pool: 30 buffers of 640*4 bytes (matching original)
export const pool = new BufferPool(30, 640 * 4);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/core/cache.test.ts`
Expected: All PASS.

- [ ] **Step 5: Add export to core/index.ts**

Add to `src/core/index.ts`:
```typescript
export { BufferPool, pool } from './cache';
```

- [ ] **Step 6: Commit**

```bash
git add src/core/cache.ts src/core/index.ts test/core/cache.test.ts
git commit -m "feat(core): add BufferPool with pre-allocated linked list cache"
```

---

### Task 5: Test Helpers

**Files:**
- Create: `test/helpers/comparison.ts`
- Create: `test/helpers/synthetic.ts`

- [ ] **Step 1: Create comparison helpers**

```typescript
// test/helpers/comparison.ts
import { expect } from 'vitest';
import { Matrix } from '../../src/core/matrix';

export function expectMatricesClose(a: Matrix, b: Matrix, epsilon = 1e-6): void {
  expect(a.rows).toBe(b.rows);
  expect(a.cols).toBe(b.cols);
  expect(a.channel).toBe(b.channel);
  const n = a.cols * a.rows * a.channel;
  for (let i = 0; i < n; i++) {
    expect(Math.abs(a.data[i] - b.data[i])).toBeLessThanOrEqual(epsilon);
  }
}

export function expectArrayClose(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  epsilon = 1e-6,
): void {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(epsilon);
  }
}
```

- [ ] **Step 2: Create synthetic image generators**

```typescript
// test/helpers/synthetic.ts
import { Matrix } from '../../src/core/matrix';
import { U8C1 } from '../../src/core/types';
import type { CompositeType } from '../../src/core/types';

/** Create a matrix filled with a constant value */
export function filled(cols: number, rows: number, value: number, type: CompositeType = U8C1): Matrix {
  const m = new Matrix(cols, rows, type);
  m.data.fill(value);
  return m;
}

/** Create a horizontal gradient: 0 on left, 255 on right */
export function horizontalGradient(cols: number, rows: number): Matrix {
  const m = new Matrix(cols, rows, U8C1);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      m.data[y * cols + x] = Math.round((x / (cols - 1)) * 255);
    }
  }
  return m;
}

/** Create a checkerboard pattern */
export function checkerboard(cols: number, rows: number, blockSize: number): Matrix {
  const m = new Matrix(cols, rows, U8C1);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const bx = Math.floor(x / blockSize);
      const by = Math.floor(y / blockSize);
      m.data[y * cols + x] = (bx + by) % 2 === 0 ? 255 : 0;
    }
  }
  return m;
}

/** Create a white square on black background */
export function square(cols: number, rows: number, x: number, y: number, size: number): Matrix {
  const m = new Matrix(cols, rows, U8C1);
  m.data.fill(0);
  for (let dy = 0; dy < size && y + dy < rows; dy++) {
    for (let dx = 0; dx < size && x + dx < cols; dx++) {
      m.data[(y + dy) * cols + (x + dx)] = 255;
    }
  }
  return m;
}

/** Create RGBA pixel data (simulating ImageData.data) */
export function rgbaFromGray(gray: Matrix): Uint8ClampedArray {
  const n = gray.cols * gray.rows;
  const rgba = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const v = gray.data[i];
    rgba[i * 4] = v;
    rgba[i * 4 + 1] = v;
    rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}
```

- [ ] **Step 3: Commit**

```bash
git add test/helpers/
git commit -m "test: add comparison and synthetic image helpers"
```

---

### Task 6: Math Utilities

**Files:**
- Create: `src/math/math.ts`
- Create: `src/math/index.ts`
- Test: `test/math/math.test.ts`

Port from: `legacy/jsfeat_math.js`. Preserve the `get_gaussian_kernel`, `perspective_4point_transform`, `qsort`, and `median` functions exactly. These use `jsfeat.cache` — replace with imported `pool`.

- [ ] **Step 1: Write failing tests**

```typescript
// test/math/math.test.ts
import { describe, it, expect } from 'vitest';
import { getGaussianKernel, qsort, median } from '../../src/math/math';
import { DataType } from '../../src/core/types';

describe('getGaussianKernel', () => {
  it('size=1 returns [1.0] for float kernel', () => {
    const kernel = new Float64Array(1);
    getGaussianKernel(1, 0, kernel, DataType.F32);
    expect(kernel[0]).toBeCloseTo(1.0, 5);
  });

  it('size=3 returns known values for float kernel', () => {
    const kernel = new Float64Array(3);
    getGaussianKernel(3, 0, kernel, DataType.F32);
    expect(kernel[0]).toBeCloseTo(0.25, 5);
    expect(kernel[1]).toBeCloseTo(0.5, 5);
    expect(kernel[2]).toBeCloseTo(0.25, 5);
  });

  it('size=5 kernel sums to ~1.0', () => {
    const kernel = new Float64Array(5);
    getGaussianKernel(5, 0, kernel, DataType.F32);
    const sum = kernel.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('custom sigma produces valid kernel', () => {
    const kernel = new Float64Array(7);
    getGaussianKernel(7, 2.0, kernel, DataType.F32);
    const sum = kernel.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 4);
    // center should be largest
    expect(kernel[3]).toBeGreaterThan(kernel[0]);
  });

  it('U8 kernel returns integer values', () => {
    const kernel = new Int32Array(3);
    getGaussianKernel(3, 0, kernel, DataType.U8);
    // Should sum to ~256
    const sum = kernel[0] + kernel[1] + kernel[2];
    expect(sum).toBeGreaterThanOrEqual(254);
    expect(sum).toBeLessThanOrEqual(258);
  });
});

describe('qsort', () => {
  it('sorts an array of numbers', () => {
    const arr = [5, 3, 8, 1, 9, 2];
    qsort(arr, 0, arr.length - 1, (a, b) => a < b);
    expect(arr).toEqual([1, 2, 3, 5, 8, 9]);
  });

  it('handles already sorted array', () => {
    const arr = [1, 2, 3, 4, 5];
    qsort(arr, 0, arr.length - 1, (a, b) => a < b);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles single element', () => {
    const arr = [42];
    qsort(arr, 0, 0, (a, b) => a < b);
    expect(arr).toEqual([42]);
  });

  it('handles reverse sorted', () => {
    const arr = [5, 4, 3, 2, 1];
    qsort(arr, 0, arr.length - 1, (a, b) => a < b);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });

  it('sorts objects by property', () => {
    const arr = [{ score: 3 }, { score: 1 }, { score: 2 }];
    qsort(arr, 0, arr.length - 1, (a, b) => a.score < b.score);
    expect(arr.map((a) => a.score)).toEqual([1, 2, 3]);
  });
});

describe('median', () => {
  it('finds median of odd-length array', () => {
    const arr = [5, 3, 8, 1, 9];
    const result = median(arr, 0, arr.length - 1);
    expect(result).toBe(5);
  });

  it('finds median of even-length array', () => {
    const arr = [5, 3, 8, 1];
    const result = median(arr, 0, arr.length - 1);
    // median selects the lower-middle element
    expect(result).toBe(3);
  });

  it('single element returns itself', () => {
    const arr = [42];
    expect(median(arr, 0, 0)).toBe(42);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/math/math.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement math.ts**

Port the functions from `legacy/jsfeat_math.js` directly. Key changes:
- Replace `jsfeat.cache.get_buffer` / `put_buffer` with imported `pool.get` / `pool.release`
- Replace `jsfeat.U8_t` with imported `DataType.U8`
- Convert `var` to `let`/`const`
- Add TypeScript types to function signatures
- Keep all algorithm logic identical

Read `legacy/jsfeat_math.js` and port line by line into `src/math/math.ts`. The functions to port are: `get_gaussian_kernel`, `perspective_4point_transform`, `qsort`, `median`.

Export as: `getGaussianKernel`, `perspective4PointTransform`, `qsort`, `median`.

```typescript
// src/math/math.ts
import { pool } from '../core/cache';
import { DataType } from '../core/types';
import type { Matrix } from '../core/matrix';

const qsortStack = new Int32Array(48 * 2);

export function getGaussianKernel(
  size: number,
  sigma: number,
  kernel: { [index: number]: number },
  dataType: number,
): void {
  // Port from legacy/jsfeat_math.js get_gaussian_kernel — preserve logic exactly
  let i = 0;
  let x = 0.0;
  let t = 0.0;
  let sigmaX = 0.0;
  let scale2x = 0.0;
  let sum = 0.0;

  const kernNode = pool.get(size << 2);
  const _kernel = kernNode.f32;

  if ((size & 1) === 1 && size <= 7 && sigma <= 0) {
    switch (size >> 1) {
      case 0:
        _kernel[0] = 1.0;
        sum = 1.0;
        break;
      case 1:
        _kernel[0] = 0.25;
        _kernel[1] = 0.5;
        _kernel[2] = 0.25;
        sum = 0.25 + 0.5 + 0.25;
        break;
      case 2:
        _kernel[0] = 0.0625;
        _kernel[1] = 0.25;
        _kernel[2] = 0.375;
        _kernel[3] = 0.25;
        _kernel[4] = 0.0625;
        sum = 0.0625 + 0.25 + 0.375 + 0.25 + 0.0625;
        break;
      case 3:
        _kernel[0] = 0.03125;
        _kernel[1] = 0.109375;
        _kernel[2] = 0.21875;
        _kernel[3] = 0.28125;
        _kernel[4] = 0.21875;
        _kernel[5] = 0.109375;
        _kernel[6] = 0.03125;
        sum = 0.03125 + 0.109375 + 0.21875 + 0.28125 + 0.21875 + 0.109375 + 0.03125;
        break;
    }
  } else {
    sigmaX = sigma > 0 ? sigma : (size - 1) * 0.5 - 1.0 * 0.3 + 0.8;
    scale2x = -0.5 / (sigmaX * sigmaX);
    for (; i < size; ++i) {
      x = i - (size - 1) * 0.5;
      t = Math.exp(scale2x * x * x);
      _kernel[i] = t;
      sum += t;
    }
  }

  if (dataType & DataType.U8) {
    sum = 256.0 / sum;
    for (i = 0; i < size; ++i) {
      kernel[i] = (_kernel[i] * sum + 0.5) | 0;
    }
  } else {
    sum = 1.0 / sum;
    for (i = 0; i < size; ++i) {
      kernel[i] = _kernel[i] * sum;
    }
  }

  pool.release(kernNode);
}

export function perspective4PointTransform(
  model: Matrix,
  srcX0: number, srcY0: number, dstX0: number, dstY0: number,
  srcX1: number, srcY1: number, dstX1: number, dstY1: number,
  srcX2: number, srcY2: number, dstX2: number, dstY2: number,
  srcX3: number, srcY3: number, dstX3: number, dstY3: number,
): void {
  // Port from legacy/jsfeat_math.js perspective_4point_transform
  // This is a large block of algebraic computation — port line-by-line from legacy
  // Read legacy/jsfeat_math.js lines 73-187 and copy the logic exactly,
  // replacing var with let/const. The variable names (t1, t2, Hr0, Hl0, etc.) must match.
  // Final result writes to model.data[0..8]
  let t1 = srcX0;
  let t2 = srcX2;
  let t4 = srcY1;
  let t5 = t1 * t2 * t4;
  let t6 = srcY3;
  let t7 = t1 * t6;
  let t8 = t2 * t7;
  let t9 = srcY2;
  let t10 = t1 * t9;
  let t11 = srcX1;
  let t14 = srcY0;
  let t15 = srcX3;
  let t16 = t14 * t15;
  let t18 = t16 * t11;
  let t20 = t15 * t11 * t9;
  let t21 = t15 * t4;
  let t24 = t15 * t9;
  let t25 = t2 * t4;
  let t26 = t6 * t2;
  let t27 = t6 * t11;
  let t28 = t9 * t11;
  let t30 = 1.0 / (t21 - t24 - t25 + t26 - t27 + t28);
  let t32 = t1 * t15;
  let t35 = t14 * t11;
  let t41 = t4 * t1;
  let t42 = t6 * t41;
  let t43 = t14 * t2;
  let t46 = t16 * t9;
  let t48 = t14 * t9 * t11;
  let t51 = t4 * t6 * t2;
  let t55 = t6 * t14;
  const Hr0 = -(t8 - t5 + t10 * t11 - t11 * t7 - t16 * t2 + t18 - t20 + t21 * t2) * t30;
  const Hr1 = (t5 - t8 - t32 * t4 + t32 * t9 + t18 - t2 * t35 + t27 * t2 - t20) * t30;
  const Hr2 = t1;
  const Hr3 = (-t9 * t7 + t42 + t43 * t4 - t16 * t4 + t46 - t48 + t27 * t9 - t51) * t30;
  const Hr4 = (-t42 + t41 * t9 - t55 * t2 + t46 - t48 + t55 * t11 + t51 - t21 * t9) * t30;
  const Hr5 = t14;
  const Hr6 = (-t10 + t41 + t43 - t35 + t24 - t21 - t26 + t27) * t30;
  const Hr7 = (-t7 + t10 + t16 - t43 + t27 - t28 - t21 + t25) * t30;

  t1 = dstX0; t2 = dstX2; t4 = dstY1;
  t5 = t1 * t2 * t4; t6 = dstY3; t7 = t1 * t6;
  t8 = t2 * t7; t9 = dstY2; t10 = t1 * t9;
  t11 = dstX1; t14 = dstY0; t15 = dstX3;
  t16 = t14 * t15; t18 = t16 * t11;
  t20 = t15 * t11 * t9; t21 = t15 * t4;
  t24 = t15 * t9; t25 = t2 * t4; t26 = t6 * t2;
  t27 = t6 * t11; t28 = t9 * t11;
  t30 = 1.0 / (t21 - t24 - t25 + t26 - t27 + t28);
  t32 = t1 * t15; t35 = t14 * t11;
  t41 = t4 * t1; t42 = t6 * t41; t43 = t14 * t2;
  t46 = t16 * t9; t48 = t14 * t9 * t11;
  t51 = t4 * t6 * t2; t55 = t6 * t14;
  const Hl0 = -(t8 - t5 + t10 * t11 - t11 * t7 - t16 * t2 + t18 - t20 + t21 * t2) * t30;
  const Hl1 = (t5 - t8 - t32 * t4 + t32 * t9 + t18 - t2 * t35 + t27 * t2 - t20) * t30;
  const Hl2 = t1;
  const Hl3 = (-t9 * t7 + t42 + t43 * t4 - t16 * t4 + t46 - t48 + t27 * t9 - t51) * t30;
  const Hl4 = (-t42 + t41 * t9 - t55 * t2 + t46 - t48 + t55 * t11 + t51 - t21 * t9) * t30;
  const Hl5 = t14;
  const Hl6 = (-t10 + t41 + t43 - t35 + t24 - t21 - t26 + t27) * t30;
  const Hl7 = (-t7 + t10 + t16 - t43 + t27 - t28 - t21 + t25) * t30;

  // R = Hl * inverse(Hr)
  t2 = Hr4 - Hr7 * Hr5;
  t4 = Hr0 * Hr4;
  t5 = Hr0 * Hr5;
  t7 = Hr3 * Hr1;
  t8 = Hr2 * Hr3;
  t10 = Hr1 * Hr6;
  const t12 = Hr2 * Hr6;
  t15 = 1.0 / (t4 - t5 * Hr7 - t7 + t8 * Hr7 + t10 * Hr5 - t12 * Hr4);
  t18 = -Hr3 + Hr5 * Hr6;
  const t23 = -Hr3 * Hr7 + Hr4 * Hr6;
  t28 = -Hr1 + Hr2 * Hr7;
  const t31 = Hr0 - t12;
  t35 = Hr0 * Hr7 - t10;
  t41 = -Hr1 * Hr5 + Hr2 * Hr4;
  const t44 = t5 - t8;
  const t47 = t4 - t7;
  t48 = t2 * t15;
  const t49 = t28 * t15;
  const t50 = t41 * t15;
  const mat = model.data;
  mat[0] = Hl0 * t48 + Hl1 * (t18 * t15) - Hl2 * (t23 * t15);
  mat[1] = Hl0 * t49 + Hl1 * (t31 * t15) - Hl2 * (t35 * t15);
  mat[2] = -Hl0 * t50 - Hl1 * (t44 * t15) + Hl2 * (t47 * t15);
  mat[3] = Hl3 * t48 + Hl4 * (t18 * t15) - Hl5 * (t23 * t15);
  mat[4] = Hl3 * t49 + Hl4 * (t31 * t15) - Hl5 * (t35 * t15);
  mat[5] = -Hl3 * t50 - Hl4 * (t44 * t15) + Hl5 * (t47 * t15);
  mat[6] = Hl6 * t48 + Hl7 * (t18 * t15) - t23 * t15;
  mat[7] = Hl6 * t49 + Hl7 * (t31 * t15) - t35 * t15;
  mat[8] = -Hl6 * t50 - Hl7 * (t44 * t15) + t47 * t15;
}

export function qsort<T>(array: T[], low: number, high: number, cmp: (a: T, b: T) => boolean): void {
  // Port from legacy/jsfeat_math.js qsort — preserve BSD qsort logic exactly
  // Read legacy/jsfeat_math.js lines 192-354 and port line-by-line
  const isortThresh = 7;
  let t: T;
  let ta: T, tb: T, tc: T;
  let sp = 0, left = 0, right = 0, i = 0, n = 0, m = 0, ptr = 0, ptr2 = 0, d = 0;
  let left0 = 0, left1 = 0, right0 = 0, right1 = 0, pivot = 0, a = 0, b = 0, c = 0, swapCnt = 0;
  const stack = qsortStack;

  if (high - low + 1 <= 1) return;

  stack[0] = low;
  stack[1] = high;

  while (sp >= 0) {
    left = stack[sp << 1];
    right = stack[(sp << 1) + 1];
    sp--;

    for (;;) {
      n = right - left + 1;

      if (n <= isortThresh) {
        for (ptr = left + 1; ptr <= right; ptr++) {
          for (ptr2 = ptr; ptr2 > left && cmp(array[ptr2], array[ptr2 - 1]); ptr2--) {
            t = array[ptr2];
            array[ptr2] = array[ptr2 - 1];
            array[ptr2 - 1] = t;
          }
        }
        break;
      } else {
        swapCnt = 0;
        left0 = left;
        right0 = right;
        pivot = left + (n >> 1);

        if (n > 40) {
          d = n >> 3;
          a = left; b = left + d; c = left + (d << 1);
          ta = array[a]; tb = array[b]; tc = array[c];
          left = cmp(ta, tb) ? (cmp(tb, tc) ? b : cmp(ta, tc) ? c : a) : (cmp(tc, tb) ? b : cmp(ta, tc) ? a : c);

          a = pivot - d; b = pivot; c = pivot + d;
          ta = array[a]; tb = array[b]; tc = array[c];
          pivot = cmp(ta, tb) ? (cmp(tb, tc) ? b : cmp(ta, tc) ? c : a) : (cmp(tc, tb) ? b : cmp(ta, tc) ? a : c);

          a = right - (d << 1); b = right - d; c = right;
          ta = array[a]; tb = array[b]; tc = array[c];
          right = cmp(ta, tb) ? (cmp(tb, tc) ? b : cmp(ta, tc) ? c : a) : (cmp(tc, tb) ? b : cmp(ta, tc) ? a : c);
        }

        a = left; b = pivot; c = right;
        ta = array[a]; tb = array[b]; tc = array[c];
        pivot = cmp(ta, tb) ? (cmp(tb, tc) ? b : cmp(ta, tc) ? c : a) : (cmp(tc, tb) ? b : cmp(ta, tc) ? a : c);

        if (pivot !== left0) {
          t = array[pivot]; array[pivot] = array[left0]; array[left0] = t;
          pivot = left0;
        }
        left = left1 = left0 + 1;
        right = right1 = right0;

        ta = array[pivot];
        for (;;) {
          while (left <= right && !cmp(ta, array[left])) {
            if (!cmp(array[left], ta)) {
              if (left > left1) {
                t = array[left1]; array[left1] = array[left]; array[left] = t;
              }
              swapCnt = 1;
              left1++;
            }
            left++;
          }
          while (left <= right && !cmp(array[right], ta)) {
            if (!cmp(ta, array[right])) {
              if (right < right1) {
                t = array[right1]; array[right1] = array[right]; array[right] = t;
              }
              swapCnt = 1;
              right1--;
            }
            right--;
          }
          if (left > right) break;
          t = array[left]; array[left] = array[right]; array[right] = t;
          swapCnt = 1;
          left++;
          right--;
        }

        if (swapCnt === 0) {
          left = left0; right = right0;
          for (ptr = left + 1; ptr <= right; ptr++) {
            for (ptr2 = ptr; ptr2 > left && cmp(array[ptr2], array[ptr2 - 1]); ptr2--) {
              t = array[ptr2]; array[ptr2] = array[ptr2 - 1]; array[ptr2 - 1] = t;
            }
          }
          break;
        }

        n = Math.min(left1 - left0, left - left1);
        m = (left - n) | 0;
        for (i = 0; i < n; ++i, ++m) {
          t = array[left0 + i]; array[left0 + i] = array[m]; array[m] = t;
        }

        n = Math.min(right0 - right1, right1 - right);
        m = (right0 - n + 1) | 0;
        for (i = 0; i < n; ++i, ++m) {
          t = array[left + i]; array[left + i] = array[m]; array[m] = t;
        }

        n = left - left1;
        m = right1 - right;
        if (n > 1) {
          if (m > 1) {
            if (n > m) {
              ++sp;
              stack[sp << 1] = left0;
              stack[(sp << 1) + 1] = left0 + n - 1;
              left = right0 - m + 1; right = right0;
            } else {
              ++sp;
              stack[sp << 1] = right0 - m + 1;
              stack[(sp << 1) + 1] = right0;
              left = left0; right = left0 + n - 1;
            }
          } else {
            left = left0; right = left0 + n - 1;
          }
        } else if (m > 1) {
          left = right0 - m + 1; right = right0;
        } else {
          break;
        }
      }
    }
  }
}

export function median(array: number[], low: number, high: number): number {
  // Port from legacy/jsfeat_math.js median — preserve logic exactly
  let w: number;
  let middle = 0, ll = 0, hh = 0;
  const med = (low + high) >> 1;
  for (;;) {
    if (high <= low) return array[med];
    if (high === low + 1) {
      if (array[low] > array[high]) {
        w = array[low]; array[low] = array[high]; array[high] = w;
      }
      return array[med];
    }
    middle = (low + high) >> 1;
    if (array[middle] > array[high]) {
      w = array[middle]; array[middle] = array[high]; array[high] = w;
    }
    if (array[low] > array[high]) {
      w = array[low]; array[low] = array[high]; array[high] = w;
    }
    if (array[middle] > array[low]) {
      w = array[middle]; array[middle] = array[low]; array[low] = w;
    }
    ll = low + 1;
    w = array[middle]; array[middle] = array[ll]; array[ll] = w;
    hh = high;
    for (;;) {
      do ++ll; while (array[low] > array[ll]);
      do --hh; while (array[hh] > array[low]);
      if (hh < ll) break;
      w = array[ll]; array[ll] = array[hh]; array[hh] = w;
    }
    w = array[low]; array[low] = array[hh]; array[hh] = w;
    if (hh <= med) low = ll;
    else if (hh >= med) high = hh - 1;
  }
}
```

- [ ] **Step 4: Create math index**

```typescript
// src/math/index.ts
export { getGaussianKernel, perspective4PointTransform, qsort, median } from './math';
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/math/math.test.ts`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/math/ test/math/math.test.ts
git commit -m "feat(math): port getGaussianKernel, perspective4PointTransform, qsort, median"
```

---

### Task 7: Matrix Arithmetic (matmath)

**Files:**
- Create: `src/math/matmath.ts`
- Modify: `src/math/index.ts` (add exports)
- Test: `test/math/matmath.test.ts`

Port from: `legacy/jsfeat_mat_math.js`. All functions operate on Matrix.data arrays. Port every function exactly.

- [ ] **Step 1: Write failing tests**

```typescript
// test/math/matmath.test.ts
import { describe, it, expect } from 'vitest';
import { identity, transpose, multiply, multiplyABt, multiplyAtB, multiplyAtA, multiplyAAt, identity3x3, invert3x3, multiply3x3, determinant3x3 } from '../../src/math/matmath';
import { Matrix } from '../../src/core/matrix';
import { F32C1 } from '../../src/core/types';
import { expectMatricesClose } from '../helpers/comparison';

describe('identity', () => {
  it('creates identity matrix', () => {
    const m = new Matrix(3, 3, F32C1);
    identity(m);
    expect(m.data[0]).toBe(1);
    expect(m.data[4]).toBe(1);
    expect(m.data[8]).toBe(1);
    expect(m.data[1]).toBe(0);
    expect(m.data[3]).toBe(0);
  });

  it('accepts custom diagonal value', () => {
    const m = new Matrix(3, 3, F32C1);
    identity(m, 5.0);
    expect(m.data[0]).toBe(5);
    expect(m.data[4]).toBe(5);
    expect(m.data[8]).toBe(5);
  });
});

describe('transpose', () => {
  it('transposes a 2x3 matrix to 3x2', () => {
    const A = new Matrix(3, 2, F32C1);
    A.data[0] = 1; A.data[1] = 2; A.data[2] = 3;
    A.data[3] = 4; A.data[4] = 5; A.data[5] = 6;
    const At = new Matrix(2, 3, F32C1);
    transpose(At, A);
    expect(At.data[0]).toBe(1);
    expect(At.data[1]).toBe(4);
    expect(At.data[2]).toBe(2);
    expect(At.data[3]).toBe(5);
    expect(At.data[4]).toBe(3);
    expect(At.data[5]).toBe(6);
  });
});

describe('multiply', () => {
  it('multiplies 2x2 identity by 2x2 matrix', () => {
    const I = new Matrix(2, 2, F32C1);
    identity(I);
    const A = new Matrix(2, 2, F32C1);
    A.data[0] = 1; A.data[1] = 2; A.data[2] = 3; A.data[3] = 4;
    const C = new Matrix(2, 2, F32C1);
    multiply(C, I, A);
    expect(C.data[0]).toBe(1);
    expect(C.data[1]).toBe(2);
    expect(C.data[2]).toBe(3);
    expect(C.data[3]).toBe(4);
  });

  it('multiplies two 2x2 matrices correctly', () => {
    const A = new Matrix(2, 2, F32C1);
    A.data[0] = 1; A.data[1] = 2; A.data[2] = 3; A.data[3] = 4;
    const B = new Matrix(2, 2, F32C1);
    B.data[0] = 5; B.data[1] = 6; B.data[2] = 7; B.data[3] = 8;
    const C = new Matrix(2, 2, F32C1);
    multiply(C, A, B);
    // [1*5+2*7, 1*6+2*8] = [19, 22]
    // [3*5+4*7, 3*6+4*8] = [43, 50]
    expect(C.data[0]).toBeCloseTo(19);
    expect(C.data[1]).toBeCloseTo(22);
    expect(C.data[2]).toBeCloseTo(43);
    expect(C.data[3]).toBeCloseTo(50);
  });
});

describe('invert3x3', () => {
  it('inverts a known 3x3 matrix', () => {
    const A = new Matrix(3, 3, F32C1);
    A.data[0] = 1; A.data[1] = 2; A.data[2] = 3;
    A.data[3] = 0; A.data[4] = 1; A.data[5] = 4;
    A.data[6] = 5; A.data[7] = 6; A.data[8] = 0;
    const Ai = new Matrix(3, 3, F32C1);
    invert3x3(A, Ai);
    // A * Ai should be identity
    const I = new Matrix(3, 3, F32C1);
    multiply(I, A, Ai);
    expect(I.data[0]).toBeCloseTo(1, 4);
    expect(I.data[4]).toBeCloseTo(1, 4);
    expect(I.data[8]).toBeCloseTo(1, 4);
    expect(I.data[1]).toBeCloseTo(0, 4);
  });
});

describe('determinant3x3', () => {
  it('computes correct determinant', () => {
    const det = determinant3x3(1, 2, 3, 0, 1, 4, 5, 6, 0);
    expect(det).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/math/matmath.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement matmath.ts**

Port every function from `legacy/jsfeat_mat_math.js`:
- `identity`, `transpose`, `multiply`, `multiply_ABt`, `multiply_AtB`, `multiply_AAt`, `multiply_AtA`
- `identity_3x3`, `invert_3x3`, `multiply_3x3`, `mat3x3_determinant`, `determinant_3x3`

Rename to camelCase. Keep all loop logic and index arithmetic identical. Replace `var` with `let`/`const`, add TypeScript types to params.

Read `legacy/jsfeat_mat_math.js` and port line by line into `src/math/matmath.ts`.

- [ ] **Step 4: Add exports to math/index.ts**

```typescript
export { identity, transpose, multiply, multiplyABt, multiplyAtB, multiplyAtA, multiplyAAt, identity3x3, invert3x3, multiply3x3, mat3x3Determinant, determinant3x3 } from './matmath';
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/math/matmath.test.ts`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/math/matmath.ts src/math/index.ts test/math/matmath.test.ts
git commit -m "feat(math): port matrix arithmetic — identity, transpose, multiply, invert, determinant"
```

---

### Task 8: Linear Algebra

**Files:**
- Create: `src/math/linalg.ts`
- Modify: `src/math/index.ts`
- Test: `test/math/linalg.test.ts`

Port from: `legacy/jsfeat_linalg.js`. This contains: `lu_solve`, `cholesky_solve`, `svd_decompose`, `svd_solve`, `svd_invert`, `eigenVV`, plus private helpers `JacobiImpl` and `JacobiSVDImpl`.

- [ ] **Step 1: Write failing tests**

```typescript
// test/math/linalg.test.ts
import { describe, it, expect } from 'vitest';
import { luSolve, choleskySolve, svdDecompose, svdSolve, eigenVV } from '../../src/math/linalg';
import { multiply, identity } from '../../src/math/matmath';
import { Matrix } from '../../src/core/matrix';
import { F32C1, F64C1, SVD_U_T, SVD_V_T } from '../../src/core/types';
import { expectArrayClose } from '../helpers/comparison';

describe('luSolve', () => {
  it('solves Ax=b for known 3x3 system', () => {
    // A = [[2,1,-1],[-3,-1,2],[-2,1,2]], b = [8,-11,-3]
    // solution: x = [2, 3, -1]
    const A = new Matrix(3, 3, F64C1);
    A.data[0] = 2; A.data[1] = 1; A.data[2] = -1;
    A.data[3] = -3; A.data[4] = -1; A.data[5] = 2;
    A.data[6] = -2; A.data[7] = 1; A.data[8] = 2;
    const B = new Matrix(1, 3, F64C1);
    B.data[0] = 8; B.data[1] = -11; B.data[2] = -3;
    const result = luSolve(A, B);
    expect(result).toBe(1);
    expect(B.data[0]).toBeCloseTo(2, 5);
    expect(B.data[1]).toBeCloseTo(3, 5);
    expect(B.data[2]).toBeCloseTo(-1, 5);
  });
});

describe('svdDecompose', () => {
  it('decomposes a 3x3 matrix and reconstructs it', () => {
    const A = new Matrix(3, 3, F64C1);
    A.data[0] = 1; A.data[1] = 2; A.data[2] = 3;
    A.data[3] = 4; A.data[4] = 5; A.data[5] = 6;
    A.data[6] = 7; A.data[7] = 8; A.data[8] = 10;
    const W = new Matrix(1, 3, F64C1);
    const U = new Matrix(3, 3, F64C1);
    const V = new Matrix(3, 3, F64C1);
    svdDecompose(A, W, U, V, 0);
    // singular values should be positive and descending
    expect(W.data[0]).toBeGreaterThan(W.data[1]);
    expect(W.data[1]).toBeGreaterThan(0);
  });

  it('singular values of identity are all 1', () => {
    const A = new Matrix(3, 3, F64C1);
    identity(A);
    const W = new Matrix(1, 3, F64C1);
    const U = new Matrix(3, 3, F64C1);
    const V = new Matrix(3, 3, F64C1);
    svdDecompose(A, W, U, V, 0);
    expect(W.data[0]).toBeCloseTo(1, 5);
    expect(W.data[1]).toBeCloseTo(1, 5);
    expect(W.data[2]).toBeCloseTo(1, 5);
  });
});

describe('eigenVV', () => {
  it('computes eigenvalues of a symmetric 2x2 matrix', () => {
    // [[2, 1], [1, 2]] has eigenvalues 3 and 1
    const A = new Matrix(2, 2, F64C1);
    A.data[0] = 2; A.data[1] = 1;
    A.data[2] = 1; A.data[3] = 2;
    const vects = new Matrix(2, 2, F64C1);
    const vals = new Matrix(1, 2, F64C1);
    eigenVV(A, vects, vals);
    expect(vals.data[0]).toBeCloseTo(3, 5);
    expect(vals.data[1]).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/math/linalg.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement linalg.ts**

Port from `legacy/jsfeat_linalg.js`. Key changes:
- Replace `jsfeat.cache.get_buffer` / `put_buffer` with imported `pool.get` / `pool.release`
- Replace `jsfeat.EPSILON`, `jsfeat.FLT_MIN` with imported constants
- Replace `jsfeat.matrix_t` with `Matrix`, `jsfeat.matmath` with imported matmath functions
- Replace `jsfeat.C1_t` with `Channel.C1`, `jsfeat.SVD_U_T/V_T` with imported constants
- Port private `swap`, `hypot`, `JacobiImpl`, `JacobiSVDImpl` as module-level functions
- Rename exports: `lu_solve` → `luSolve`, `cholesky_solve` → `choleskySolve`, `svd_decompose` → `svdDecompose`, `svd_solve` → `svdSolve`, `svd_invert` → `svdInvert`, `eigenVV` → `eigenVV`
- Keep all numerical logic identical

- [ ] **Step 4: Add exports to math/index.ts**

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/math/linalg.test.ts`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/math/linalg.ts src/math/index.ts test/math/linalg.test.ts
git commit -m "feat(math): port linear algebra — LU, Cholesky, SVD, eigenvalues"
```

---

### Task 9: Image Processing

**Files:**
- Create: `src/imgproc/imgproc.ts`
- Create: `src/imgproc/index.ts`
- Test: `test/imgproc/imgproc.test.ts`

Port from: `legacy/jsfeat_imgproc.js` (~1,254 lines — the largest module). Functions: `grayscale`, `resample`, `pyrdown`, `box_blur_gray`, `gaussian_blur`, `canny_edges`, `sobel_derivatives`, `scharr_derivatives`, `equalize_histogram`, `compute_integral_image`.

- [ ] **Step 1: Write failing tests**

```typescript
// test/imgproc/imgproc.test.ts
import { describe, it, expect } from 'vitest';
import { grayscale, gaussianBlur, sobelDerivatives, scharrDerivatives, equalizeHistogram, pyrDown, boxBlurGray } from '../../src/imgproc/imgproc';
import { Matrix } from '../../src/core/matrix';
import { U8C1, S32C2, ColorCode } from '../../src/core/types';
import { filled, horizontalGradient, rgbaFromGray } from '../helpers/synthetic';

describe('grayscale', () => {
  it('converts RGBA to grayscale', () => {
    const gray = filled(4, 4, 128);
    const rgba = rgbaFromGray(gray);
    const dst = new Matrix(4, 4, U8C1);
    grayscale(rgba, 4, 4, dst, ColorCode.RGBA2GRAY);
    // For uniform gray RGBA, output should be ~128
    for (let i = 0; i < 16; i++) {
      expect(dst.data[i]).toBeGreaterThan(120);
      expect(dst.data[i]).toBeLessThan(136);
    }
  });

  it('pure white RGBA gives ~255 gray', () => {
    const rgba = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < 16; i++) {
      rgba[i * 4] = 255; rgba[i * 4 + 1] = 255; rgba[i * 4 + 2] = 255; rgba[i * 4 + 3] = 255;
    }
    const dst = new Matrix(4, 4, U8C1);
    grayscale(rgba, 4, 4, dst, ColorCode.RGBA2GRAY);
    for (let i = 0; i < 16; i++) {
      expect(dst.data[i]).toBeGreaterThan(250);
    }
  });
});

describe('gaussianBlur', () => {
  it('blurs an image without crashing', () => {
    const src = horizontalGradient(32, 32);
    const dst = new Matrix(32, 32, U8C1);
    gaussianBlur(src, dst, 3, 0);
    // center pixel should be close to gradient value
    expect(dst.data[16 * 32 + 16]).toBeGreaterThan(0);
  });

  it('blurring uniform image produces same uniform values', () => {
    const src = filled(16, 16, 100);
    const dst = new Matrix(16, 16, U8C1);
    gaussianBlur(src, dst, 5, 0);
    for (let i = 0; i < 256; i++) {
      expect(dst.data[i]).toBeGreaterThan(95);
      expect(dst.data[i]).toBeLessThan(105);
    }
  });
});

describe('equalizeHistogram', () => {
  it('produces output with full dynamic range', () => {
    const src = filled(32, 32, 100);
    // Set some variation
    for (let i = 0; i < 10; i++) src.data[i] = 0;
    for (let i = 10; i < 20; i++) src.data[i] = 255;
    const dst = new Matrix(32, 32, U8C1);
    equalizeHistogram(src, dst);
    // Output should span wider range
    let min = 255, max = 0;
    for (let i = 0; i < 32 * 32; i++) {
      if (dst.data[i] < min) min = dst.data[i];
      if (dst.data[i] > max) max = dst.data[i];
    }
    expect(max - min).toBeGreaterThan(50);
  });
});

describe('sobelDerivatives', () => {
  it('produces S32C2 output', () => {
    const src = horizontalGradient(32, 32);
    const dst = new Matrix(32, 32, S32C2);
    sobelDerivatives(src, dst);
    // Horizontal gradient should produce non-zero x-derivatives
    let hasNonZero = false;
    for (let i = 0; i < 32 * 32 * 2; i += 2) {
      if (dst.data[i] !== 0) hasNonZero = true;
    }
    expect(hasNonZero).toBe(true);
  });
});

describe('pyrDown', () => {
  it('halves dimensions', () => {
    const src = filled(32, 32, 128);
    const dst = new Matrix(16, 16, U8C1);
    pyrDown(src, dst);
    expect(dst.cols).toBe(16);
    expect(dst.rows).toBe(16);
    // uniform input should produce ~128 at all pixels
    for (let i = 0; i < 256; i++) {
      expect(dst.data[i]).toBeGreaterThan(120);
      expect(dst.data[i]).toBeLessThan(136);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/imgproc/imgproc.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement imgproc.ts**

Port from `legacy/jsfeat_imgproc.js`. This is the largest module — port each function individually:
- Private: `_resample_u8`, `_resample`, `_convol_u8`, `_convol`, internal blur/derivative helpers
- Public: `grayscale`, `resample`, `pyrdown`, `box_blur_gray`, `gaussian_blur`, `canny_edges`, `sobel_derivatives`, `scharr_derivatives`, `equalize_histogram`, `compute_integral_image`

Key changes:
- Replace all `jsfeat.cache` with imported `pool`
- Replace `jsfeat.U8_t` etc. with imported constants
- Convert `var` to `let`/`const`
- Add type annotations
- Keep all arithmetic and loop logic identical
- `grayscale` should accept `Uint8Array | Uint8ClampedArray` and take `width, height` params (since we don't have ImageData in Node test env)

- [ ] **Step 4: Create imgproc index**

```typescript
// src/imgproc/index.ts
export { grayscale, resample, pyrDown, boxBlurGray, gaussianBlur, cannyEdges, sobelDerivatives, scharrDerivatives, equalizeHistogram, computeIntegralImage } from './imgproc';
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/imgproc/imgproc.test.ts`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/imgproc/ test/imgproc/
git commit -m "feat(imgproc): port image processing — grayscale, blur, edges, derivatives, histogram"
```

---

### Task 10: Feature Detection (FAST, YAPE06, YAPE)

**Files:**
- Create: `src/features/fast.ts`
- Create: `src/features/yape06.ts`
- Create: `src/features/yape.ts`
- Create: `src/features/index.ts`
- Test: `test/features/fast.test.ts`
- Test: `test/features/yape.test.ts`

Port from: `legacy/jsfeat_fast_corners.js`, `legacy/jsfeat_yape06.js`, `legacy/jsfeat_yape.js`

- [ ] **Step 1: Write failing tests**

```typescript
// test/features/fast.test.ts
import { describe, it, expect } from 'vitest';
import { fastCorners } from '../../src/features/fast';
import { Keypoint } from '../../src/core/keypoint';
import { checkerboard, filled } from '../helpers/synthetic';

describe('fastCorners', () => {
  it('detects corners in checkerboard pattern', () => {
    const src = checkerboard(64, 64, 8);
    const points = Array.from({ length: 500 }, () => new Keypoint());
    const count = fastCorners(src, points, 20, 3);
    expect(count).toBeGreaterThan(0);
  });

  it('finds no corners in uniform image', () => {
    const src = filled(64, 64, 128);
    const points = Array.from({ length: 100 }, () => new Keypoint());
    const count = fastCorners(src, points, 20, 3);
    expect(count).toBe(0);
  });

  it('corners have valid coordinates', () => {
    const src = checkerboard(64, 64, 8);
    const points = Array.from({ length: 500 }, () => new Keypoint());
    const count = fastCorners(src, points, 20, 3);
    for (let i = 0; i < count; i++) {
      expect(points[i].x).toBeGreaterThanOrEqual(0);
      expect(points[i].x).toBeLessThan(64);
      expect(points[i].y).toBeGreaterThanOrEqual(0);
      expect(points[i].y).toBeLessThan(64);
      expect(points[i].score).toBeGreaterThan(0);
    }
  });
});
```

```typescript
// test/features/yape.test.ts
import { describe, it, expect } from 'vitest';
import { yape06Detect } from '../../src/features/yape06';
import { Keypoint } from '../../src/core/keypoint';
import { checkerboard, filled } from '../helpers/synthetic';

describe('yape06Detect', () => {
  it('detects keypoints in checkerboard', () => {
    const src = checkerboard(64, 64, 8);
    const points = Array.from({ length: 500 }, () => new Keypoint());
    const count = yape06Detect(src, points, 5);
    expect(count).toBeGreaterThan(0);
  });

  it('finds no keypoints in uniform image', () => {
    const src = filled(64, 64, 128);
    const points = Array.from({ length: 100 }, () => new Keypoint());
    const count = yape06Detect(src, points, 5);
    expect(count).toBe(0);
  });
});
```

- [ ] **Step 2: Implement FAST, YAPE06, YAPE**

Port each from the corresponding legacy file. Key changes:
- Replace `jsfeat.cache` with `pool`
- Convert `var` to `let`/`const`, add types
- Preserve all threshold tables, offset arrays, and scoring logic exactly
- `fastCorners` function takes `(src, points, threshold, border)` and returns count
- `yape06Detect` takes `(src, points, border)` with configurable thresholds
- `yape` is more complex — port from `legacy/jsfeat_yape.js`, preserve multi-level detection

- [ ] **Step 3: Create features index**

```typescript
// src/features/index.ts
export { fastCorners } from './fast';
export { yape06Detect } from './yape06';
export { yapeDetect } from './yape';
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/features/`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/ test/features/
git commit -m "feat(features): port FAST corners, YAPE06, YAPE keypoint detectors"
```

---

### Task 11: ORB Descriptor

**Files:**
- Create: `src/features/orb.ts`
- Modify: `src/features/index.ts`
- Test: `test/features/orb.test.ts`

Port from: `legacy/jsfeat_orb.js`. Contains the ORB bit pattern table and descriptor computation.

- [ ] **Step 1: Write failing test**

```typescript
// test/features/orb.test.ts
import { describe, it, expect } from 'vitest';
import { orbDescribe } from '../../src/features/orb';
import { fastCorners } from '../../src/features/fast';
import { gaussianBlur } from '../../src/imgproc/imgproc';
import { Keypoint } from '../../src/core/keypoint';
import { Matrix } from '../../src/core/matrix';
import { U8C1, S32C1 } from '../../src/core/types';
import { checkerboard } from '../helpers/synthetic';

describe('orbDescribe', () => {
  it('computes descriptors for detected corners', () => {
    const src = checkerboard(64, 64, 8);
    const blurred = new Matrix(64, 64, U8C1);
    gaussianBlur(src, blurred, 5, 0);
    const points = Array.from({ length: 200 }, () => new Keypoint());
    const count = fastCorners(src, points, 20, 3);
    if (count > 0) {
      const descriptors = new Matrix(32, count, S32C1);
      orbDescribe(blurred, points, count, descriptors);
      // Descriptors should have non-zero values
      let hasNonZero = false;
      for (let i = 0; i < count * 32; i++) {
        if (descriptors.data[i] !== 0) hasNonZero = true;
      }
      expect(hasNonZero).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Implement and test**

Port from `legacy/jsfeat_orb.js`. The file contains a large bit_pattern_31 lookup table — port it as a const array.

- [ ] **Step 3: Commit**

```bash
git add src/features/orb.ts src/features/index.ts test/features/orb.test.ts
git commit -m "feat(features): port ORB descriptor"
```

---

### Task 12: Optical Flow (Lucas-Kanade)

**Files:**
- Create: `src/flow/lucasKanade.ts`
- Create: `src/flow/index.ts`
- Test: `test/flow/lucasKanade.test.ts`

Port from: `legacy/jsfeat_optical_flow_lk.js`

- [ ] **Step 1: Write failing test**

```typescript
// test/flow/lucasKanade.test.ts
import { describe, it, expect } from 'vitest';
import { lucasKanade } from '../../src/flow/lucasKanade';
import { Pyramid } from '../../src/core/pyramid';
import { Matrix } from '../../src/core/matrix';
import { U8C1 } from '../../src/core/types';
import { pyrDown } from '../../src/imgproc/imgproc';
import { square } from '../helpers/synthetic';

describe('lucasKanade', () => {
  it('tracks a translated square', () => {
    const w = 64, h = 64;
    // Frame 1: square at (10,10)
    const frame1 = square(w, h, 10, 10, 15);
    // Frame 2: square at (13,12) — shifted by (3,2)
    const frame2 = square(w, h, 13, 12, 15);

    const prevPyr = new Pyramid(2);
    prevPyr.allocate(w, h, U8C1);
    prevPyr.pyrdown = pyrDown;
    prevPyr.data[0] = frame1;
    prevPyr.build(frame1, true);

    const currPyr = new Pyramid(2);
    currPyr.allocate(w, h, U8C1);
    currPyr.pyrdown = pyrDown;
    currPyr.data[0] = frame2;
    currPyr.build(frame2, true);

    // Track center of square
    const prevXY = new Float32Array([17.5, 17.5]);
    const currXY = new Float32Array(2);
    const status = new Uint8Array(1);

    lucasKanade(prevPyr, currPyr, prevXY, currXY, 1, 15, 30, status, 0.01, 0.0001);

    expect(status[0]).toBe(1);
    // Should track near (20.5, 19.5)
    expect(currXY[0]).toBeCloseTo(20.5, 0);
    expect(currXY[1]).toBeCloseTo(19.5, 0);
  });
});
```

- [ ] **Step 2: Implement**

Port from `legacy/jsfeat_optical_flow_lk.js`. Replace `jsfeat.imgproc.scharr_derivatives` with imported function. Replace `jsfeat.cache` with `pool`. Keep all fixed-point math (W_BITS14, etc.) identical.

- [ ] **Step 3: Commit**

```bash
git add src/flow/ test/flow/
git commit -m "feat(flow): port Lucas-Kanade optical flow"
```

---

### Task 13: Object Detection (HAAR, BBF)

**Files:**
- Create: `src/detect/haar.ts`
- Create: `src/detect/bbf.ts`
- Create: `src/detect/index.ts`
- Test: `test/detect/haar.test.ts`
- Test: `test/detect/bbf.test.ts`

Port from: `legacy/jsfeat_haar.js`, `legacy/jsfeat_bbf.js`

- [ ] **Step 1: Write failing tests**

```typescript
// test/detect/haar.test.ts
import { describe, it, expect } from 'vitest';
import { haarDetectSingleScale, haarDetectMultiScale, groupRectangles } from '../../src/detect/haar';

describe('groupRectangles', () => {
  it('groups overlapping rectangles', () => {
    const rects = [
      { x: 10, y: 10, width: 50, height: 50, neighbor: 1, confidence: 1 },
      { x: 12, y: 11, width: 50, height: 50, neighbor: 1, confidence: 1 },
      { x: 11, y: 10, width: 50, height: 50, neighbor: 1, confidence: 1 },
      { x: 200, y: 200, width: 50, height: 50, neighbor: 1, confidence: 1 },
    ];
    const grouped = groupRectangles(rects, 2);
    // Should group the first 3 into one, keep the 4th separate or drop it
    expect(grouped.length).toBeLessThan(4);
  });
});
```

```typescript
// test/detect/bbf.test.ts
import { describe, it, expect } from 'vitest';
import { bbfPrepareCascade } from '../../src/detect/bbf';

describe('bbfPrepareCascade', () => {
  it('exports without error', () => {
    expect(typeof bbfPrepareCascade).toBe('function');
  });
});
```

- [ ] **Step 2: Implement**

Port both files. HAAR uses integral images. BBF uses pyramid building. Keep all detection logic identical.

- [ ] **Step 3: Commit**

```bash
git add src/detect/ test/detect/
git commit -m "feat(detect): port HAAR cascade and BBF object detection"
```

---

### Task 14: Motion Estimation

**Files:**
- Create: `src/motion/models.ts`
- Create: `src/motion/estimator.ts`
- Create: `src/motion/index.ts`
- Test: `test/motion/estimator.test.ts`

Port from: `legacy/jsfeat_motion_estimator.js`

- [ ] **Step 1: Write failing tests**

```typescript
// test/motion/estimator.test.ts
import { describe, it, expect } from 'vitest';
import { ransac } from '../../src/motion/estimator';
import { homography2d } from '../../src/motion/models';
import { Matrix } from '../../src/core/matrix';
import { F32C1, F64C1 } from '../../src/core/types';

describe('ransac with homography2d', () => {
  it('recovers identity from identical point pairs', () => {
    // 4 pairs of identical points — homography should be identity
    const from = new Matrix(2, 4, F64C1);
    const to = new Matrix(2, 4, F64C1);
    const points = [0, 0, 100, 0, 100, 100, 0, 100];
    for (let i = 0; i < 8; i++) {
      from.data[i] = points[i];
      to.data[i] = points[i];
    }
    const model = new Matrix(3, 3, F64C1);
    const mask = new Matrix(1, 4, F64C1);
    const params = { size: 4, thresh: 3, eps: 0.5, prob: 0.99 };
    const ok = ransac(params, homography2d, from, to, model, mask, 1000);
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 2: Implement**

Port from `legacy/jsfeat_motion_estimator.js`. Split into:
- `models.ts`: `affine2d`, `homography2d` kernel objects
- `estimator.ts`: `ransac`, `lmeds` functions

- [ ] **Step 3: Commit**

```bash
git add src/motion/ test/motion/
git commit -m "feat(motion): port RANSAC, LMEDS, Affine2D, Homography2D"
```

---

### Task 15: Transforms

**Files:**
- Create: `src/transform/transform.ts`
- Create: `src/transform/index.ts`
- Test: `test/transform/transform.test.ts`

Port from: `legacy/jsfeat_transform.js`

- [ ] **Step 1: Write failing test**

```typescript
// test/transform/transform.test.ts
import { describe, it, expect } from 'vitest';
import { affine3PointTransform, invertAffineTransform } from '../../src/transform/transform';
import { Matrix } from '../../src/core/matrix';
import { F64C1 } from '../../src/core/types';

describe('affine3PointTransform', () => {
  it('identity transform for same points', () => {
    const model = new Matrix(3, 3, F64C1);
    affine3PointTransform(
      model,
      0, 0, 0, 0,
      1, 0, 1, 0,
      0, 1, 0, 1,
    );
    // Should produce identity-like transform
    expect(model.data[0]).toBeCloseTo(1, 4);
    expect(model.data[4]).toBeCloseTo(1, 4);
  });
});

describe('invertAffineTransform', () => {
  it('inversion of identity gives identity', () => {
    const src = [1, 0, 0, 0, 1, 0];
    const dst = new Array(6);
    invertAffineTransform(src, dst);
    expect(dst[0]).toBeCloseTo(1, 5);
    expect(dst[4]).toBeCloseTo(1, 5);
    expect(dst[2]).toBeCloseTo(0, 5);
    expect(dst[5]).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: Implement and test**

- [ ] **Step 3: Commit**

```bash
git add src/transform/ test/transform/
git commit -m "feat(transform): port affine and perspective transforms"
```

---

### Task 16: Cascades

**Files:**
- Create: `src/cascades/frontalface.ts`, `profileface.ts`, `eye.ts`, `mouth.ts`, `upperbody.ts`, `handopen.ts`, `handfist.ts`, `bbfFace.ts`, `index.ts`

Port from: `cascades/*.js` — these are large data files. Convert each to a typed export.

- [ ] **Step 1: Convert cascade files**

For each cascade file in `cascades/`, read it and export the data object as a typed constant:

```typescript
// src/cascades/frontalface.ts
export const frontalface = { /* paste cascade data */ } as const;
```

The cascade data is a large JSON-like structure. Keep it as-is, just add TypeScript export and type annotation.

- [ ] **Step 2: Create cascades index**

```typescript
// src/cascades/index.ts
export { frontalface } from './frontalface';
export { profileface } from './profileface';
export { eye } from './eye';
export { mouth } from './mouth';
export { upperbody } from './upperbody';
export { handopen } from './handopen';
export { handfist } from './handfist';
export { bbfFace } from './bbfFace';
```

- [ ] **Step 3: Verify build works**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/cascades/
git commit -m "feat(cascades): port detector cascade data files"
```

---

### Task 17: Stub Index Files & Build Verification

**Files:**
- Ensure all `src/*/index.ts` files exist and export correctly

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run Vite build**

Run: `npx vite build`
Expected: `dist/` directory created with all module entry points.

- [ ] **Step 4: Verify subpath exports resolve**

Create a quick test script:
```bash
node -e "import('file://$(pwd)/dist/core/index.js').then(m => console.log(Object.keys(m)))"
```
Expected: Prints exported names.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: verify full build and test suite passes"
```

---

### Task 18: TSDoc Comments

**Files:**
- Modify: all `src/**/*.ts` files

- [ ] **Step 1: Add TSDoc to all public exports**

For every exported function, class, and constant, add a TSDoc comment describing:
- What it does (one line)
- Parameters and return value
- Algorithm source (where applicable, e.g., "FAST corner detector by Edward Rosten")

Example:
```typescript
/**
 * Detect FAST corners in a grayscale image.
 *
 * Based on: "Machine learning for high-speed corner detection" by E. Rosten and T. Drummond.
 *
 * @param src - Input grayscale image (U8C1)
 * @param points - Pre-allocated array of Keypoint objects to fill
 * @param threshold - Intensity difference threshold (0-255, default 20)
 * @param border - Pixels to skip from image border (default 3)
 * @returns Number of corners detected
 */
export function fastCorners(src: Matrix, points: Keypoint[], threshold = 20, border = 3): number {
```

- [ ] **Step 2: Run TypeDoc**

Run: `npx typedoc --entryPoints src/core/index.ts src/math/index.ts src/imgproc/index.ts src/features/index.ts src/flow/index.ts src/detect/index.ts src/motion/index.ts src/transform/index.ts src/cascades/index.ts --out docs/api`
Expected: `docs/api/` populated with HTML docs.

- [ ] **Step 3: Commit**

```bash
git add src/ docs/
git commit -m "docs: add TSDoc comments to all public API and generate TypeDoc"
```

---

### Task 19: Examples

**Files:**
- Create: `examples/grayscale-conversion.ts`
- Create: `examples/edge-detection.ts`
- Create: `examples/corner-detection.ts`
- Create: `examples/face-detection.ts`
- Create: `examples/optical-flow.ts`
- Create: `examples/feature-matching.ts`
- Create: `examples/motion-estimation.ts`

- [ ] **Step 1: Write example scripts**

Each example should be a self-contained script showing practical usage. Example:

```typescript
// examples/grayscale-conversion.ts
import { Matrix, U8C1, ColorCode } from 'jsfeat/core';
import { grayscale } from 'jsfeat/imgproc';

// Get canvas and video elements
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const video = document.getElementById('video') as HTMLVideoElement;

// Setup webcam
navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  video.srcObject = stream;
  video.play();
  requestAnimationFrame(processFrame);
});

function processFrame() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Matrix(canvas.width, canvas.height, U8C1);
  grayscale(imageData.data, canvas.width, canvas.height, gray, ColorCode.RGBA2GRAY);
  // Write grayscale back
  for (let i = 0; i < gray.data.length; i++) {
    const v = gray.data[i];
    imageData.data[i * 4] = v;
    imageData.data[i * 4 + 1] = v;
    imageData.data[i * 4 + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  requestAnimationFrame(processFrame);
}
```

Write similar examples for each use case.

- [ ] **Step 2: Commit**

```bash
git add examples/
git commit -m "docs: add 7 standalone example scripts"
```

---

### Task 20: Demo SPA

**Files:**
- Create: `demo/index.html`
- Create: `demo/src/main.ts`
- Create: `demo/src/demos/grayscale.ts`
- Create: `demo/src/demos/edges.ts`
- Create: `demo/src/demos/corners.ts`
- Create: `demo/src/demos/faceDetect.ts`
- Create: `demo/src/demos/opticalFlow.ts`
- Create: `demo/src/demos/orb.ts`
- Create: `demo/src/ui/` (minimal UI components)
- Create: `demo/package.json`
- Create: `demo/vite.config.ts`
- Create: `demo/tsconfig.json`

- [ ] **Step 1: Create demo package.json**

```json
{
  "name": "jsfeat-demo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "jsfeat": "file:.."
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create demo vite config**

```typescript
// demo/vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  base: '/jsfeat/',
  build: {
    outDir: '../dist-demo',
  },
});
```

- [ ] **Step 3: Create demo HTML and main entry**

```html
<!-- demo/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>jsfeat Demo</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; display: flex; min-height: 100vh; }
    nav { width: 200px; background: #1a1a2e; color: white; padding: 1rem; }
    nav a { display: block; color: #ccc; text-decoration: none; padding: 0.5rem; border-radius: 4px; }
    nav a:hover, nav a.active { background: #16213e; color: white; }
    main { flex: 1; display: flex; align-items: center; justify-content: center; }
    canvas { max-width: 100%; }
  </style>
</head>
<body>
  <nav id="sidebar"></nav>
  <main>
    <canvas id="canvas" width="640" height="480"></canvas>
    <video id="video" style="display:none" autoplay playsinline></video>
  </main>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 4: Create demo main.ts with routing and individual demos**

Each demo module exports `setup(canvas, video)` and `teardown()` functions. `main.ts` handles navigation and webcam setup.

- [ ] **Step 5: Verify demo runs locally**

Run: `cd demo && npm install && npm run dev`
Expected: Opens in browser, webcam demos work.

- [ ] **Step 6: Commit**

```bash
git add demo/
git commit -m "feat(demo): add webcam-based demo SPA with 6 interactive demos"
```

---

### Task 21: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test:run
      - run: npm run build
```

- [ ] **Step 2: Create deploy workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run docs
      - run: cd demo && npm ci && npm run build
      - name: Combine outputs
        run: |
          mkdir -p _site
          cp -r dist-demo/* _site/
          mkdir -p _site/api
          cp -r docs/api/* _site/api/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions for CI and GitHub Pages deployment"
```

---

### Task 22: Cleanup & Final Verification

- [ ] **Step 1: Remove legacy directory**

```bash
rm -rf legacy/
```

- [ ] **Step 2: Run full test suite**

Run: `npm run test:run`
Expected: All tests pass.

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Clean build, no warnings.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 5: Update README.md**

Replace the old README with a modern one covering: installation, usage with subpath exports, API overview, examples, demo link, contributing, license.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: remove legacy source, update README for v1.0"
```
