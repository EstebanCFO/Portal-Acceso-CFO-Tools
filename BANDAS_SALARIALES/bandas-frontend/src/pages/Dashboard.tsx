import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getDashboard, getSnapshots, getEmpleados, deleteSnapshot } from '../api/client'
import UploadModal from '../components/UploadModal'
import { DS } from '../theme'
import type { DashboardKpis, ImportacionRow, BandaSalarial } from '../types'

const fmtAR = (v: number | null | undefined) =>
  v == null ? '—' : '$ ' + Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })

// ── KPI Card ───────────────────────────────────────────────────────────────────
interface KPICardProps {
  label: string
  value: string | number
  sub?:  string
  color?: string
}
function KPICard({ label, value, sub, color }: KPICardProps) {
  const clr = color ?? DS.navy
  return (
    <div className="kpi-card">
      <div className="kpi-value" style={{ color: clr }}>{value}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub" style={{ color: clr }}>{sub}</div>}
    </div>
  )
}

interface SeniorityBucket { seniority: string; total: number; ok: number; revisar: number }

export default function Dashboard() {
  const [kpis,       setKpis]       = useState<DashboardKpis | null>(null)
  const [imports,    setImports]    = useState<ImportacionRow[]>([])
  const [empleados,  setEmpleados]  = useState<BandaSalarial[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [confirmDel, setConfirmDel] = useState<{ id: number; periodo: string } | null>(null)
  const [deleting,   setDeleting]   = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [{ data: k }, { data: i }] = await Promise.all([getDashboard(), getSnapshots()])
      setKpis(k)
      setImports(i)
      if (i.length > 0) {
        const { data: emps } = await getEmpleados(i[0].id)
        setEmpleados(emps)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const seniorityStats = useMemo<SeniorityBucket[]>(() => {
    const ORDEN = ['JR', 'SSR', 'SR']
    const map: Record<string, SeniorityBucket> = {}
    empleados.forEach(e => {
      const s = e.seniority ?? 'N/D'
      if (!map[s]) map[s] = { seniority: s, total: 0, ok: 0, revisar: 0 }
      map[s].total++
      if (e.estadoVsInf === 'OK')      map[s].ok++
      if (e.estadoVsInf === 'REVISAR') map[s].revisar++
    })
    return [...ORDEN, 'N/D'].filter(s => map[s]).map(s => map[s])
  }, [empleados])

  const brechaStats = useMemo(() => {
    const montos = empleados
      .filter(e => e.estadoVsInf === 'REVISAR' && e.varMonto && e.varMonto !== 'EN BANDA')
      .map(e => parseFloat(e.varMonto!))
      .filter(v => !isNaN(v))
    if (!montos.length) return null
    const avg = montos.reduce((a, b) => a + b, 0) / montos.length
    const max = Math.min(...montos)
    return { count: montos.length, avg, max }
  }, [empleados])

  async function handleDelete() {
    if (!confirmDel) return
    setDeleting(true)
    try {
      await deleteSnapshot(confirmDel.id)
      setConfirmDel(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex-between mb-4">
        <div>
          <h2 className="page-title">Dashboard</h2>
          {kpis && (
            <span className="caption">
              Ultimo snapshot: <strong>{kpis.periodo}</strong> · {kpis.fechaCarga}
            </span>
          )}
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          + Cargar Excel
        </button>
      </div>

      {loading && (
        <div className="progress-bar mb-3">
          <div className="progress-fill indeterminate" />
        </div>
      )}

      {!loading && !kpis && (
        <div className="alert alert-info mb-3">
          No hay datos cargados todavia. Subi el primer Excel con el boton de arriba.
        </div>
      )}

      {kpis && (
        <>
          {/* KPI boxes */}
          <div className="kpi-grid">
            {[
              { label: 'Empleados', value: kpis.total },
              { label: 'En Banda',  value: `${kpis.pctOk}%`,      sub: `${kpis.ok} personas`,       color: DS.green  },
              { label: 'Revisar',   value: `${kpis.pctRevisar}%`, sub: `${kpis.revisar} personas`,   color: DS.orange },
              { label: 'Sin Banda', value: `${kpis.pctSin}%`,     sub: `${kpis.sinBanda} personas`,  color: DS.text2  },
            ].map(p => <KPICard key={p.label} {...p} />)}
          </div>

          {/* 3-panel row */}
          <div className="dash-panels">

            {/* Distribucion visual */}
            <div className="card" style={{ height: '100%' }}>
              <div className="card-body flex-col" style={{ height: '100%' }}>
                <p className="section-title mb-3">Distribucion visual</p>
                <div className="mb-3">
                  <div className="flex-col gap-1 mb-2">
                    <span className="caption">{kpis.total} empleados en total</span>
                    <span className="caption">{kpis.ok + kpis.revisar} con banda · {kpis.sinBanda} sin banda</span>
                  </div>
                  {/* Stacked bar */}
                  <div style={{ display: 'flex', height: 32, borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${kpis.pctOk}%`, background: DS.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                        {kpis.pctOk > 8 ? `${kpis.pctOk}% OK` : ''}
                      </span>
                    </div>
                    <div style={{ width: `${kpis.pctRevisar}%`, background: DS.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>
                        {kpis.pctRevisar > 8 ? `${kpis.pctRevisar}%` : ''}
                      </span>
                    </div>
                    <div style={{ width: `${kpis.pctSin}%`, background: DS.gray3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>
                        {kpis.pctSin > 8 ? `${kpis.pctSin}%` : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-col gap-3">
                  {[
                    { label: 'En Banda (OK)', count: kpis.ok,       pct: kpis.pctOk,      color: DS.green,  bg: 'rgba(0,135,90,.08)'  },
                    { label: 'Revisar',        count: kpis.revisar,  pct: kpis.pctRevisar, color: DS.orange, bg: 'rgba(201,106,0,.08)' },
                    { label: 'Sin Banda',      count: kpis.sinBanda, pct: kpis.pctSin,     color: DS.text2,  bg: 'rgba(0,0,0,.04)'     },
                  ].map(({ label, count, pct, color, bg }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, background: bg, borderRadius: 8, padding: '8px 14px' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color, flex: 1 }}>{label}</span>
                      <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{count}</span>
                      <span className="caption" style={{ minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Por Seniority */}
            <div className="card" style={{ height: '100%' }}>
              <div className="card-body flex-col" style={{ height: '100%' }}>
                <p className="section-title mb-3">Por Seniority</p>
                <div className="flex-col gap-4" style={{ flex: 1, justifyContent: 'center' }}>
                  {seniorityStats.map(({ seniority, total, ok, revisar }) => {
                    const pctOk  = total ? Math.round(ok      / total * 100) : 0
                    const pctRev = total ? Math.round(revisar  / total * 100) : 0
                    return (
                      <div key={seniority}>
                        <div className="flex-between mb-1">
                          <div className="flex-center gap-2">
                            <span className="badge badge-outline" style={{ fontWeight: 700, fontSize: 11 }}>{seniority}</span>
                            <span className="caption">{total} personas</span>
                          </div>
                          <div className="flex-center gap-2">
                            <span style={{ fontSize: 11, color: DS.green, fontWeight: 600 }}>{ok} OK</span>
                            {revisar > 0 && (
                              <span style={{ fontSize: 11, color: DS.orange, fontWeight: 600 }}>{revisar} rev.</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: DS.gray2 }}>
                          <div style={{ width: `${pctOk}%`,  background: DS.green  }} />
                          <div style={{ width: `${pctRev}%`, background: DS.orange }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Brecha salarial */}
            <div className="card" style={{ height: '100%' }}>
              <div className="card-body flex-col" style={{ height: '100%' }}>
                <p className="section-title mb-3">Brecha salarial</p>
                {brechaStats ? (
                  <div className="flex-col gap-4" style={{ flex: 1, justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', background: 'rgba(201,106,0,.06)', borderRadius: 10, padding: '12px 0' }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: DS.orange, lineHeight: 1 }}>{brechaStats.count}</div>
                      <div style={{ fontSize: 10, color: DS.text2, textTransform: 'uppercase', letterSpacing: '.4px', marginTop: 4 }}>en revisar</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: DS.text2, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Brecha promedio</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: DS.red }}>{fmtAR(brechaStats.avg)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: DS.text2, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Mayor brecha</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: DS.red }}>{fmtAR(brechaStats.max)}</div>
                    </div>
                  </div>
                ) : (
                  <span className="body2">Sin datos</span>
                )}
              </div>
            </div>

          </div>
        </>
      )}

      {/* Historial de cargas */}
      <div className="card">
        <div className="card-body compact">
          <p className="section-title mb-2">Cargas registradas</p>
          <hr className="divider mb-2" />

          {loading ? (
            <div className="flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 36 }} />
              ))}
            </div>
          ) : imports.length === 0 ? (
            <p className="body2" style={{ textAlign: 'center', padding: '16px 0' }}>
              No hay importaciones aun.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Periodo</th>
                    <th>Fecha carga</th>
                    <th className="right">Registros</th>
                    <th>Archivo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map(imp => (
                    <tr key={imp.id}>
                      <td><span className="badge badge-default">{imp.id}</span></td>
                      <td><strong>{imp.periodo}</strong></td>
                      <td>{imp.fechaCarga}</td>
                      <td className="right">{imp.totalRegistros}</td>
                      <td><span className="caption">{imp.archivoFuente}</span></td>
                      <td>
                        <div className="flex-center gap-2">
                          <Link
                            to={`/tabla?import_id=${imp.id}`}
                            className="btn-outline btn-sm"
                            style={{ textDecoration: 'none' }}
                          >
                            📋 Ver tabla
                          </Link>
                          <button
                            className="icon-btn danger"
                            title="Eliminar periodo"
                            onClick={() => setConfirmDel({ id: imp.id, periodo: imp.periodo })}
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Upload modal */}
      <UploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); load() }}
      />

      {/* Delete confirm modal */}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDel(null)}>
          <div className="modal sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">Eliminar periodo?</div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: DS.text2, lineHeight: 1.5 }}>
                Se eliminara el snapshot <strong>{confirmDel.periodo}</strong> y todos
                los datos de empleados asociados. Esta accion <strong>no se puede deshacer</strong>.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setConfirmDel(null)} disabled={deleting}>
                Cancelar
              </button>
              <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
