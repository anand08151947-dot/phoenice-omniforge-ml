import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import mockApi from './vite-mock-api'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useRealBackend = env.VITE_API_URL !== undefined && env.VITE_API_URL !== ''

  return {
    plugins: [
      react(),
      ...(useRealBackend ? [] : [mockApi()]),
    ],
    server: {
      proxy: useRealBackend
        ? {
            '/api': {
              target: env.VITE_API_URL || 'http://localhost:8000',
              changeOrigin: true,
            },
          }
        : {},
    },
  }
})
