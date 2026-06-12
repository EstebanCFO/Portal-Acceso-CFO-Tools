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
})
