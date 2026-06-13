import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    proxy: {
      // Durante dev: /api/* → ASP.NET Core en :5055
      '/api': {
        target: 'http://localhost:5055',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separar react del chunk principal — reduce bundle inicial
        manualChunks(id: string) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
            return 'react-vendor'
          }
        },
      },
    },
  },
})
