import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist/chrome',
    target: 'chrome120',
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve('popup.html'),
        options: resolve('options.html'),
        background: resolve('src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
