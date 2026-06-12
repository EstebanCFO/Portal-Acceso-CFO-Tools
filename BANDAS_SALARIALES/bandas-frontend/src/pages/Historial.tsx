import { useEffect, useState, useMemo } from 'react'
import { getSnapshots, getComparativo } from '../api/client'
import { DS } from '../theme'
import type { ImportacionRow, ComparativoRow } from '../types'

const fmtAR = (v: number | null | undefined) =>
  v == null ? '—' : '$ ' + Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })

function EstadoBadge({ estado }: { estado: string | null | undefined }) {
  if (!estado)              return <span className="badge badge-default">Sin banda</span>
  if (estado === 'OK')      return <span className="badge badge-success">OK</span>
  if (estado === 'REVISAR') return <span className="badge badge-warning">Revisar</span>
  return <span className="badge badge-default">{estado}</span>
}

function MovBadge({ mov }: { mov: ComparativoRow['movimiento'] }) {
  if (mov === 'ingreso') return <span className="badge badge-success">+ Ingreso</span>
  if (mov === 'egreso')  return <span className="badge badge-error">− Egreso</span>
  return null
}

function VarSpan({ v }: { v: number | null }) {
  if (v == null) return <span style={{ color: DS.gray3 }}>—</span>
  const color = v < 0 ? DS.red : v > 0 ? DS.green : DS.text2
  const icon  = v < 0 ? '▼' : v > 0 ? '▲' : '→'
  return (
    <span style={{ color, fontWeight: 600 }}>
      {icon} {v > 0 ? '+' : ''}{v}%
    </span>
  )
}

function rowBg(r: ComparativoRow): string | undefined {
  if (r.movimiento === 'ingreso') return 'rgba(0,135,90,.08)'
  if (r.movimiento === 'egreso')  return 'rgba(192,57,43,.08)'
  if (r.estadoA === 'REVISAR' && r.estadoB === 'OK')  return 'rgba(0,135,90,.05)'
  if (r.estadoA === 'OK'      && r.estadoB === 'REVISAR') return 'rgba(201,106,0,.08)'
  return undefined
}

// ── Pagination ─────────────────────────────────────────────────────────────────
function Pagination({ count, page, rowsPerPage, onPageChange }: {
  count: number; page: number; rowsPerPage: number; onPageChange: (p: number) => void
}) {
  const from      = count === 0 ? 0 : page * rowsPerPage + 1
  const to        = Math.min((page + 1) * rowsPerPage, count)
  const pageCount = Math.ceil(count / rowsPerPage)
  return (
    <div className="tbl-pagination">
      <span className="pg-info">{from}–{to} de {count}</span>
      <div className="pg-btns">
        <button className="pg-btn" onClick={() => onPageChange(0)}              disabled={page === 0}>«</button>
        <button className="pg-btn" onClick={() => onPageChange(page - 1)}       disabled={page === 0}>‹</button>
        <button className="pg-btn" onClick={() => onPageChange(page + 1)}       disabled={page >= pageCount - 1}>›</button>
        <button className="pg-btn" onClick={() => onPageChange(pageCount - 1)}  disabled={page >= pageCount - 1}>»</button>
      </div>
    </div>
  )
}

export default function Historial() {
  const [snapshots, setSnaps]   = useState<ImportacionRow[]>([])
  const [idA,       setIdA]     = useState<number | ''>('')
  const [idB,       setIdB]     = useState<number | ''>('')
  const [data,      setData]    = useState<ComparativoRow[] | null>(null)
  const [loading,   setLoading] = useState(false)
  const [page,      setPage]    = useState(0)
  const rowsPerPage = 25

  useEffect(() => {
    getSnapshots().then(({ data: s }) => {
      setSnaps(s)
      if (s.length >= 2) { setIdA(s[1].id); setIdB(s[0].id) }
      else if (s.length === 1) { setIdA(s[0].id); setIdB(s[0].id) }
    })
  }, [])

  async function comparar() {
    if (!idA || !idB || idA === idB) return
    setLoading(true)
    try {
      const { data: d } = await getComparativo(idA as number, idB as number)
      setData(d)
      setPage(0)
    } finally {
      setLoading(false)
    }
  }

  const resumen = useMemo(() => {
    if (!data) return null
    return {
      ingresos: data.filter(r => r.movimiento === 'ingreso').length,
      egresos:  data.filter(r => r.movimiento === 'egreso').length,
      mejoro:   data.filter(r => r.estadoA === 'REVISAR' && r.estadoB === 'OK').length,
      empeoro:  data.filter(r => r.estadoA === 'OK'      && r.estadoB === 'REVISAR').length,
    }
  }, [data])

  const paged = data ? data.slice(page * rowsPerPage, (page + 1) * rowsPerPage) : []

  return (
    <div>
      <h2 className="page-title mb-3">Comparativo entre periodos</h2>

      {snapshots.length < 2 && (
        <div className="alert alert-info mb-3">
          Necesitas al menos <strong>2 periodos cargados</strong> para usar el comparativo.
          Actualmente hay {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}.
        </div>
      )}

      {snapshots.length >= 2 && (
        <>
          {/* Selector */}
          <div className="card mb-3">
            <div className="card-body">
              <div className="selector-grid">
                <div className="form-group">
                  <label className="form-label">Periodo A (base)</label>
                  <select
                    className="select-field"
                    value={idA?.toString() ?? ''}
                    onChange={e => setIdA(parseInt(e.target.value))}
                  >
                    {snapshots.map(s => (
                      <option key={s.id} value={s.id}>{s.periodo} · {s.fechaCarga}</option>
                    ))}
                  </select>
                </div>

                <div className="selector-arrow flex-center" style={{ paddingBottom: 2, color: DS.text2, fontSize: 20 }}>
                  →
                </div>

                <div className="form-group">
                  <label className="form-label">Periodo B (nuevo)</label>
                  <select
                    className="select-field"
                    value={idB?.toString() ?? ''}
                    onChange={e => setIdB(parseInt(e.target.value))}
                  >
                    {snapshots.map(s => (
                      <option key={s.id} value={s.id}>{s.periodo} · {s.fechaCarga}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">&nbsp;</label>
                  <button
                    className="btn-primary btn-full"
                    onClick={comparar}
                    disabled={!idA || !idB || idA === idB || loading}
                  >
                    Comparar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="progress-bar mb-2">
              <div className="progress-fill indeterminate" />
            </div>
          )}

          {/* Summary chips */}
          {resumen && (
            <div className="flex-wrap gap-2 mb-3">
              <span className="badge badge-success">+ {resumen.ingresos} ingresos</span>
              <span className="badge badge-error">− {resumen.egresos} egresos</span>
              <span className="badge badge-success">↑ {resumen.mejoro} mejoraron estado</span>
              <span className="badge badge-warning">↓ {resumen.empeoro} empeoraron</span>
            </div>
          )}

          {/* Comparativo table */}
          {data && (
            <div className="card">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {['Apellido', 'Nombres', 'Perfil', 'Sen.', 'Rem. A', 'Rem. B', 'Variacion', 'Estado A', 'Estado B', 'Movimiento'].map(h => (
                        <th
                          key={h}
                          className={['Rem. A', 'Rem. B', 'Variacion'].includes(h) ? 'right' : undefined}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((r, i) => (
                      <tr key={i} style={{ background: rowBg(r) }}>
                        <td><strong>{r.apellidos ?? '—'}</strong></td>
                        <td>{r.nombres ?? '—'}</td>
                        <td><span className="fs-11 c-text2">{r.perfil ?? '—'}</span></td>
                        <td><span className="badge badge-outline">{r.seniority ?? '—'}</span></td>
                        <td className="right">{fmtAR(r.remA)}</td>
                        <td className="right fw-600">{fmtAR(r.remB)}</td>
                        <td className="right"><VarSpan v={r.variacionPct} /></td>
                        <td><EstadoBadge estado={r.estadoA} /></td>
                        <td><EstadoBadge estado={r.estadoB} /></td>
                        <td><MovBadge mov={r.movimiento} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                count={data.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={p => setPage(p)}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
