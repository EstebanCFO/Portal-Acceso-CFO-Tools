import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getSnapshots, getEmpleados } from '../api/client'
import { DS } from '../theme'
import type { ImportacionRow, BandaSalarial } from '../types'

const fmtAR = (v: number | null | undefined) =>
  v == null ? '—' : '$ ' + Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })

function EstadoBadge({ estado }: { estado: string | null | undefined }) {
  if (!estado)              return <span className="badge badge-default">Sin banda</span>
  if (estado === 'OK')      return <span className="badge badge-success">OK</span>
  if (estado === 'REVISAR') return <span className="badge badge-warning">Revisar</span>
  return <span className="badge badge-default">{estado}</span>
}

function VarPct({ v }: { v: string | null | undefined }) {
  if (!v) return <span style={{ color: DS.gray3 }}>—</span>
  if (v === 'EN BANDA')
    return <span style={{ color: DS.green, fontWeight: 700 }}>EN BANDA</span>
  const num = parseFloat(v)
  if (!isNaN(num)) {
    const color = num < 0 ? DS.red : DS.green
    const icon  = num < 0 ? '▼' : '▲'
    return <span style={{ color, fontWeight: 600 }}>{icon} {v}</span>
  }
  return <span>{v}</span>
}

type SortDir = 'asc' | 'desc'
type SortCol = keyof BandaSalarial

// ── Custom pagination ──────────────────────────────────────────────────────────
interface PaginationProps {
  count:        number
  page:         number
  rowsPerPage:  number
  rowsOptions:  number[]
  onPageChange: (p: number) => void
  onRowsChange: (rpp: number) => void
}
function Pagination({ count, page, rowsPerPage, rowsOptions, onPageChange, onRowsChange }: PaginationProps) {
  const from      = count === 0 ? 0 : page * rowsPerPage + 1
  const to        = Math.min((page + 1) * rowsPerPage, count)
  const pageCount = Math.ceil(count / rowsPerPage)
  return (
    <div className="tbl-pagination">
      <span className="rpp-label">Filas:</span>
      <select
        className="rpp-select"
        value={rowsPerPage}
        onChange={e => onRowsChange(parseInt(e.target.value))}
      >
        {rowsOptions.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
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

export default function Tabla() {
  const [searchParams]           = useSearchParams()
  const navigate                 = useNavigate()
  const [snapshots, setSnaps]    = useState<ImportacionRow[]>([])
  const [importId,  setImportId] = useState<number | null>(null)
  const [rows,      setRows]     = useState<BandaSalarial[]>([])
  const [loading,   setLoading]  = useState(false)

  const [filtroSen,   setFiltroSen]  = useState('')
  const [filtroEst,   setFiltroEst]  = useState('')
  const [filtroCeco,  setFiltroCeco] = useState('')
  const [busqueda,    setBusqueda]   = useState('')
  const [page,        setPage]       = useState(0)
  const [rowsPerPage, setRPP]        = useState(25)
  const [order,       setOrder]      = useState<SortDir>('asc')
  const [orderBy,     setOrderBy]    = useState<SortCol>('apellidos')

  useEffect(() => {
    getSnapshots().then(({ data }) => {
      setSnaps(data)
      const paramId = parseInt(searchParams.get('import_id') ?? '')
      const id = (!isNaN(paramId) ? paramId : null) ?? data[0]?.id ?? null
      setImportId(id)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!importId) return
    setLoading(true)
    getEmpleados(importId).then(({ data }) => setRows(data)).finally(() => setLoading(false))
  }, [importId])

  const cecos = useMemo(() =>
    [...new Set(rows.map(r => r.ceco).filter(Boolean) as string[])].sort(), [rows])

  const filtered = useMemo(() => rows.filter(r => {
    const okSen  = !filtroSen  || r.seniority === filtroSen
    const okCeco = !filtroCeco || r.ceco === filtroCeco
    const okBusc = !busqueda   ||
      `${r.apellidos} ${r.nombres} ${r.perfil}`.toLowerCase().includes(busqueda.toLowerCase())
    let okEst = true
    if (filtroEst === 'null') okEst = !r.estadoVsInf
    else if (filtroEst)       okEst = r.estadoVsInf === filtroEst
    return okSen && okCeco && okBusc && okEst
  }), [rows, filtroSen, filtroEst, filtroCeco, busqueda])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const va = a[orderBy] ?? ''
    const vb = b[orderBy] ?? ''
    if (typeof va === 'number') return order === 'asc' ? va - (vb as number) : (vb as number) - va
    return order === 'asc'
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va))
  }), [filtered, order, orderBy])

  const paged = sorted.slice(page * rowsPerPage, (page + 1) * rowsPerPage)

  function handleSort(col: SortCol) {
    if (orderBy === col) setOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setOrderBy(col); setOrder('asc') }
    setPage(0)
  }

  function sortClass(col: SortCol) {
    if (orderBy !== col) return 'sort-btn'
    return `sort-btn ${order}`
  }

  function toggleSen(v: string) { setFiltroSen(v === filtroSen && v !== '' ? '' : v); setPage(0) }
  function toggleEst(v: string) { setFiltroEst(v === filtroEst && v !== '' ? '' : v); setPage(0) }

  return (
    <div>
      <h2 className="page-title mb-3">Tabla de empleados</h2>

      {/* Filters bar */}
      <div className="card mb-3">
        <div className="card-body compact" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>

          <div className="form-group" style={{ minWidth: 200 }}>
            <label className="form-label">Snapshot</label>
            <select
              className="select-field"
              value={importId?.toString() ?? ''}
              onChange={e => { setImportId(parseInt(e.target.value)); setPage(0) }}
            >
              {snapshots.map(s => (
                <option key={s.id} value={s.id}>{s.periodo} · {s.fechaCarga}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: 180 }}>
            <label className="form-label">Buscar</label>
            <div className="input-wrapper">
              <span className="input-icon">🔍</span>
              <input
                className="input-field with-icon"
                placeholder="Buscar..."
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPage(0) }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Seniority</label>
            <div className="toggle-group">
              {['', 'JR', 'SSR', 'SR'].map(v => (
                <button
                  key={v}
                  className={`toggle-btn${filtroSen === v ? ' active' : ''}`}
                  onClick={() => toggleSen(v)}
                >
                  {v || 'Todos'}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Estado</label>
            <div className="toggle-group">
              {[
                { v: '',        label: 'Todos'    },
                { v: 'OK',      label: 'OK'       },
                { v: 'REVISAR', label: 'Revisar'  },
                { v: 'null',    label: 'Sin banda' },
              ].map(({ v, label }) => (
                <button
                  key={v}
                  className={`toggle-btn${filtroEst === v ? ' active' : ''}`}
                  onClick={() => toggleEst(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ minWidth: 160 }}>
            <label className="form-label">CECO</label>
            <select
              className="select-field"
              value={filtroCeco}
              onChange={e => { setFiltroCeco(e.target.value); setPage(0) }}
            >
              <option value="">Todos</option>
              {cecos.map(c => (
                <option key={c} value={c} title={c}>{c.split(' - ').at(-1)}</option>
              ))}
            </select>
          </div>

          <span className="caption ml-auto">{filtered.length} empleados</span>
        </div>
      </div>

      {loading && (
        <div className="progress-bar mb-2">
          <div className="progress-fill indeterminate" />
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th><button className={sortClass('apellidos')}    onClick={() => handleSort('apellidos')}>Apellido</button></th>
                <th><button className={sortClass('nombres')}      onClick={() => handleSort('nombres')}>Nombre</button></th>
                <th><button className={sortClass('perfil')}       onClick={() => handleSort('perfil')}>Perfil</button></th>
                <th><button className={sortClass('seniority')}    onClick={() => handleSort('seniority')}>Sen.</button></th>
                <th className="right"><button className={sortClass('remuneracion')} onClick={() => handleSort('remuneracion')}>Remuneracion</button></th>
                <th className="right">Lim. Inf.</th>
                <th className="right">Lim. Sup.</th>
                <th className="center">Estado</th>
                <th className="right">Var%</th>
                <th>CECO</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(r => (
                <tr key={r.cuil} className="clickable" onClick={() => navigate(`/empleado?cuil=${r.cuil}`)}>
                  <td><strong>{r.apellidos}</strong></td>
                  <td>{r.nombres}</td>
                  <td><span className="fs-11 c-text2">{r.perfil}</span></td>
                  <td><span className="badge badge-outline">{r.seniority ?? '—'}</span></td>
                  <td className="right fw-600">{fmtAR(r.remuneracion)}</td>
                  <td className="right"><span className="caption">{fmtAR(r.limInferior)}</span></td>
                  <td className="right"><span className="caption">{fmtAR(r.limSuperior)}</span></td>
                  <td className="center"><EstadoBadge estado={r.estadoVsInf} /></td>
                  <td className="right"><VarPct v={r.varPct} /></td>
                  <td>
                    <span
                      className="caption truncate"
                      style={{ maxWidth: 120, display: 'block' }}
                      title={r.ceco ?? ''}
                    >
                      {r.ceco?.split(' - ').at(-1) ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          count={filtered.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsOptions={[10, 25, 50]}
          onPageChange={p => setPage(p)}
          onRowsChange={rpp => { setRPP(rpp); setPage(0) }}
        />
      </div>
    </div>
  )
}
