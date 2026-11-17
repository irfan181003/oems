import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server on 5173; /api is proxied to the backend so the browser never makes a cross-origin call.
// API_TARGET (optional) points the proxy at another backend, e.g. API_TARGET=http://localhost:4001.
const target = process.env.API_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target, changeOrigin: false },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target, changeOrigin: false },
    },
  },
});
