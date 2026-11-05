import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' — чтобы сборка работала и в корне, и в подпапке (GitHub Pages /netmap-v2/)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
