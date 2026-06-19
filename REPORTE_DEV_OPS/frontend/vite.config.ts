import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/apps/reporte-devops/',
  server: {
    port: 5001,
    // Dev: /api/reporte-devops/... → :5000/api/... (el backend Flask sigue en su puerto)
    proxy: {
      '/api/reporte-devops': {
        target:      'http://localhost:5000',
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/api\/reporte-devops/, '/api'),
      },
    },
  },
  build: {
    outDir:      'dist',
    emptyOutDir: true,
  },
})
