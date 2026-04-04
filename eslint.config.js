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
    // Cascade data files contain auto-generated float literals that exceed
    // 64-bit precision -- this is harmless (runtime truncates) and cannot
    // be fixed without regenerating the data.
    files: ['src/cascades/*.ts'],
    rules: {
      'no-loss-of-precision': 'off',
    },
  },
  {
    // Legacy ported code uses ternary/comma side-effect patterns
    // (e.g. `cond ? (a=1,b=2) : (a=3,b=4)`) that are idiomatic in the
    // original C-style jsfeat source.  Rewriting would risk regressions
    // in numerically sensitive code.
    files: ['src/math/*.ts', 'src/imgproc/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
  {
    // Detection modules use `any` for cascade classifier structures that
    // come from JSON data with no formal schema.
    files: ['src/detect/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: ['dist/', 'legacy/', 'demo/', 'node_modules/'],
  },
);
