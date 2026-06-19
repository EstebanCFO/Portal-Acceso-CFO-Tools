import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/apps/survey/',
  server: {
    port: 5176,
    // Dev: /api/survey/... → :5055/api/...
    proxy: {
      '/api/survey': {
        target:      'http://localhost:5055',
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/api\/survey/, '/api'),
      },
    },
  },
  build: {
    outDir:      'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
            return 'react-vendor'
          }
        },
      },
    },
  },
})
