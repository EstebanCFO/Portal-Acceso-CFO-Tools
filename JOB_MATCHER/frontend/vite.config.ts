import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5003,
    // Todos los endpoints del backend Node.js :5002
    proxy: {
      '/api':          { target: 'http://localhost:5002', changeOrigin: true },
      '/upload':       { target: 'http://localhost:5002', changeOrigin: true },
      '/analyze':      { target: 'http://localhost:5002', changeOrigin: true },
      '/summarize':    { target: 'http://localhost:5002', changeOrigin: true },
      '/ask-question': { target: 'http://localhost:5002', changeOrigin: true },
    },
  },
})
