import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/apps/bandas-salariales/',
  server: {
    port: 5173,
    // Dev: /api/bandas-salariales/... → :5050/api/...
    proxy: {
      '/api/bandas-salariales': {
        target:      'http://localhost:5050',
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/api\/bandas-salariales/, '/api'),
      },
    },
  },
  build: {
    outDir:      'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react-router-dom/')) {
            return 'react-vendor'
          }
          if (id.includes('/node_modules/recharts/')) {
            return 'recharts'
          }
        },
      },
    },
  },
})
