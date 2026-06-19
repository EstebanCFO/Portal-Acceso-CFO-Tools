import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/apps/job-matcher/',
  server: {
    port: 5003,
    // Dev: /api/job-matcher/... → strip /api/job-matcher → localhost:5002/...
    // El backend Node.js tiene rutas mixtas (/api/health, /upload, /analyze…).
    // Con este rewrite, /api/job-matcher/upload → :5002/upload ✓
    //                   /api/job-matcher/api/health → :5002/api/health ✓
    proxy: {
      '/api/job-matcher': {
        target:      'http://localhost:5002',
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/api\/job-matcher/, ''),
      },
    },
  },
  build: {
    outDir:      'dist',
    emptyOutDir: true,
  },
})
