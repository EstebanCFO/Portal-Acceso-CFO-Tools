import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getSnapshots, getEmpleados } from '../api/client'
import { DS } from '../theme'
import { efectivoEstado } from '../utils/estado'
import { fmtPeriodo, fmtFecha, snapshotLabel } from '../utils/snapshots'
import type { ImportacionRow, BandaSalarial } from '../types'

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmtAR = (v: number | null | undefined) =>
  v == null ? '—' : '$ ' + Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })

// ── Sub-components ─────────────────────────────────────────────────────────────
function EstadoBadge({ estado, varPct }: { estado: string | null | undefined; varPct?: string | null }) {
  const eff = efectivoEstado(estado, varPct)
  if (!eff)              return <span className="badge badge-default">Sin banda</span>
  if (eff === 'OK')      return <span className="badge badge-success">OK</span>
  if (eff === 'REVISAR') return <span className="badge badge-warning">Revisar</span>
  return <span className="badge badge-default">{eff}</span>
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

// ── Colores DS para jsPDF ──────────────────────────────────────────────────────
const C = {
  navy:    [10,  31,  68]  as [number,number,number],
  navyDk:  [11,  21,  38]  as [number,number,number],
  green:   [0,   135, 90]  as [number,number,number],
  logoGrn: [0,   168, 120] as [number,number,number],
  accent:  [79,  209, 178] as [number,number,number],
  red:     [192, 57,  43]  as [number,number,number],
  orange:  [201, 106, 0]   as [number,number,number],
  gray1:   [244, 246, 249] as [number,number,number],
  gray2:   [232, 236, 242] as [number,number,number],
  gray3:   [197, 205, 216] as [number,number,number],
  text:    [13,  27,  42]  as [number,number,number],
  text2:   [74,  85,  104] as [number,number,number],
  white:   [255, 255, 255] as [number,number,number],
}

// ── Generador PDF (jsPDF + autoTable) ─────────────────────────────────────────
function savePDF(
  snap:    ImportacionRow | undefined,
  filtros: { label: string; value: string }[],
  data:    BandaSalarial[],
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  // A4 landscape: 297 × 210 mm
  const PW = 297, margin = 12
  const now = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const periodoLabel = snap ? snapshotLabel(snap) : '—'

  // ── Header ────────────────────────────────────────────────────────────────
  let y = margin

  // Franja navy de fondo
  doc.setFillColor(...C.navyDk)
  doc.rect(0, 0, PW, 22, 'F')

  // Logo CFO (cuadrado verde redondeado — simulado con rect)
  doc.setFillColor(...C.logoGrn)
  doc.roundedRect(margin, y + 2, 14, 14, 2, 2, 'F')
  doc.setTextColor(...C.white)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('CFO', margin + 7, y + 11, { align: 'center' })

  // Título "CFOTech IT Tools"
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text('CFOTech', margin + 18, y + 8)
  const cfotechW = doc.getTextWidth('CFOTech')
  doc.setTextColor(...C.accent)
  doc.text(' IT Tools', margin + 18 + cfotechW, y + 8)

  // Subtítulo
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(220, 225, 235)
  doc.text('Bandas Salariales DC — Reporte de empleados', margin + 18, y + 14)

  // Bloque meta (derecha)
  doc.setFontSize(7.5)
  doc.setTextColor(180, 190, 205)
  const metaX = PW - margin
  doc.text(`Periodo: ${periodoLabel}`, metaX, y + 6, { align: 'right' })
  doc.text(`Generado: ${now}`, metaX, y + 11, { align: 'right' })
  if (snap) doc.text(`Total en periodo: ${snap.totalRegistros} empleados`, metaX, y + 16, { align: 'right' })

  y = 26

  // ── Sección filtros ────────────────────────────────────────────────────────
  doc.setFillColor(...C.gray1)
  doc.setDrawColor(...C.gray2)

  if (filtros.length === 0) {
    doc.roundedRect(margin, y, PW - margin * 2, 7, 1, 1, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.text2)
    doc.text('Sin filtros aplicados — mostrando todos los empleados', margin + 4, y + 4.5)
    y += 10
  } else {
    // Una sola línea con todos los filtros
    const chips = filtros.map(f => `${f.label}: ${f.value}`).join('   |   ')
    const boxH = 7
    doc.roundedRect(margin, y, PW - margin * 2, boxH, 1, 1, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.text2)
    doc.text('Filtros: ', margin + 4, y + 4.5)
    const labelW = doc.getTextWidth('Filtros: ')
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.text)
    doc.text(chips, margin + 4 + labelW, y + 4.5)
    y += boxH + 3
  }

  // Conteo
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.text2)
  doc.text(`Mostrando ${data.length} empleado${data.length !== 1 ? 's' : ''} con los filtros aplicados`, margin, y)
  y += 4

  // ── Tabla ──────────────────────────────────────────────────────────────────
  const tableBody = data.map(r => {
    const eff    = efectivoEstado(r.estadoVsInf, r.varPct)
    const estado = eff ?? 'Sin banda'

    let varTxt = r.varPct ?? '—'
    if (r.varPct && r.varPct !== 'EN BANDA') {
      const n = parseFloat(r.varPct)
      if (!isNaN(n)) varTxt = (n < 0 ? '▼ ' : '▲ ') + r.varPct
    }

    return [
      r.apellidos ?? '',
      r.nombres   ?? '',
      r.perfil    ?? '',
      r.seniority ?? '—',
      fmtAR(r.remuneracion),
      fmtAR(r.limInferior),
      fmtAR(r.limSuperior),
      estado,
      varTxt,
      r.ceco?.split(' - ').at(-1) ?? '—',
    ]
  })

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Apellido', 'Nombre', 'Perfil', 'Sen.', 'Remuneración', 'Lím. Inf.', 'Lím. Sup.', 'Estado', 'Var%', 'CECO']],
    body: tableBody,
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      font: 'helvetica',
      textColor: C.text,
      lineColor: C.gray2,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: C.navy,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] as [number,number,number],
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right', textColor: C.text2, fontSize: 7 },
      6: { halign: 'right', textColor: C.text2, fontSize: 7 },
      7: { halign: 'center' },
      8: { halign: 'right' },
      9: { textColor: C.text2, fontSize: 7 },
    },
    // Colorear celdas de Estado y Var%
    didParseCell(info) {
      if (info.section !== 'body') return
      // Columna Estado (índice 7)
      if (info.column.index === 7) {
        const v = String(info.cell.raw ?? '')
        if (v === 'OK')       { info.cell.styles.textColor = C.green;  info.cell.styles.fontStyle = 'bold' }
        if (v === 'REVISAR')  { info.cell.styles.textColor = C.orange; info.cell.styles.fontStyle = 'bold' }
        if (v === 'Sin banda'){ info.cell.styles.textColor = C.text2  }
      }
      // Columna Var% (índice 8)
      if (info.column.index === 8) {
        const v = String(info.cell.raw ?? '')
        if (v === 'EN BANDA') { info.cell.styles.textColor = C.green;  info.cell.styles.fontStyle = 'bold' }
        else if (v.startsWith('▲')) { info.cell.styles.textColor = C.green  }
        else if (v.startsWith('▼')) { info.cell.styles.textColor = C.red    }
      }
    },
    // Footer con número de página
    didDrawPage(info) {
      const pageH = doc.internal.pageSize.height
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.text2)
      doc.text('CFOTech Latam · Delivery Center · Informe confidencial', margin, pageH - 5)
      doc.text(
        `Página ${info.pageNumber}  ·  Bandas Salariales DC — ${periodoLabel}`,
        PW - margin, pageH - 5, { align: 'right' },
      )
      // Línea separadora footer
      doc.setDrawColor(...C.gray3)
      doc.setLineWidth(0.3)
      doc.line(margin, pageH - 8, PW - margin, pageH - 8)
    },
  })

  // Nombre de archivo: BandasSalariales_JuniO2026_2026-06-24.pdf
  const fecha   = new Date().toISOString().slice(0, 10)
  const periodo = snap ? snap.periodo.replace('-', '') : 'sin-periodo'
  doc.save(`BandasSalariales_${periodo}_${fecha}.pdf`)
}

// ── Main component ─────────────────────────────────────────────────────────────
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
    // Usa el estado efectivo: REVISAR + 0% → OK (eximido)
    const eff = efectivoEstado(r.estadoVsInf, r.varPct)
    let okEst = true
    if (filtroEst === 'null') okEst = !eff
    else if (filtroEst)       okEst = eff === filtroEst
    return okSen && okCeco && okBusc && okEst
  }), [rows, filtroSen, filtroEst, filtroCeco, busqueda])

  // varPct contiene "EN BANDA", "-7%", "5%", null — convierte a número para ordenar
  function varPctNum(v: string | null | undefined): number {
    if (!v) return -Infinity
    if (v === 'EN BANDA') return 0
    const n = parseFloat(v)
    return isNaN(n) ? -Infinity : n
  }

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    // Orden numérico semántico para varPct
    if (orderBy === 'varPct') {
      const diff = varPctNum(a.varPct) - varPctNum(b.varPct)
      return order === 'asc' ? diff : -diff
    }
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

  // ── Guardar Reporte PDF ─────────────────────────────────────────────────────
  function handleSavePDF() {
    const snap = snapshots.find(s => s.id === importId)

    const filtros: { label: string; value: string }[] = []
    if (filtroSen)            filtros.push({ label: 'Seniority', value: filtroSen })
    if (filtroEst === 'null') filtros.push({ label: 'Estado',    value: 'Sin banda' })
    else if (filtroEst)       filtros.push({ label: 'Estado',    value: filtroEst })
    if (filtroCeco)           filtros.push({ label: 'CECO',      value: filtroCeco.split(' - ').at(-1) ?? filtroCeco })
    if (busqueda.trim())      filtros.push({ label: 'Búsqueda',  value: `"${busqueda.trim()}"` })

    savePDF(snap, filtros, sorted)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <h2 className="page-title mb-3">Tabla de empleados</h2>

      {/* Filters bar */}
      <div className="card mb-3">
        <div className="card-body compact" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>

          <div className="form-group" style={{ minWidth: 220 }}>
            <label className="form-label">Snapshot</label>
            <select
              className="select-field"
              value={importId?.toString() ?? ''}
              onChange={e => { setImportId(parseInt(e.target.value)); setPage(0) }}
            >
              {snapshots.map(s => (
                <option key={s.id} value={s.id}>{snapshotLabel(s)}</option>
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
                { v: '',        label: 'Todos'     },
                { v: 'OK',      label: 'OK'        },
                { v: 'REVISAR', label: 'Revisar'   },
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

          {/* Contador + botón imprimir */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="caption">{filtered.length} empleados</span>
            <button
              className="btn-print"
              onClick={handleSavePDF}
              disabled={loading || sorted.length === 0}
              title="Descargar reporte PDF con los filtros actuales"
            >
              📥 Guardar Reporte
            </button>
          </div>
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
                <th className="right"><button className={sortClass('varPct')} onClick={() => handleSort('varPct')}>Var%</button></th>
                <th><button className={sortClass('ceco')} onClick={() => handleSort('ceco')}>CECO</button></th>
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
                  <td className="center"><EstadoBadge estado={r.estadoVsInf} varPct={r.varPct} /></td>
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
