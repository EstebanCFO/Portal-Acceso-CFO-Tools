import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// BASE_PATH: la ruta bajo la que vive la app tanto en dev (proxeada por el
// gateway) como en prod (build estático servido desde /apps/sound-catch/).
const BASE = '/apps/sound-catch/'

export default defineConfig({
  plugins: [react()],

  // base afecta el HTML generado por Vite y los paths de los assets.
  // En dev el servidor escucha en :5009 pero sirve desde BASE.
  base: BASE,

  server: {
    port: 5009,
    // Reescribe /api/sound-catch/... → http://localhost:5008/api/...
    // Permite usar el dev server standalone (python app.py en :5008)
    // con exactamente los mismos fetch paths que usa la app en el gateway.
    proxy: {
      // client.ts llama ${API}/api/... con API='/api/sound-catch'
      // → /api/sound-catch/api/health
      // Strip solo el prefijo /api/sound-catch → /api/health → :5008/api/health ✓
      '/api/sound-catch': {
        target:      'http://localhost:5008',
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/api\/sound-catch/, ''),
      },
    },
  },

  build: {
    outDir:      'dist',
    emptyOutDir: true,
  },

  test: {
    environment: 'jsdom',
    globals:     true,
    setupFiles:  ['./src/__tests__/setup.ts'],
  },
})
