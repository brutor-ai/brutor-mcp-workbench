import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    host: true,
    cors: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react'],
          pdf: ['pdfjs-dist'],
        },
      },
    },
    // Copy PDF.js worker to public directory
    copyPublicDir: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react', 'pdfjs-dist'],
  },
  // Ensure PDF.js worker is accessible
  assetsInclude: ['**/*.worker.js'],
});