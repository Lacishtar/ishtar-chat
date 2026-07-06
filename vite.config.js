import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'renderer-dashboard',
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: '../dist-dashboard',
    emptyOutDir: true,
  },
});
