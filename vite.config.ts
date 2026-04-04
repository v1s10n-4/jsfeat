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
