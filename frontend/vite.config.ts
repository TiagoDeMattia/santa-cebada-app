import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Timestamp unico por build para que el browser siempre descargue el JS nuevo
const buildTime = Date.now()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${buildTime}.js`,
        chunkFileNames: `assets/[name]-[hash]-${buildTime}.js`,
        assetFileNames: `assets/[name]-[hash]-${buildTime}[extname]`,
      },
    },
  },
})
