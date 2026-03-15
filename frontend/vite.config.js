import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite configuration for OneStopAnalytics
 * React 18 + Fast Refresh enabled for optimal development experience
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': 'http://127.0.0.1:8010',
      '/login': 'http://127.0.0.1:8010',
      '/signup': 'http://127.0.0.1:8010'
    }
  },
  build: {
    outDir: '../backend/static',
    sourcemap: false,
    emptyOutDir: true
  }
})
