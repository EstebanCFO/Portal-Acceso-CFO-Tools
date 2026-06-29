import { useState, useEffect } from 'react'
import type { Org, Proyecto, SprintReportResult, SprintSummary, WorkItem, FullReportEntry, OrgHabilitada } from '../types'
import { apiOrgsActivas, apiProyectos, apiSprintReport, apiSalir, apiFullReport,
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
  const [open, setOpen] = useState(false)
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

// ── Cronograma de Sprints (tabla compacta) ────────────────────
const ESTADO_LABEL: Record<SprintSummary['estado'], string> = {
  past:    'Finalizado',
  current: 'Actual',
  future:  'Futuro',
  unknown: 'Sin estado',
}

// Variables CSS para el anillo de progreso (donut con conic-gradient)
function ringVars(pct: number, color: string): React.CSSProperties {
  return { ['--p']: pct, ['--c']: color } as React.CSSProperties
}

const RISK_CLS: Record<RiskResult['level'], string> = {
  BAJO: 'risk-bajo', MEDIO: 'risk-medio', ALTO: 'risk-alto', 'N/A': 'risk-na',
}

// ── Hero: resumen de salud del proyecto (sprint actual) ────────
function SprintHero({
  sprint,
  firstSprintDate,
}: {
  sprint:          NonNullable<SprintReportResult['current']>
  firstSprintDate: string | null
}) {
  const { name, startDate, finishDate, items } = sprint
  const closed = items.filter(i => CLOSED_STATES.has(i.state)).length
  const total  = items.length
  const open   = total - closed
  const avance = total > 0 ? Math.round(closed / total * 100) : 0
  const risk   = calcRisk(startDate, finishDate, open, closed)
  // Colores claros para contraste sobre fondo navy
  const ringColor = avance >= 70 ? 'var(--green-a)' : avance >= 40 ? '#F0A752' : '#E5786E'

  return (
    <div className="rdo-hero">
      <div className="rdo-hero-main">
        <div className="rdo-hero-proj">{name}</div>
        <div className="rdo-hero-sub">
          <span className="rdo-hero-badge">Sprint actual</span>
          <span>{fmtDate(startDate)} → {fmtDate(finishDate)}</span>
          {risk.level !== 'N/A' && risk.remaining > 0 && (
            <span>· {risk.remaining} días hábiles restantes</span>
          )}
          {firstSprintDate && <span>· primer sprint {fmtDate(firstSprintDate)}</span>}
        </div>
      </div>
      <div className="rdo-hero-kpis">
        <div className="rdo-hero-ring" style={ringVars(avance, ringColor)}>
          <div className="rdo-hero-ring-in">{avance}%</div>
        </div>
        <div className="rdo-kpi">
          <span className="rdo-kpi-label">Avance</span>
          <span className="rdo-kpi-val">{closed}<small>/{total}</small></span>
        </div>
        <div className="rdo-kpi">
          <span className="rdo-kpi-label">Velocidad</span>
          <span className="rdo-kpi-val">{risk.elapsed > 0 ? risk.velocity.toFixed(1) : '—'}<small>/día</small></span>
        </div>
        <div className="rdo-kpi">
          <span className="rdo-kpi-label">Riesgo</span>
          <span className={`rdo-risk-chip ${RISK_CLS[risk.level]}`}>
            <span className="rdo-risk-dot" />{risk.level}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Cronograma de Sprints (franja horizontal compacta) ────────
function SprintScheduleSection({ sprints }: { sprints: SprintSummary[] }) {
  if (!sprints || sprints.length === 0) return null

  return (
    <div className="card rdo-crono">
      <div className="rdo-crono-hd">
        <span className="rdo-crono-title">📅 Cronograma de Sprints</span>
        <span className="rdo-crono-count">{sprints.length} sprints</span>
      </div>
      <div className="rdo-crono-track">
        {sprints.map((s, idx) => (
          <div key={`${s.name}-${idx}`} className={`rdo-sp ${s.estado}`}>
            <span className="rdo-sp-name">{s.name}</span>
            <span className="rdo-sp-dates">{fmtDate(s.startDate)} → {fmtDate(s.finishDate)}</span>
            <span className="rdo-sp-state">
              <span className="rdo-sp-dot" />{ESTADO_LABEL[s.estado]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sprint Actual ──────────────────────────────────────────────
function SprintCurrentSection({
  sprint,
}: {
  sprint: NonNullable<SprintReportResult['current']>
}) {
  const { name, startDate, finishDate, items, testplan } = sprint
  const tasks   = items.filter(i => i.type === 'Task')
  const bugs    = items.filter(i => i.type === 'Bug')
  const closed  = items.filter(i => CLOSED_STATES.has(i.state)).length
  const total   = items.length
  const open    = total - closed
  const avance  = total > 0 ? Math.round(closed / total * 100) : 0
  const avanceColor = avance >= 70 ? 'var(--green)' : avance >= 40 ? 'var(--orange)' : 'var(--red)'

  const tp    = testplan
  const cPct  = tp.pctCorridos ?? 0
  const pPct  = tp.pctPass     ?? 0
  const cFill = cPct >= 80 ? 'var(--green)' : cPct >= 50 ? 'var(--orange)' : 'var(--red)'
  const pFill = pPct >= 80 ? 'var(--green)' : pPct >= 50 ? 'var(--orange)' : 'var(--red)'

  return (
    <div className="card rdo-sec">

      {/* ── Cabecera ── */}
      <div className="rdo-sec-hd">
        <span className="badge badge-green">Sprint actual</span>
        <span className="rdo-sec-name">{name}</span>
        <span className="rdo-sec-dates">{fmtDate(startDate)} → {fmtDate(finishDate)}</span>
      </div>

      {/* ── Anillo de avance + stats ── */}
      <div className="rdo-mrow">
        <div className="rdo-ring" style={ringVars(avance, avanceColor)}>
          <div className="rdo-ring-in"><b>{avance}%</b><span>avance</span></div>
        </div>
        <div className="rdo-mstats">
          <div className="rdo-mstat"><b>{total}</b><span>Total</span></div>
          <div className="rdo-mstat"><b className={open > 0 ? 'v-open' : ''}>{open}</b><span>Abiertas</span></div>
          <div className="rdo-mstat"><b className="v-closed">{closed}</b><span>Cerradas</span></div>
        </div>
      </div>

      {/* ── Test Plan compacto ── */}
      <div className="rdo-tp">
        <div className="rdo-tp-title">Test Plan</div>
        {!tp.encontrado
          ? <span className="text-muted" style={{ fontSize: 12 }}>Sin test plan activo asociado al sprint.</span>
          : (
            <>
              <div className="rdo-tp-plan">
                {tp.planNombre}
                {tp.totalPlanes > 1 && (
                  <span className="text-muted" style={{ marginLeft: 6, fontWeight: 400 }}>({tp.totalPlanes} planes)</span>
                )}
              </div>
              <div className="rdo-tp-line">
                <span className="rdo-tp-lab">Test Cases definidos</span>
                <span className="rdo-tp-num">{tp.total}</span>
                <span style={{ flex: 1 }} />
              </div>
              <div className="rdo-tp-line">
                <span className="rdo-tp-lab">Test Points corridos</span>
                <span className="rdo-tp-num">{tp.corridos}/{tp.total}</span>
                <div className="rdo-bar"><i style={{ width: `${cPct}%`, background: cFill }} /></div>
                <span className="rdo-tp-pct" style={{ color: cFill }}>{cPct}%</span>
              </div>
              <div className="rdo-tp-line">
                <span className="rdo-tp-lab">Pass Rate</span>
                <span className="rdo-tp-num">{tp.pasados}/{tp.corridos}</span>
                <div className="rdo-bar"><i style={{ width: `${pPct}%`, background: pFill }} /></div>
                <span className="rdo-tp-pct" style={{ color: pFill }}>{pPct}%</span>
              </div>
            </>
          )
        }
      </div>

      {/* ── Work Items (carpetas colapsables) ── */}
      <div className="rdo-wi-block">
        <div className="rdo-tp-title">Work Items del sprint</div>
        {tasks.length === 0 && bugs.length === 0
          ? <span className="text-muted" style={{ fontSize: 12 }}>Sin Tasks ni Bugs en este sprint.</span>
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
  const total  = items.length
  const open   = total - closed
  const avance = total > 0 ? Math.round(closed / total * 100) : 0
  const avanceColor = avance >= 70 ? 'var(--green)' : avance >= 40 ? 'var(--orange)' : 'var(--red)'

  return (
    <div className="card rdo-sec">

      {/* ── Cabecera ── */}
      <div className="rdo-sec-hd">
        <span className="badge badge-orange">Sprint anterior</span>
        <span className="rdo-sec-name">{name}</span>
        <span className="rdo-sec-dates">{fmtDate(startDate)} → {fmtDate(finishDate)}</span>
      </div>

      {/* ── Anillo de avance + stats ── */}
      <div className="rdo-mrow">
        <div className="rdo-ring" style={ringVars(avance, avanceColor)}>
          <div className="rdo-ring-in"><b>{avance}%</b><span>avance</span></div>
        </div>
        <div className="rdo-mstats">
          <div className="rdo-mstat"><b>{total}</b><span>Total</span></div>
          <div className="rdo-mstat"><b className={open > 0 ? 'v-open' : ''}>{open}</b><span>Abiertas</span></div>
          <div className="rdo-mstat"><b className="v-closed">{closed}</b><span>Cerradas</span></div>
        </div>
      </div>

      {/* ── Work Items (carpetas colapsables) ── */}
      <div className="rdo-wi-block">
        <div className="rdo-tp-title">Work Items del sprint</div>
        {tasks.length === 0 && bugs.length === 0
          ? <span className="text-muted" style={{ fontSize: 12 }}>Sin Tasks ni Bugs en este sprint.</span>
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
                <SprintCurrentSection sprint={entry.current} />
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
  // Año actual (para Consulta Full — sin selector de año en UI)
  const currentYear = new Date().getFullYear()

  // Filtros en cascada
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
  const [loadingOrgs,     setLoadingOrgs]     = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)

  // ── Carga de orgs desde DB (solo activas) — reutilizable ───────────────────
  const loadOrgs = () => {
    setLoadingOrgs(true)
    void apiOrgsActivas()
      .then(data => {
        setOrgs(data)
        // Si la org seleccionada ya no está activa, limpiar la selección
        if (orgSel && !data.some(o => o.nombre === orgSel)) {
          setOrgSel('')
        }
      })
      .catch(console.error)
      .finally(() => setLoadingOrgs(false))
  }

  // Carga inicial al montar
  useEffect(() => { loadOrgs() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cascada: org → proyectos ─────────────────────────────────────────────────
  useEffect(() => {
    setProjectSel(''); setProjects([])
    setReportData(null); setReportError('')

    if (!orgSel) return
    setLoadingProjects(true)
    void apiProyectos(orgSel)
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoadingProjects(false))
  }, [orgSel])

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

  // ── Consulta Full (todos los clientes del MAPEO, año actual) ─────────────────
  const handleConsultaFull = async () => {
    setReportData(null); setReportError('')
    setLoadingFull(true)
    setFullData(null)
    setFullError('')
    try {
      const data = await apiFullReport(currentYear)
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

  const canVer  = !!orgSel && !!projectSel && !loadingReport && !loadingFull
  const canFull = !loadingFull && !loadingReport

  // ────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Toolbar ─────────────────────────────────────── */}
      <div className="toolbar">

        <label>Organización</label>
        <select
          value={orgSel}
          onChange={e => setOrgSel(e.target.value)}
          disabled={loadingOrgs}
        >
          <option value="">
            {loadingOrgs ? 'Cargando…' : '— seleccionar —'}
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
              Elegí organización + proyecto para Ver reporte, o usá ⚡ Consulta Full para ver todos los clientes.
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
          <>
          {reportData.current && (
            <SprintHero sprint={reportData.current} firstSprintDate={reportData.firstSprintDate} />
          )}
          <SprintScheduleSection sprints={reportData.allSprints} />
          <div className="rdo-report-grid">
            {reportData.current
              ? <SprintCurrentSection sprint={reportData.current} />
              : (
                <div className="card rdo-sec">
                  <div className="rdo-sec-hd">
                    <span className="badge badge-gray">Sprint actual</span>
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
                <div className="card rdo-sec">
                  <div className="rdo-sec-hd">
                    <span className="badge badge-orange">Sprint anterior</span>
                  </div>
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    Sin sprint anterior registrado.
                  </p>
                </div>
              )
            }
          </div>
          </>
        )}

        {/* Consulta Full — todos los clientes */}
        {fullData && !loadingFull && (
          <div className="rdo-full-report">
            <div className="rdo-full-report-hdr">
              <span>⚡ Consulta Full — {currentYear}</span>
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
        <OrgHabilitadasModal
          onClose={() => {
            setShowOrgModal(false)
            loadOrgs()   // refresca el combo con los cambios guardados
          }}
        />
      )}
    </div>
  )
}
