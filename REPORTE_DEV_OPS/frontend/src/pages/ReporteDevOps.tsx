import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  Org, Proyecto, ProyectoDetalle, TestPlan,
  PdfFile, LogFile, GeneracionEstado,
} from '../types'
import {
  apiOrgs, apiOrgsRefresh, apiProyectos, apiProyectoDetalle,
  apiTestPlans, apiGenerar, apiEstado, apiHistorial,
  apiLogs, apiLogContenido, urlDescarga, apiSalir,
} from '../api/client'

// Detecta si la app corre embebida en el portal — evaluación estática
const IN_PORTAL = window.self !== window.top

// ── Helpers de badge ─────────────────────────────────────────────────────────
function alertaBadge(alerta: string) {
  if (alerta === 'RIESGO') return <span className="badge badge-red">RIESGO</span>
  if (alerta === 'DESVIO') return <span className="badge badge-orange">DESVÍO</span>
  return <span className="badge badge-green">OK</span>
}

function avanceBadge(pct: number) {
  const cls = pct >= 80 ? 'badge-green' : pct >= 40 ? 'badge-orange' : 'badge-red'
  return <span className={`badge ${cls}`}>{pct}%</span>
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function ReporteDevOps() {
  // Filtros
  const [orgs,       setOrgs]       = useState<Org[]>([])
  const [orgSel,     setOrgSel]     = useState('')
  const [proyectos,  setProyectos]  = useState<Proyecto[]>([])
  const [proySel,    setProySel]    = useState('')

  // Datos
  const [detalle,    setDetalle]    = useState<ProyectoDetalle | null>(null)
  const [testPlans,  setTestPlans]  = useState<TestPlan[]>([])
  const [historial,  setHistorial]  = useState<PdfFile[]>([])
  const [logs,       setLogs]       = useState<LogFile[]>([])
  const [logContent, setLogContent] = useState('')
  const [logNombre,  setLogNombre]  = useState('')

  // Estado generación
  const [estado,     setEstado]     = useState<GeneracionEstado | null>(null)
  const pollingRef = useRef<number | null>(null)

  // Tab activa
  const [tab, setTab] = useState<'metricas' | 'desvios' | 'tests' | 'historial' | 'logs'>('metricas')

  // Loaders
  const [loadingOrgs,  setLoadingOrgs]  = useState(false)
  const [loadingProys, setLoadingProys] = useState(false)
  const [loadingDet,   setLoadingDet]   = useState(false)
  const [loadingTests, setLoadingTests] = useState(false)

  // ── Carga inicial ────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const [o, h, l, e] = await Promise.all([
          apiOrgs(), apiHistorial(), apiLogs(), apiEstado(),
        ])
        setOrgs(o); setHistorial(h); setLogs(l); setEstado(e)
      } catch (err) {
        console.error(err)
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
    setProySel(''); setDetalle(null); setTestPlans([])
    void apiProyectos(orgSel).then(p => { setProyectos(p); setLoadingProys(false) })
  }, [orgSel])

  // ── Cambio proyecto ──────────────────────────────────────
  useEffect(() => {
    if (!orgSel || !proySel) { setDetalle(null); setTestPlans([]); return }
    setLoadingDet(true); setLoadingTests(true)
    void apiProyectoDetalle(orgSel, proySel).then(d => { setDetalle(d); setLoadingDet(false) })
    void apiTestPlans(orgSel, proySel).then(t => { setTestPlans(t); setLoadingTests(false) })
  }, [orgSel, proySel])

  // ── Refresh orgs ─────────────────────────────────────────
  const handleRefreshOrgs = async () => {
    setLoadingOrgs(true)
    try {
      const r = await apiOrgsRefresh()
      if (r.ok) setOrgs(r.orgs)
    } finally {
      setLoadingOrgs(false)
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
      setTab('logs')
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
    // Notificar al portal shell para que limpie procesos y vuelva al Dashboard
    window.parent.postMessage(
      { type: 'portal:goHome', appId: 'reporte-devops' },
      'http://localhost:5174',
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
          <option value="">— seleccionar —</option>
          {orgs.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
        </select>

        <label>Proyecto</label>
        <select value={proySel} onChange={e => setProySel(e.target.value)} disabled={!orgSel || loadingProys}>
          <option value="">— seleccionar —</option>
          {proyectos.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
        </select>

        <button className="btn btn-outline btn-sm" onClick={handleRefreshOrgs} disabled={loadingOrgs}>
          {loadingOrgs ? '...' : '↻ Orgs'}
        </button>

        <div className="ml-auto gap-8" style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-navy"
            onClick={handleGenerar}
            disabled={estado?.corriendo}
          >
            {estado?.corriendo ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Generando...</> : '⬇ Generar informe'}
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

        {/* ── KPIs globales / welcome ─────────────────────── */}
        {!orgSel && (
          <div className="section">
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <div className="section-title" style={{ fontSize: 18, marginBottom: 8 }}>
                Reporte Azure DevOps — Delivery Center
              </div>
              <p className="text-muted">
                Selecciona una organización y proyecto para ver métricas, desvíos de sprint y estrategia de pruebas.
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

        {orgSel && proySel && (
          <>
            {/* KPIs detalle */}
            {loadingDet && <div className="empty-state"><strong>Cargando métricas...</strong></div>}
            {!loadingDet && detalle && (
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-label">Work Items</div>
                  <div className="kpi-value">{detalle.metricas.total}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Épicas</div>
                  <div className="kpi-value">{detalle.metricas.epicas ?? '—'}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">User Stories</div>
                  <div className="kpi-value">{detalle.metricas.user_stories ?? '—'}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Avance</div>
                  <div className={`kpi-value ${detalle.metricas.avance_pct >= 80 ? 'green' : detalle.metricas.avance_pct >= 40 ? 'orange' : 'red'}`}>
                    {detalle.metricas.avance_pct}%
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">SP Total</div>
                  <div className="kpi-value">{detalle.metricas.sp_total}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Sprints c/ Desvío</div>
                  <div className={`kpi-value ${detalle.sprints_con_desvio > 0 ? 'orange' : 'green'}`}>
                    {detalle.sprints_con_desvio}
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Hs. Completadas</div>
                  <div className="kpi-value">{detalle.metricas.horas_comp}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Hs. Restantes</div>
                  <div className="kpi-value">{detalle.metricas.horas_rest}</div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="tabs">
              {(['metricas', 'desvios', 'tests', 'historial', 'logs'] as const).map(t => (
                <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                  {t === 'metricas'  ? 'Métricas'
                  : t === 'desvios'  ? `Desvíos (${detalle?.desvios.length ?? 0})`
                  : t === 'tests'    ? `Test Plans (${testPlans.length})`
                  : t === 'historial'? `Historial (${historial.length})`
                  : 'Logs'}
                </button>
              ))}
            </div>

            {/* ── Tab: Métricas ────────────────────────────── */}
            {tab === 'metricas' && !loadingDet && detalle && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Estados */}
                <div className="card">
                  <div className="card-title">Por estado</div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Estado</th>
                          <th style={{ textAlign: 'right' }}>Items</th>
                          <th>Proporción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(detalle.metricas.estados)
                          .sort((a, b) => b[1] - a[1])
                          .map(([estado, qty]) => (
                          <tr key={estado}>
                            <td>{estado}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{qty}</td>
                            <td>
                              <div className="progress-wrap">
                                <div className="progress-bar">
                                  <div className="progress-fill"
                                    style={{ width: `${Math.round(qty / detalle.metricas.total * 100)}%` }} />
                                </div>
                                <span className="progress-label">
                                  {Math.round(qty / detalle.metricas.total * 100)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tipos */}
                <div className="card">
                  <div className="card-title">Por tipo</div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th style={{ textAlign: 'right' }}>Items</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(detalle.metricas.tipos)
                          .sort((a, b) => b[1] - a[1])
                          .map(([tipo, qty]) => (
                          <tr key={tipo}>
                            <td>{tipo}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Desvíos ─────────────────────────────── */}
            {tab === 'desvios' && !loadingDet && detalle && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sprint</th>
                      <th>Inicio</th>
                      <th>Fin Planeado</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>Desvío (días)</th>
                      <th>Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.desvios.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 24 }}>Sin iteraciones</td></tr>
                    )}
                    {detalle.desvios.map((d, i) => (
                      <tr key={i}>
                        <td>{d.nombre}</td>
                        <td className="mono">{d.inicio}</td>
                        <td className="mono">{d.fin_planeado}</td>
                        <td>{d.estado}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{d.desvio_dias}</td>
                        <td>{alertaBadge(d.alerta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Tab: Test Plans ──────────────────────────── */}
            {tab === 'tests' && (
              <>
                {loadingTests && <div className="empty-state"><strong>Cargando test plans...</strong></div>}
                {!loadingTests && testPlans.length === 0 && (
                  <div className="empty-state">
                    <strong>Sin test plans</strong>
                    <span>No se encontraron planes de prueba en este proyecto</span>
                  </div>
                )}
                {!loadingTests && testPlans.map(plan => (
                  <div key={plan.id} className="section">
                    <div className="card">
                      <div className="section-header">
                        <div className="section-title">{plan.nombre}</div>
                        <div className="gap-8" style={{ display: 'flex', gap: 8 }}>
                          <span className="badge badge-gray">{plan.estado}</span>
                          <span className="text-muted text-small">
                            {plan.resumen.total_suites} suites · {plan.resumen.total_casos} casos
                          </span>
                        </div>
                      </div>

                      {plan.runs.length > 0 && (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Run</th>
                                <th>Estado</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                                <th style={{ textAlign: 'right' }}>Pasados</th>
                                <th style={{ textAlign: 'right' }}>Fallidos</th>
                                <th>Pass rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {plan.runs.map(run => {
                                const rate = run.total > 0 ? Math.round(run.pasados / run.total * 100) : 0
                                return (
                                  <tr key={run.id}>
                                    <td>{run.nombre}</td>
                                    <td><span className="badge badge-gray">{run.estado}</span></td>
                                    <td style={{ textAlign: 'right' }}>{run.total}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{run.pasados}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--red)',   fontWeight: 600 }}>{run.fallidos}</td>
                                    <td>
                                      <div className="progress-wrap">
                                        <div className="progress-bar">
                                          <div className="progress-fill"
                                            style={{ width: `${rate}%`, background: rate >= 80 ? 'var(--green)' : rate >= 50 ? 'var(--orange)' : 'var(--red)' }} />
                                        </div>
                                        <span className="progress-label">{rate}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ── Tab: Historial ──────────────────────────────────── */}
        {(tab === 'historial' || !proySel) && (
          <div className="section" style={{ marginTop: proySel ? 0 : 24 }}>
            {!proySel && <div className="section-title" style={{ marginBottom: 12 }}>Historial de informes</div>}
            {historial.length === 0 && (
              <div className="empty-state card">
                <strong>Sin informes generados</strong>
                <span>Usa el botón "Generar informe" para crear el primer PDF</span>
              </div>
            )}
            {historial.length > 0 && (
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
        )}

        {/* ── Tab: Logs ───────────────────────────────────────── */}
        {tab === 'logs' && proySel && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
            {/* Lista de logs */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="card-title" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                Trace logs
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 500 }}>
                {logs.length === 0 && (
                  <div className="empty-state" style={{ padding: 16 }}>Sin logs</div>
                )}
                {logs.map(l => (
                  <div
                    key={l.nombre}
                    onClick={() => handleVerLog(l.nombre)}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
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

            {/* Contenido log */}
            <div>
              {logContent
                ? <pre className="log-pre">{logContent}</pre>
                : <div className="empty-state card"><strong>Selecciona un log</strong></div>
              }
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
