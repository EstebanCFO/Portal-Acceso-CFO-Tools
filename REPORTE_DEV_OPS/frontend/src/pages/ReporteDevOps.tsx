import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  Org, Proyecto, SprintsResult, SprintData,
  PdfFile, LogFile, GeneracionEstado,
} from '../types'
import {
  apiOrgs, apiProyectos, apiSprints,
  apiGenerar, apiEstado, apiHistorial,
  apiLogs, apiLogContenido, urlDescarga, apiSalir,
} from '../api/client'

// Detecta si la app corre embebida en el portal — evaluación estática
const IN_PORTAL = window.self !== window.top

// Estados cerrados — para colorear el dot de cada estado en la tarjeta
const ESTADOS_CERRADOS = new Set([
  'Closed', 'Done', 'Resolved', 'Completed',
  'Fixed', 'Removed', 'Resuelta', 'Finalizado',
])

// ── Componente: tarjeta de un sprint (current o anterior) ────────────────────
function SprintCard({ sprint, tipo }: { sprint: SprintData; tipo: 'current' | 'anterior' }) {
  const esCurrent  = tipo === 'current'
  const badge      = esCurrent
    ? <span className="badge badge-green">SPRINT ACTUAL</span>
    : <span className="badge badge-orange">SPRINT ANTERIOR</span>

  const tp = sprint.testplan

  return (
    <div className="card">
      {/* Cabecera */}
      <div className="sprint-card-header">
        <div className="sprint-card-header-left">
          {badge}
          <span className="sprint-nombre">{sprint.nombre}</span>
        </div>
        <span className="sprint-fechas">{sprint.inicio} → {sprint.fin}</span>
      </div>

      {/* Work Items */}
      <div className="sprint-section">
        <div className="sprint-section-title">Work Items</div>
        <div className="sprint-wi-grid">
          <div className="sprint-wi-card">
            <div className="sprint-wi-label">Total</div>
            <div className="sprint-wi-value">{sprint.workitems.total}</div>
          </div>
          <div className="sprint-wi-card">
            <div className="sprint-wi-label">Abiertas</div>
            <div className="sprint-wi-value open">{sprint.workitems.abiertas}</div>
          </div>
          <div className="sprint-wi-card">
            <div className="sprint-wi-label">Cerradas</div>
            <div className="sprint-wi-value closed">{sprint.workitems.cerradas}</div>
          </div>
        </div>

        {/* Detalle por estado */}
        {Object.keys(sprint.workitems.estados).length > 0 && (
          <div className="estados-list">
            {Object.entries(sprint.workitems.estados)
              .sort((a, b) => b[1] - a[1])
              .map(([estado, qty]) => {
                const pct    = sprint.workitems.total > 0
                  ? Math.round(qty / sprint.workitems.total * 100) : 0
                const cerrado = ESTADOS_CERRADOS.has(estado)
                return (
                  <div key={estado} className="estado-row">
                    <div className={`estado-dot ${cerrado ? 'closed' : 'open'}`} />
                    <span className="estado-nombre">{estado}</span>
                    <span className="estado-qty">{qty}</span>
                    <div className="estado-bar">
                      <div className="estado-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Test Plan */}
      <div className="sprint-section">
        <div className="sprint-section-title">Test Plan</div>
        {!tp.encontrado
          ? <span className="text-muted" style={{ fontSize: 13 }}>Sin planes de prueba activos</span>
          : (
            <>
              <div className="tp-plan-name">
                {tp.planNombre}
                {tp.totalPlanes > 1 && (
                  <span className="text-small text-muted" style={{ marginLeft: 8, fontWeight: 400 }}>
                    ({tp.totalPlanes} planes activos)
                  </span>
                )}
              </div>
              <div className="tp-rows">
                {/* Test Cases definidos */}
                <div className="tp-row">
                  <span className="tp-label">Test Cases definidos</span>
                  <span className="tp-value">{tp.total}</span>
                </div>
                {/* Test Points corridos */}
                <div className="tp-row">
                  <span className="tp-label">Test Points corridos</span>
                  <span className="tp-value">{tp.corridos} / {tp.total}</span>
                  <div className="progress-wrap" style={{ flex: 1 }}>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${tp.pctCorridos}%` }} />
                    </div>
                    <span className="progress-label">{tp.pctCorridos}%</span>
                  </div>
                </div>
                {/* Pass Rate */}
                <div className="tp-row">
                  <span className="tp-label">Pass Rate</span>
                  <span className="tp-value">{tp.pasados} / {tp.corridos}</span>
                  <div className="progress-wrap" style={{ flex: 1 }}>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${tp.pctPass}%`,
                        background: tp.pctPass >= 80
                          ? 'var(--green)' : tp.pctPass >= 50
                          ? 'var(--orange)' : 'var(--red)',
                      }} />
                    </div>
                    <span className="progress-label">{tp.pctPass}%</span>
                  </div>
                </div>
              </div>
            </>
          )}
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function ReporteDevOps() {
  // Filtros
  const [orgs,      setOrgs]      = useState<Org[]>([])
  const [orgSel,    setOrgSel]    = useState('')
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [proySel,   setProySel]   = useState('')

  // Datos de sprints
  const [sprintData,         setSprintData]         = useState<SprintsResult | null>(null)
  const [loadingSprintData,  setLoadingSprintData]  = useState(false)
  const [sprintError,        setSprintError]        = useState('')

  // Historial / Logs
  const [historial,  setHistorial]  = useState<PdfFile[]>([])
  const [logs,       setLogs]       = useState<LogFile[]>([])
  const [logContent, setLogContent] = useState('')
  const [logNombre,  setLogNombre]  = useState('')
  const [showLogs,   setShowLogs]   = useState(false)

  // Estado generación
  const [estado,   setEstado]   = useState<GeneracionEstado | null>(null)
  const pollingRef = useRef<number | null>(null)

  // Loaders
  const [loadingOrgs,  setLoadingOrgs]  = useState(true)   // true: carga inmediata al montar
  const [loadingProys, setLoadingProys] = useState(false)

  // ── Carga inicial ────────────────────────────────────────
  // Orgs se cargan consultando Azure DevOps (no desde .env).
  // El resto (historial, logs, estado) se carga en paralelo.
  useEffect(() => {
    void (async () => {
      try {
        const [h, l, e] = await Promise.all([
          apiHistorial(), apiLogs(), apiEstado(),
        ])
        setHistorial(h); setLogs(l); setEstado(e)
      } catch (err) {
        console.error(err)
      }
      try {
        const o = await apiOrgs()   // consulta Azure: perfil → cuentas
        setOrgs(o)
      } catch (err) {
        console.error('Error cargando orgs desde Azure:', err)
      } finally {
        setLoadingOrgs(false)
      }
    })()
  }, [])

  // ── Polling estado generación ─────────────────────────────
  const startPolling = useCallback(() => {
    if (pollingRef.current) return
    pollingRef.current = window.setInterval(async () => {
      try {
        const e = await apiEstado()
        setEstado(e)
        if (!e.corriendo) {
          stopPolling()
          void apiHistorial().then(setHistorial)
          void apiLogs().then(setLogs)
        }
      } catch { /* silencioso */ }
    }, 2000)
  }, [])

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  // ── Cambio org ───────────────────────────────────────────
  useEffect(() => {
    if (!orgSel) { setProyectos([]); setProySel(''); return }
    setLoadingProys(true)
    setProySel('')
    void apiProyectos(orgSel).then(p => { setProyectos(p); setLoadingProys(false) })
  }, [orgSel])

  // ── Cambio org o proyecto — limpia resultados anteriores ────
  useEffect(() => {
    setSprintData(null); setSprintError('')
  }, [orgSel, proySel])

  // ── Consultar ─────────────────────────────────────────────
  // Disparado por el botón "Consultar" — carga sprints del proyecto.
  const handleConsultar = async () => {
    if (!orgSel || !proySel) return
    setLoadingSprintData(true)
    setSprintData(null)
    setSprintError('')
    try {
      const data = await apiSprints(orgSel, proySel)
      setSprintData(data)
    } catch (err) {
      setSprintError(err instanceof Error ? err.message : 'Error al consultar sprints')
    } finally {
      setLoadingSprintData(false)
    }
  }

  // ── Generar informe ──────────────────────────────────────
  const handleGenerar = async () => {
    try {
      await apiGenerar()
      const e = await apiEstado()
      setEstado(e)
      startPolling()
    } catch (err) {
      console.error(err)
    }
  }

  // ── Ver log ──────────────────────────────────────────────
  const handleVerLog = async (nombre: string) => {
    try {
      const r = await apiLogContenido(nombre)
      setLogContent(r.contenido); setLogNombre(r.nombre)
      setShowLogs(true)
    } catch { /* silencioso */ }
  }

  // ── Salir ────────────────────────────────────────────────
  // window.confirm() está bloqueado en iframes cross-origin (Chrome lo suprime).
  // Flujo: bajar Flask vía apiSalir() → notificar al portal con postMessage →
  // el portal pide al launcher que mate backend+frontend → vuelve al Dashboard.
  const [saliendo, setSaliendo] = useState(false)

  const handleSalir = async () => {
    if (saliendo) return
    setSaliendo(true)
    try {
      await apiSalir()   // POST /api/salir → Flask baja con delay 800 ms
    } catch {
      // Puede no responder si Flask ya está cerrándose — está bien
    }
    // Notificar al portal shell para que limpie procesos y vuelva al Dashboard.
    // VITE_PORTAL_URL se configura en frontend/.env (default: http://localhost:5174).
    const portalUrl = import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:5174'
    window.parent.postMessage(
      { type: 'portal:goHome', appId: 'reporte-devops' },
      portalUrl,
    )
  }

  // ────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────

  const estadoClass =
    estado?.corriendo         ? 'running'
    : estado?.ultimo_estado === 'ok'    ? 'ok'
    : estado?.ultimo_estado === 'error' ? 'error'
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Toolbar ──────────────────────────────────────── */}
      <div className="toolbar">
        <label>Organización</label>
        <select value={orgSel} onChange={e => setOrgSel(e.target.value)} disabled={loadingOrgs}>
          <option value="">{loadingOrgs ? 'Cargando...' : '— seleccionar —'}</option>
          {orgs.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
        </select>

        <label>Proyectos</label>
        <select value={proySel} onChange={e => setProySel(e.target.value)} disabled={!orgSel || loadingProys}>
          <option value="">{loadingProys ? 'Cargando...' : '— seleccionar —'}</option>
          {proyectos.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
        </select>

        <button
          className="btn btn-navy btn-sm"
          onClick={handleConsultar}
          disabled={!orgSel || !proySel || loadingSprintData}
        >
          {loadingSprintData
            ? <><span className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> Consultando...</>
            : 'Consultar'}
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            className="btn btn-navy"
            onClick={handleGenerar}
            disabled={estado?.corriendo}
          >
            {estado?.corriendo
              ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Generando...</>
              : '⬇ Generar informe'}
          </button>
          {/* En modo portal el "← Volver" del portal shell cumple esta función */}
          {!IN_PORTAL && (
            <button className="btn btn-danger btn-sm" onClick={handleSalir} disabled={saliendo}>
              {saliendo ? 'Cerrando…' : 'Salir'}
            </button>
          )}
        </div>
      </div>

      {/* ── Estado generación ──────────────────────────────── */}
      {estado && estado.ultimo_estado !== 'idle' && (
        <div className={`estado-bar ${estadoClass}`}>
          {estado.corriendo && <span className="spinner" />}
          <span>{estado.ultimo_mensaje || 'Sin actividad'}</span>
          {estado.ultima_ejecucion && (
            <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 11, opacity: .7 }}>
              {estado.ultima_ejecucion}
            </span>
          )}
        </div>
      )}

      {/* ── Contenido principal ─────────────────────────────── */}
      <div className="page-content">

        {/* ── Welcome (sin org seleccionada) ──────────────────── */}
        {!orgSel && (
          <div className="section">
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <div className="section-title" style={{ fontSize: 18, marginBottom: 8 }}>
                Reporte Azure DevOps — Delivery Center
              </div>
              <p className="text-muted">
                Seleccioná una organización y un proyecto, luego presioná <strong>Consultar</strong>.
              </p>
              <div style={{ marginTop: 20, display: 'flex', gap: 24, justifyContent: 'center' }}>
                <div>
                  <div className="kpi-value" style={{ fontSize: 32 }}>{orgs.length}</div>
                  <div className="kpi-label">Organizaciones</div>
                </div>
                <div>
                  <div className="kpi-value" style={{ fontSize: 32 }}>{historial.length}</div>
                  <div className="kpi-label">Informes generados</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Hint (org seleccionada, sin proyecto o sin consultar) ─ */}
        {orgSel && !sprintData && !loadingSprintData && !sprintError && (
          <div className="empty-state">
            <strong>{proySel ? 'Presioná Consultar para ver los sprints' : 'Seleccioná un proyecto'}</strong>
          </div>
        )}

        {/* ── Cargando ─────────────────────────────────────────── */}
        {loadingSprintData && (
          <div className="empty-state">
            <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
            <strong>Consultando sprints en Azure DevOps...</strong>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Esto puede tardar unos segundos mientras se obtienen work items y test plans.
            </span>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────── */}
        {sprintError && (
          <div className="section">
            <div className="card" style={{ borderLeft: '4px solid var(--red)', padding: '16px 20px' }}>
              <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>Error al consultar</div>
              <div className="text-muted" style={{ fontSize: 13 }}>{sprintError}</div>
            </div>
          </div>
        )}

        {/* ── 3 Tarjetas de sprint ──────────────────────────────── */}
        {sprintData && !loadingSprintData && (
          <div className="sprints-grid">

            {/* Tarjeta 1 — Sprint actual */}
            {sprintData.current
              ? <SprintCard sprint={sprintData.current} tipo="current" />
              : (
                <div className="card">
                  <div className="sprint-card-header">
                    <span className="badge badge-gray">SPRINT ACTUAL</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    No hay sprint activo en este proyecto.
                  </div>
                </div>
              )}

            {/* Tarjeta 2 — Sprint anterior */}
            {sprintData.anterior
              ? <SprintCard sprint={sprintData.anterior} tipo="anterior" />
              : (
                <div className="card">
                  <div className="sprint-card-header">
                    <span className="badge badge-orange">SPRINT ANTERIOR</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    Sin sprint anterior registrado.
                  </div>
                </div>
              )}

            {/* Tarjeta 3 — Sprints futuros */}
            <div className="card">
              <div className="sprint-card-header">
                <span className="badge badge-gray">SPRINTS FUTUROS</span>
                <span className="sprint-fechas">{sprintData.futuros.length} sprint{sprintData.futuros.length !== 1 ? 's' : ''}</span>
              </div>
              {sprintData.futuros.length === 0
                ? <div className="text-muted" style={{ fontSize: 13 }}>Sin sprints futuros planificados.</div>
                : (
                  <div className="futuros-list">
                    {sprintData.futuros.map((s, i) => (
                      <div key={i} className="futuro-item">
                        <span className="futuro-nombre">{s.nombre}</span>
                        <span className="futuro-fechas">{s.inicio} → {s.fin}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>

          </div>
        )}

        {/* ── Historial de informes (siempre visible al pie) ─────── */}
        <div className="section" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="section-title">Historial de informes</div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setShowLogs(v => !v)}
            >
              {showLogs ? 'Ocultar logs' : 'Ver logs'}
            </button>
          </div>

          {historial.length === 0
            ? (
              <div className="empty-state card">
                <strong>Sin informes generados</strong>
                <span>Usá el botón "Generar informe" para crear el primer PDF</span>
              </div>
            )
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Archivo</th>
                      <th>Fecha</th>
                      <th>Tamaño</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map(f => (
                      <tr key={f.nombre}>
                        <td className="mono">{f.nombre}</td>
                        <td className="text-muted">{f.fecha}</td>
                        <td className="text-muted">{f.size}</td>
                        <td>
                          <a href={urlDescarga(f.nombre)} download={f.nombre}
                            className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                            ⬇ Descargar
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        {/* ── Logs (expandible) ─────────────────────────────────── */}
        {showLogs && (
          <div className="section" style={{ marginTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="card-title" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  Trace logs
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 400 }}>
                  {logs.length === 0
                    ? <div className="empty-state" style={{ padding: 16 }}>Sin logs</div>
                    : logs.map(l => (
                      <div
                        key={l.nombre}
                        onClick={() => handleVerLog(l.nombre)}
                        style={{
                          padding: '10px 16px', cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          background: logNombre === l.nombre ? 'var(--gray2)' : undefined,
                        }}
                      >
                        <div className="mono text-small">{l.nombre.replace('Trace_', '').replace('.log', '')}</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>{l.size}</div>
                      </div>
                    ))}
                </div>
              </div>
              <div>
                {logContent
                  ? <pre className="log-pre">{logContent}</pre>
                  : <div className="empty-state card"><strong>Seleccioná un log</strong></div>}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
