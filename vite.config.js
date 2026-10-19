import { defineConfig } from 'vite';

// base './' so the build works under GitHub Pages' /mikdash/ subpath and locally.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  server: { host: '127.0.0.1' },
});
