import { useState, useEffect, useRef, type FC } from 'react'
import type { App } from '../registry/apps'
import {
  isLauncherAvailable,
  launchApp,
  getLaunchStatus,
  type LaunchStatus,
} from '../api/launcher'

interface Props {
  app: App
}

// LaunchStep conservado solo para la lógica de estado — no se renderiza

// ════════════════════════════════════════════════════════════════════════════
// AppFrame principal
// ════════════════════════════════════════════════════════════════════════════

const AppFrame: FC<Props> = ({ app }) => {
  // Inicia en 'launching' → splash visible de inmediato.
  const [loading,    setLoading]    = useState(false)
  const [errored,    setErrored]    = useState(false)
  const [offline,    setOffline]    = useState(false)
  const [launching,  setLaunching]  = useState(true)
  const [launchInfo, setLaunchInfo] = useState<LaunchStatus | null>(null)
  const [retryKey,   setRetryKey]   = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const pollRef   = useRef<number | null>(null)

  // ── Reset al cambiar de app ──────────────────────────────────────────────
  useEffect(() => {
    setLoading(false)
    setErrored(false)
    setOffline(false)
    setLaunching(true)
    setLaunchInfo(null)
    if (pollRef.current) clearInterval(pollRef.current)
  }, [app.id])

  // ── Limpieza al desmontar ────────────────────────────────────────────────
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // ── Preflight + launcher ─────────────────────────────────────────────────
  useEffect(() => {
    if (app.status !== 'active' || app.type !== 'iframe') return

    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1500)

    fetch(app.url, { mode: 'no-cors', cache: 'no-cache', signal: controller.signal })
      .then(() => {
        clearTimeout(timer)
        if (cancelled) return
        setLaunching(false)
        setLoading(true)
      })
      .catch(async () => {
        clearTimeout(timer)
        if (cancelled) return

        const launcherOk = await isLauncherAvailable()

        if (!launcherOk) {
          setLaunching(false)
          setOffline(true)
          return
        }

        try {
          await launchApp(app.id)
        } catch {
          setLaunching(false)
          setOffline(true)
          return
        }

        // Polling 800ms — la splash screen muestra el progreso en tiempo real
        pollRef.current = window.setInterval(async () => {
          if (cancelled) { clearInterval(pollRef.current!); return }
          try {
            const s = await getLaunchStatus(app.id)
            setLaunchInfo(s)   // actualiza los pasos en la splash screen

            if (s.done) {
              clearInterval(pollRef.current!)
              if (!cancelled) {
                setLaunching(false)
                setLoading(true)
                setRetryKey(k => k + 1)
              }
            }

            if (s.error) {
              clearInterval(pollRef.current!)
              if (!cancelled) {
                setLaunching(false)
                setOffline(true)
              }
            }
          } catch {
            // errores transitorios de red — continuar polling
          }
        }, 800)
      })

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [app.id, app.url, app.status, app.type, retryKey])

  function handleRetry() {
    setLoading(false)
    setErrored(false)
    setOffline(false)
    setLaunching(true)
    setLaunchInfo(null)
    setRetryKey(k => k + 1)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Renders — estados especiales
  // ══════════════════════════════════════════════════════════════════════════

  if (app.status === 'coming-soon') {
    return (
      <div className="frame-coming-soon">
        <div className="frame-coming-soon-icon">{app.icon}</div>
        <h3>{app.name}</h3>
        <p>{app.description}</p>
        <div className="status-badge coming-soon">Próximamente</div>
      </div>
    )
  }

  if (app.status === 'maintenance') {
    return (
      <div className="frame-error">
        <div className="frame-error-icon">🔧</div>
        <h3>En mantenimiento</h3>
        <p><strong>{app.name}</strong> está temporalmente fuera de servicio. Inténtalo más tarde.</p>
      </div>
    )
  }

  if (app.type === 'link') {
    return (
      <div className="frame-coming-soon">
        <div className="frame-coming-soon-icon">{app.icon}</div>
        <h3>{app.name}</h3>
        <p>{app.description}</p>
        <button className="btn-navy" onClick={() => window.open(app.url, '_blank')}>
          Abrir en nueva pestaña ↗
        </button>
      </div>
    )
  }

  if (offline) {
    return (
      <div className="frame-offline">
        <div className="frame-offline-icon">🔌</div>
        <h3>{app.name} no está disponible</h3>
        <p>
          No se pudo conectar con la aplicación.
          Si el Portal Launcher no está corriendo, iniciá el portal con <strong>START.bat</strong>.
        </p>
        <div className="frame-offline-actions">
          <button className="btn-navy" onClick={handleRetry}>↺ &nbsp;Reintentar</button>
          <button className="btn-outline" onClick={() => window.open(app.url, '_blank')}>
            Abrir en nueva pestaña ↗
          </button>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Render — iframe + splash screen de lanzamiento
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="app-frame-wrap">

      {/* Pantalla de carga — solo el reloj animado, centrado */}
      {(launching || (loading && !errored)) && (
        <div className="frame-loading-only" aria-label="Cargando…" aria-live="polite">
          <div className="launch-clock">
            <div className="launch-clock-hour" />
            <div className="launch-clock-minute" />
          </div>
        </div>
      )}

      {/* Error X-Frame-Options */}
      {errored && !launching && (
        <div className="frame-error">
          <div className="frame-error-icon">🚫</div>
          <h3>No se puede mostrar {app.name}</h3>
          <p>
            La app rechaza ser embebida (<code>X-Frame-Options: DENY</code>).
            Podés abrirla directamente en una nueva pestaña.
          </p>
          <button className="btn-navy" onClick={() => window.open(app.url, '_blank')}>
            Abrir {app.name} ↗
          </button>
        </div>
      )}

      {/* iframe — siempre en el DOM; la splash screen lo cubre durante el lanzamiento */}
      <iframe
        key={retryKey}
        ref={iframeRef}
        src={app.url}
        title={app.name}
        className="app-frame-iframe"
        style={{ display: errored ? 'none' : 'block' }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        onLoad={() => {
          setLoading(false)
          try {
            const doc = iframeRef.current?.contentDocument
            if (doc && doc.body && doc.body.childElementCount === 0 && !doc.body.innerHTML.trim()) {
              setErrored(true)
            }
          } catch {
            // cross-origin → asumimos que cargó bien
          }
        }}
        onError={() => { setLoading(false); setErrored(true) }}
      />
    </div>
  )
}

export default AppFrame
