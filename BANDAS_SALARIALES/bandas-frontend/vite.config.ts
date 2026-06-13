import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Durante dev: /api/... → ASP.NET Core en :5050
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separar recharts y react del chunk principal — reduce bundle inicial ~45%
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'recharts':     ['recharts'],
        },
      },
    },
  },
})
