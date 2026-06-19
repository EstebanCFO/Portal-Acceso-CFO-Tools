import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev: :5175 (el gateway portal_server.py ocupa :5174 y proxea aquí).
    // Accedé siempre vía http://localhost:5174 — no abrir :5175 directamente.
    port: 5175,
  },
})
