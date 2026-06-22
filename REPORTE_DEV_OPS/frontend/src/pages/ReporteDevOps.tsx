import { useState, useEffect } from 'react'
import type { Org, Proyecto, SprintReportResult, WorkItem, FullReportEntry, OrgHabilitada } from '../types'
import { apiOrgs, apiProyectos, apiSprintReport, apiSalir, apiFullReport,
         apiOrgsHabilitadas, apiGuardarOrgsHabilitadas } from '../api/client'

// Detecta si la app corre embebida en el portal — evaluación estática
const IN_PORTAL = window.self !== window.top

const CLOSED_STATES = new Set([
  'Closed', 'Done', 'Resolved', 'Completed',
  'Fixed', 'Removed', 'Resuelta', 'Finalizado',
])

const AVATAR_PALETTE = [
  '#185fa5', '#993c1d', '#3b6d11', '#854f0b',
  '#0a1f44', '#7c3aed', '#0e7490', '#be185d',
]

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const parts = iso.split('T')[0].split('-')
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function countBizDays(start: Date, end: Date): number {
  let count = 0
  const cur = new Date(start); cur.setHours(0, 0, 0, 0)
  const e   = new Date(end);   e.setHours(0, 0, 0, 0)
  while (cur <= e) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

interface RiskResult {
  level:     'BAJO' | 'MEDIO' | 'ALTO' | 'N/A'
  subText:   string
  velocity:  number
  elapsed:   number
  remaining: number
}

function calcRisk(
  startDate:  string | null,
  finishDate: string | null,
  open:       number,
  closed:     number,
): RiskResult {
  if (!startDate || !finishDate) {
    return { level: 'N/A', subText: 'Sin fechas de sprint', velocity: 0, elapsed: 0, remaining: 0 }
  }
  const today  = new Date(); today.setHours(0, 0, 0, 0)
  const start  = new Date(startDate)
  const finish = new Date(finishDate)

  if (today < start) {
    return { level: 'N/A', subText: 'Sprint no iniciado', velocity: 0, elapsed: 0, remaining: 0 }
  }

  const effectEnd = today > finish ? finish : today
  const elapsed   = countBizDays(start, effectEnd)

  const tomorrow  = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const remaining = today >= finish ? 0 : countBizDays(tomorrow, finish)

  const velocity = elapsed > 0 ? closed / elapsed : 0

  if (open === 0) {
    return { level: 'BAJO', subText: 'Sin items abiertos ✓', velocity, elapsed, remaining }
  }
  if (remaining === 0) {
    return { level: 'ALTO', subText: 'Sprint finalizado con items abiertos', velocity, elapsed, remaining }
  }

  const needed = open / remaining
  const level: RiskResult['level'] =
    velocity >= needed       ? 'BAJO'  :
    velocity >= needed * 0.5 ? 'MEDIO' : 'ALTO'
  const subText = `Vel. necesaria: ${needed.toFixed(1)}/día · ${remaining} días restantes`
  return { level, subText, velocity, elapsed, remaining }
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function avatarColor(name: string): string {
  const code = [...name].reduce((s, c) => s + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]
}

// ── Carpeta colapsable de work items ──────────────────────────
function FolderSection({ type, items }: { type: 'Task' | 'Bug'; items: WorkItem[] }) {
  const [open, setOpen] = useState(true)
  const pillCls = type === 'Task' ? 'rdo-pill-task' : 'rdo-pill-bug'

  return (
    <div className="rdo-folder">
      <button
        className="rdo-folder-hdr"
        onClick={() => setOpen(p => !p)}
        type="button"
        aria-expanded={open}
      >
        <span className={`rdo-chevron${open ? ' open' : ''}`}>▶</span>
        <span className={`rdo-type-pill ${pillCls}`}>{type}</span>
        <span className="rdo-folder-count">({items.length})</span>
      </button>

      {open && (
        <div className="rdo-folder-body">
          <table className="rdo-wi-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Estado</th>
                <th>Asignado</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const isClosed = CLOSED_STATES.has(item.state)
                const who      = item.assignedTo || ''
                return (
                  <tr key={item.id} className={`rdo-wi-row${isClosed ? ' closed' : ''}`}>
                    <td className="rdo-wi-id">#{item.id}</td>
                    <td className="rdo-wi-title">{item.title}</td>
                    <td>
                      <span className="rdo-wi-state">
                        <span className={`rdo-state-dot${isClosed ? ' closed' : ' open-dot'}`} />
                        {item.state}
                      </span>
                    </td>
                    <td>
                      {who
                        ? (
                          <span
                            className="rdo-avatar"
                            title={who}
                            style={{ background: avatarColor(who) }}
                          >
                            {getInitials(who)}
                          </span>
                        )
                        : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Sprint Actual ──────────────────────────────────────────────
function SprintCurrentSection({
  sprint,
  firstSprintDate,
}: {
  sprint:          NonNullable<SprintReportResult['current']>
  firstSprintDate: string | null
}) {
  const { name, startDate, finishDate, items, testplan } = sprint
  const tasks   = items.filter(i => i.type === 'Task')
  const bugs    = items.filter(i => i.type === 'Bug')
  const closed  = items.filter(i => CLOSED_STATES.has(i.state)).length
  const open    = items.length - closed
  const total   = items.length
  const avance  = total > 0 ? Math.round(closed / total * 100) : 0
  const risk    = calcRisk(startDate, finishDate, open, closed)

  const avanceColor  = avance >= 70 ? 'var(--green)' : avance >= 40 ? 'var(--orange)' : 'var(--red)'
  const riskCls      = { BAJO: 'risk-bajo', MEDIO: 'risk-medio', ALTO: 'risk-alto', 'N/A': 'risk-na' }[risk.level]

  const tp    = testplan
  const cPct  = tp.pctCorridos ?? 0
  const pPct  = tp.pctPass     ?? 0
  const cFill = cPct >= 80 ? 'var(--green)' : cPct >= 50 ? 'var(--orange)' : 'var(--red)'
  const pFill = pPct >= 80 ? 'var(--green)' : pPct >= 50 ? 'var(--orange)' : 'var(--red)'

  return (
    <div className="card rdo-sprint-card">

      {/* ── Cabecera ── */}
      <div className="rdo-sprint-hdr">
        <span className="badge badge-green">SPRINT ACTUAL</span>
        <span className="rdo-sprint-name">{name}</span>
        <span className="sprint-fechas">{fmtDate(startDate)} → {fmtDate(finishDate)}</span>
        {firstSprintDate && (
          <span className="rdo-first-sprint">Primer sprint: {fmtDate(firstSprintDate)}</span>
        )}
      </div>

      {/* ── 4 tarjetas de métricas ── */}
      <div className="rdo-metrics-row">
        <div className="rdo-metric-card">
          <div className="rdo-metric-label">Total tasks</div>
          <div className="rdo-metric-value">{total}</div>
          <div className="rdo-metric-sub">{open} abiertas · {closed} cerradas</div>
        </div>
        <div className="rdo-metric-card">
          <div className="rdo-metric-label">% Avance</div>
          <div className="rdo-metric-value" style={{ color: avanceColor }}>{avance}%</div>
          <div className="rdo-metric-sub">{closed} de {total} cerradas</div>
        </div>
        <div className="rdo-metric-card">
          <div className="rdo-metric-label">Velocidad actual</div>
          <div className="rdo-metric-value">
            {risk.elapsed > 0 ? risk.velocity.toFixed(1) : '—'}
          </div>
          <div className="rdo-metric-sub">tasks/día · {risk.elapsed} días hábiles</div>
        </div>
        <div className={`rdo-metric-card rdo-risk-card ${riskCls ?? ''}`}>
          <div className="rdo-metric-label">Riesgo</div>
          <div className="rdo-metric-value">{risk.level}</div>
          <div className="rdo-metric-sub">{risk.subText}</div>
        </div>
      </div>

      {/* ── Barra de progreso ── */}
      <div className="rdo-progress-section">
        <div className="rdo-progress-meta">
          <span>{closed} cerradas de {total}</span>
          <span style={{ fontWeight: 600, color: avanceColor }}>{avance}%</span>
        </div>
        <div className="rdo-progress-track">
          <div className="rdo-progress-fill" style={{ width: `${avance}%`, background: avanceColor }} />
        </div>
      </div>

      {/* ── Test Plan ── */}
      <div className="rdo-inner-section">
        <div className="sprint-section-title">Test Plan</div>
        {!tp.encontrado
          ? <span className="text-muted" style={{ fontSize: 13 }}>Sin test plan activo asociado al sprint.</span>
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
                <div className="tp-row">
                  <span className="tp-label">Test Cases definidos</span>
                  <span className="tp-value">{tp.total}</span>
                </div>
                <div className="tp-row">
                  <span className="tp-label">Test Points corridos</span>
                  <span className="tp-value">{tp.corridos} / {tp.total}</span>
                  <div className="progress-wrap" style={{ flex: 1 }}>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${cPct}%`, background: cFill }} />
                    </div>
                    <span className="progress-label">{cPct}%</span>
                  </div>
                </div>
                <div className="tp-row">
                  <span className="tp-label">Pass Rate</span>
                  <span className="tp-value">{tp.pasados} / {tp.corridos}</span>
                  <div className="progress-wrap" style={{ flex: 1 }}>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pPct}%`, background: pFill }} />
                    </div>
                    <span className="progress-label">{pPct}%</span>
                  </div>
                </div>
              </div>
            </>
          )
        }
      </div>

      {/* ── Work Items por tipo (carpetas colapsables) ── */}
      <div className="rdo-inner-section">
        <div className="sprint-section-title">Work Items del sprint</div>
        {tasks.length === 0 && bugs.length === 0
          ? <span className="text-muted" style={{ fontSize: 13 }}>Sin Tasks ni Bugs en este sprint.</span>
          : (
            <>
              {tasks.length > 0 && <FolderSection type="Task" items={tasks} />}
              {bugs.length  > 0 && <FolderSection type="Bug"  items={bugs}  />}
            </>
          )
        }
      </div>
    </div>
  )
}

// ── Sprint Anterior ────────────────────────────────────────────
function SprintAnteriorSection({
  sprint,
}: {
  sprint: NonNullable<SprintReportResult['anterior']>
}) {
  const { name, startDate, finishDate, items } = sprint
  const tasks  = items.filter(i => i.type === 'Task')
  const bugs   = items.filter(i => i.type === 'Bug')
  const closed = items.filter(i => CLOSED_STATES.has(i.state)).length
  const open   = items.length - closed
  const total  = items.length

  return (
    <div className="card rdo-sprint-card">

      {/* ── Cabecera ── */}
      <div className="rdo-sprint-hdr">
        <span className="badge badge-orange">SPRINT ANTERIOR</span>
        <span className="rdo-sprint-name">{name}</span>
        <span className="sprint-fechas">{fmtDate(startDate)} → {fmtDate(finishDate)}</span>
      </div>

      {/* ── Totales ── */}
      <div className="rdo-stats-row">
        <div className="rdo-stat">
          <div className="rdo-stat-label">Total</div>
          <div className="rdo-stat-value">{total}</div>
        </div>
        <div className="rdo-stat">
          <div className="rdo-stat-label">Abiertas</div>
          <div className={`rdo-stat-value${open > 0 ? ' val-open' : ''}`}>{open}</div>
        </div>
        <div className="rdo-stat">
          <div className="rdo-stat-label">Cerradas</div>
          <div className="rdo-stat-value val-closed">{closed}</div>
        </div>
      </div>

      {/* ── Work Items por tipo ── */}
      <div className="rdo-inner-section">
        <div className="sprint-section-title">Work Items del sprint</div>
        {tasks.length === 0 && bugs.length === 0
          ? <span className="text-muted" style={{ fontSize: 13 }}>Sin Tasks ni Bugs en este sprint.</span>
          : (
            <>
              {tasks.length > 0 && <FolderSection type="Task" items={tasks} />}
              {bugs.length  > 0 && <FolderSection type="Bug"  items={bugs}  />}
            </>
          )
        }
      </div>
    </div>
  )
}

// ── Modal: Organizaciones Habilitadas ─────────────────────────
function OrgHabilitadasModal({ onClose }: { onClose: () => void }) {
  const [orgs,    setOrgs]    = useState<OrgHabilitada[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    void apiOrgsHabilitadas()
      .then(setOrgs)
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar orgs'))
      .finally(() => setLoading(false))
  }, [])

  const setEstado = (nombre: string, estado: 'activa' | 'inactiva') => {
    setOrgs(prev => prev.map(o => o.nombre === nombre ? { ...o, estado } : o))
    setSaveMsg('')
  }

  const handleGuardar = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await apiGuardarOrgsHabilitadas(
        orgs.map(o => ({ nombre: o.nombre, estado: o.estado }))
      )
      setSaveMsg(`✓ ${res.guardadas} organizaciones guardadas`)
    } catch (e) {
      setSaveMsg('Error al guardar — intentá de nuevo')
    } finally {
      setSaving(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-box">

        {/* ── Cabecera ── */}
        <div className="modal-hdr">
          <span className="modal-title">Organizaciones Habilitadas</span>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Cerrar">✕</button>
        </div>

        {/* ── Cuerpo ── */}
        <div className="modal-body">
          {loading && (
            <div className="modal-loading">
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Consultando Azure DevOps…
            </div>
          )}
          {error && <div className="modal-error">{error}</div>}
          {!loading && !error && orgs.length === 0 && (
            <div className="modal-loading" style={{ color: 'var(--text3)' }}>
              Sin organizaciones disponibles.
            </div>
          )}
          {!loading && !error && orgs.length > 0 && (
            <table className="org-table">
              <thead>
                <tr>
                  <th>Organización</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map(o => (
                  <tr key={o.nombre}>
                    <td className="org-nombre">{o.nombre}</td>
                    <td>
                      <div className="org-estado-toggle">
                        <button
                          type="button"
                          className={`org-toggle-pill${o.estado === 'activa' ? ' pill-activa' : ''}`}
                          onClick={() => setEstado(o.nombre, 'activa')}
                        >
                          Activa
                        </button>
                        <button
                          type="button"
                          className={`org-toggle-pill${o.estado === 'inactiva' ? ' pill-inactiva' : ''}`}
                          onClick={() => setEstado(o.nombre, 'inactiva')}
                        >
                          Inactiva
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pie ── */}
        <div className="modal-footer">
          {saveMsg && (
            <span className={`modal-save-msg${saveMsg.startsWith('Error') ? ' error' : ''}`}>
              {saveMsg}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={onClose} type="button">
              Cerrar
            </button>
            <button
              className="btn btn-navy btn-sm"
              onClick={handleGuardar}
              disabled={saving || loading || !!error}
              type="button"
            >
              {saving
                ? <><span className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> Guardando…</>
                : 'Guardar'
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Bloque por cliente en Consulta Full ───────────────────────
function ClientBlock({ entry }: { entry: FullReportEntry }) {
  return (
    <div className="rdo-client-block">
      <div className="rdo-client-hdr">
        <span className="rdo-client-name">{entry.cliente}</span>
        <span className="rdo-client-meta">{entry.org} · {entry.proyecto}</span>
        {entry.firstSprintDate && (
          <span className="rdo-client-first-sprint">
            Inicio: {fmtDate(entry.firstSprintDate)}
          </span>
        )}
        {entry.omitido && (
          <span className="badge rdo-badge-omitido">OMITIDO</span>
        )}
      </div>

      {entry.omitido
        ? (
          <div className="rdo-omitido-msg">
            {entry.razonOmision ?? 'Proyecto omitido por filtro de año'}
          </div>
        )
        : (
          <div className="sprints-grid">
            {entry.current
              ? (
                <SprintCurrentSection
                  sprint={entry.current}
                  firstSprintDate={null}
                />
              )
              : (
                <div className="card">
                  <div className="rdo-sprint-hdr">
                    <span className="badge badge-gray">SPRINT ACTUAL</span>
                  </div>
                  <p className="text-muted" style={{ fontSize: 13, padding: '12px 0' }}>
                    Sin sprint activo.
                  </p>
                </div>
              )
            }
            {entry.anterior
              ? <SprintAnteriorSection sprint={entry.anterior} />
              : (
                <div className="card">
                  <div className="rdo-sprint-hdr">
                    <span className="badge badge-orange">SPRINT ANTERIOR</span>
                  </div>
                  <p className="text-muted" style={{ fontSize: 13, padding: '12px 0' }}>
                    Sin sprint anterior registrado.
                  </p>
                </div>
              )
            }
          </div>
        )
      }
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function ReporteDevOps() {
  // Filtros en cascada
  const [yearSel,    setYearSel]    = useState('')
  const [orgSel,     setOrgSel]     = useState('')
  const [projectSel, setProjectSel] = useState('')

  // Datos de selects
  const [orgs,     setOrgs]     = useState<Org[]>([])
  const [projects, setProjects] = useState<Proyecto[]>([])

  // Reporte individual
  const [reportData,    setReportData]    = useState<SprintReportResult | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportError,   setReportError]   = useState('')

  // Consulta Full
  const [fullData,    setFullData]    = useState<FullReportEntry[] | null>(null)
  const [loadingFull, setLoadingFull] = useState(false)
  const [fullError,   setFullError]   = useState('')

  // Loaders de selects
  const [loadingOrgs,    setLoadingOrgs]    = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)

  // Años disponibles (año actual → -4)
  const thisYear = new Date().getFullYear()
  const years    = Array.from({ length: 5 }, (_, i) => thisYear - i)

  // ── Cascada: año → orgs (carga todas las orgs del PAT — rápido) ───────────
  useEffect(() => {
    setOrgSel('');     setOrgs([])
    setProjectSel(''); setProjects([])
    setReportData(null); setReportError('')

    if (!yearSel) return
    setLoadingOrgs(true)
    void apiOrgs()
      .then(setOrgs)
      .catch(console.error)
      .finally(() => setLoadingOrgs(false))
  }, [yearSel])

  // ── Cascada: org → proyectos (todos los proyectos de la org — rápido) ──────
  useEffect(() => {
    setProjectSel(''); setProjects([])
    setReportData(null); setReportError('')

    if (!orgSel || !yearSel) return
    setLoadingProjects(true)
    void apiProyectos(orgSel)
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoadingProjects(false))
  }, [orgSel, yearSel])

  // ── Limpiar reporte al cambiar proyecto ───────────────────
  useEffect(() => {
    setReportData(null); setReportError('')
  }, [projectSel])

  // ── Ver reporte (un proyecto) ─────────────────────────────
  const handleVerReporte = async () => {
    if (!orgSel || !projectSel) return
    setFullData(null); setFullError('')
    setLoadingReport(true)
    setReportData(null)
    setReportError('')
    try {
      const data = await apiSprintReport(orgSel, projectSel)
      setReportData(data)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Error al consultar el reporte')
    } finally {
      setLoadingReport(false)
    }
  }

  // ── Consulta Full (todos los clientes del MAPEO) ──────────
  const handleConsultaFull = async () => {
    if (!yearSel) return
    setReportData(null); setReportError('')
    setLoadingFull(true)
    setFullData(null)
    setFullError('')
    try {
      const data = await apiFullReport(Number(yearSel))
      setFullData(data)
    } catch (err) {
      setFullError(err instanceof Error ? err.message : 'Error al ejecutar Consulta Full')
    } finally {
      setLoadingFull(false)
    }
  }

  // ── Modal Organizaciones Habilitadas ─────────────────────
  const [showOrgModal, setShowOrgModal] = useState(false)

  // ── Salir ────────────────────────────────────────────────
  const [saliendo, setSaliendo] = useState(false)

  const handleSalir = async () => {
    if (saliendo) return
    setSaliendo(true)
    try { await apiSalir() } catch { /* Flask puede estar cerrándose */ }
    const portalUrl = import.meta.env.VITE_PORTAL_URL || 'http://localhost:5174'
    window.parent.postMessage({ type: 'portal:goHome', appId: 'reporte-devops' }, portalUrl)
  }

  const canVer  = !!yearSel && !!orgSel && !!projectSel && !loadingReport && !loadingFull
  const canFull = !!yearSel && !loadingFull && !loadingReport

  // ────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Toolbar ─────────────────────────────────────── */}
      <div className="toolbar">

        <label>Año</label>
        <select value={yearSel} onChange={e => setYearSel(e.target.value)}>
          <option value="">Seleccionar año…</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <label>Organización</label>
        <select
          value={orgSel}
          onChange={e => setOrgSel(e.target.value)}
          disabled={!yearSel || loadingOrgs}
        >
          <option value="">
            {!yearSel
              ? '— elegir año primero —'
              : loadingOrgs
                ? 'Cargando…'
                : '— seleccionar —'}
          </option>
          {orgs.map(o => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
        </select>

        <label>Proyecto</label>
        <select
          value={projectSel}
          onChange={e => setProjectSel(e.target.value)}
          disabled={!orgSel || loadingProjects}
        >
          <option value="">
            {!orgSel
              ? '— elegir org primero —'
              : loadingProjects
                ? 'Cargando…'
                : '— seleccionar —'}
          </option>
          {projects.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
        </select>

        <button
          className="btn btn-navy btn-sm"
          onClick={handleVerReporte}
          disabled={!canVer}
        >
          {loadingReport
            ? <><span className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> Consultando…</>
            : 'Ver reporte'
          }
        </button>

        <div className="toolbar-divider" />

        <button
          className="btn btn-full btn-sm"
          onClick={handleConsultaFull}
          disabled={!canFull}
          title="Consulta todos los clientes del mapeo de proyectos"
        >
          {loadingFull
            ? <><span className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> Ejecutando…</>
            : '⚡ Consulta Full'
          }
        </button>

        <div className="toolbar-divider" />

        <button
          className="btn btn-settings btn-sm"
          onClick={() => setShowOrgModal(true)}
          type="button"
          title="Ver y editar qué organizaciones están habilitadas"
        >
          🏢 Org. Habilitadas
        </button>

        {!IN_PORTAL && (
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-danger btn-sm" onClick={handleSalir} disabled={saliendo}>
              {saliendo ? 'Cerrando…' : 'Salir'}
            </button>
          </div>
        )}
      </div>

      {/* ── Contenido ───────────────────────────────────── */}
      <div className="page-content">

        {/* Welcome / hint */}
        {!reportData && !loadingReport && !reportError &&
         !fullData  && !loadingFull  && !fullError  && (
          <div className="empty-state">
            <div style={{ fontSize: 36 }}>📊</div>
            <strong>Reporte Azure DevOps — Delivery Center</strong>
            <span className="text-muted">
              {!yearSel
                ? 'Seleccioná un año para habilitar los reportes.'
                : 'Elegí organización + proyecto para Ver reporte, o usá ⚡ Consulta Full para ver todos los clientes.'
              }
            </span>
          </div>
        )}

        {/* Cargando reporte individual */}
        {loadingReport && (
          <div className="empty-state">
            <span className="spinner" style={{
              width: 28, height: 28, borderWidth: 3,
              borderColor: 'var(--gray2)', borderTopColor: 'var(--navy)',
            }} />
            <strong>Consultando sprints en Azure DevOps…</strong>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Esto puede tardar unos segundos mientras se obtienen work items y test plans.
            </span>
          </div>
        )}

        {/* Cargando Consulta Full */}
        {loadingFull && (
          <div className="empty-state">
            <span className="spinner" style={{
              width: 28, height: 28, borderWidth: 3,
              borderColor: 'var(--gray2)', borderTopColor: 'var(--green)',
            }} />
            <strong>Consultando todos los clientes…</strong>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Se consultan {/* total mapeo */}9 proyectos en paralelo. Puede demorar 30–60 segundos.
            </span>
          </div>
        )}

        {/* Error reporte individual */}
        {reportError && !loadingReport && (
          <div className="section">
            <div className="card" style={{ borderLeft: '4px solid var(--red)', padding: '16px 20px' }}>
              <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>Error al consultar</div>
              <div className="text-muted" style={{ fontSize: 13 }}>{reportError}</div>
            </div>
          </div>
        )}

        {/* Error Consulta Full */}
        {fullError && !loadingFull && (
          <div className="section">
            <div className="card" style={{ borderLeft: '4px solid var(--red)', padding: '16px 20px' }}>
              <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>Error en Consulta Full</div>
              <div className="text-muted" style={{ fontSize: 13 }}>{fullError}</div>
            </div>
          </div>
        )}

        {/* Reporte individual */}
        {reportData && !loadingReport && (
          <div className="sprints-grid">
            {reportData.current
              ? (
                <SprintCurrentSection
                  sprint={reportData.current}
                  firstSprintDate={reportData.firstSprintDate}
                />
              )
              : (
                <div className="card">
                  <div className="sprint-card-header">
                    <span className="badge badge-gray">SPRINT ACTUAL</span>
                  </div>
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    No hay sprint activo en este proyecto.
                  </p>
                </div>
              )
            }
            {reportData.anterior
              ? <SprintAnteriorSection sprint={reportData.anterior} />
              : (
                <div className="card">
                  <div className="sprint-card-header">
                    <span className="badge badge-orange">SPRINT ANTERIOR</span>
                  </div>
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    Sin sprint anterior registrado.
                  </p>
                </div>
              )
            }
          </div>
        )}

        {/* Consulta Full — todos los clientes */}
        {fullData && !loadingFull && (
          <div className="rdo-full-report">
            <div className="rdo-full-report-hdr">
              <span>⚡ Consulta Full — {yearSel}</span>
              <span className="rdo-full-report-sub">
                {fullData.filter(e => !e.omitido).length} proyectos activos
                {fullData.some(e => e.omitido) && (
                  <> · {fullData.filter(e => e.omitido).length} omitidos</>
                )}
              </span>
            </div>
            {fullData.map((entry, idx) => (
              <ClientBlock key={`${entry.org}-${entry.proyecto}-${idx}`} entry={entry} />
            ))}
          </div>
        )}

      </div>

      {/* ── Modal Organizaciones Habilitadas ──────────────── */}
      {showOrgModal && (
        <OrgHabilitadasModal onClose={() => setShowOrgModal(false)} />
      )}
    </div>
  )
}
