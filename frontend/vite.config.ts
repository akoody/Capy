import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Axios uses baseURL `/api`; Nest has no global prefix, so paths are `/auth/login`, not `/api/auth/login`.
// This proxy is for local dev (`npm run dev`). In production, nginx (or similar) must forward `/api` to the backend.
const API_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001'

const buildId =
  process.env.BUILD_ID ||
  new Date().toISOString().replace('T', ' ').slice(0, 19)

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})