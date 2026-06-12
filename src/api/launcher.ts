/**
 * launcher.ts
 * Cliente para el servicio portal-launcher (http://localhost:4999).
 * El launcher levanta el backend y frontend de cada app bajo demanda.
 */

const LAUNCHER = 'http://localhost:4999'

export type StepStatus = 'idle' | 'pending' | 'launching' | 'ready' | 'error'

export interface LaunchStatus {
  backend:       StepStatus
  frontend:      StepStatus
  done:          boolean
  error:         string | null
  backendLabel:  string
  frontendLabel: string
}

/** Verifica si el launcher está corriendo. Timeout: 2s. */
export async function isLauncherAvailable(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2000)
  try {
    const r = await fetch(`${LAUNCHER}/api/health`, { signal: controller.signal })
    return r.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Solicita al launcher que inicie el backend + frontend de la app. */
export async function launchApp(appId: string): Promise<void> {
  const r = await fetch(`${LAUNCHER}/api/launch/${appId}`, { method: 'POST' })
  if (!r.ok) throw new Error(`Launcher error: ${r.status}`)
}

/** Consulta el estado de lanzamiento de una app. */
export async function getLaunchStatus(appId: string): Promise<LaunchStatus> {
  const r = await fetch(`${LAUNCHER}/api/status/${appId}`)
  if (!r.ok) throw new Error(`Status error: ${r.status}`)
  return r.json()
}
