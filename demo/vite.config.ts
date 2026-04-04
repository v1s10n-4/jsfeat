import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  base: '/jsfeat/',
  build: {
    outDir: '../dist-demo',
  },
});
