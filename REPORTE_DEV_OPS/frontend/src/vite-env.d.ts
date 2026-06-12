/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL completa del portal shell — destino del postMessage al salir.
   *  Definir en frontend/.env para entornos hosteados.
   *  Por defecto: "http://localhost:5174" */
  readonly VITE_PORTAL_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
