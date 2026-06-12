/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Host donde corren el portal y las apps (sin protocolo ni puerto).
   *  Ej: "localhost", "192.168.1.100", "portal.cfotechlatam.com"
   *  Por defecto: "localhost" */
  readonly VITE_HOST: string

  /** Puerto del portal shell Vite. Por defecto: "5174" */
  readonly VITE_PORTAL_PORT: string

  /** Puerto del Portal Launcher Flask. Por defecto: "4999" */
  readonly VITE_LAUNCHER_PORT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
