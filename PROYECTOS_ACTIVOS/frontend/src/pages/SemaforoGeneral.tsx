import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client'
import { IN_PORTAL } from '../App'
import type { Periodo, SemaforoGeneral as SemaforoData, SemaforoRow, IngestResult } from '../types'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = {
  pct:  (v: number | null) => v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`,
  ars:  (v: number | null) => v == null ? '—'
    : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(v)),
}

function VarCell({ val }: { val: number | null }) {
  if (val == null) return <span className="pa-var-neu">—</span>
  const n = Number(val) * 100
  const cls = n > 0 ? 'pa-var-pos' : n < 0 ? 'pa-var-neg' : 'pa-var-neu'
  return <span className={cls}>{n > 0 ? '+' : ''}{n.toFixed(1)}%</span>
}

function ColorBadge({ colorHex, colorLabel }: { colorHex: string | null; colorLabel: string | null }) {
  if (!colorHex) return <span className="pa-var-neu">—</span>
  const text = colorLabel?.replace('_', ' ') ?? ''
  return (
    <span
      className="pa-color-badge"
      style={{ background: colorHex + '28', color: colorHex.replace('#', '').length === 6 ? darken(colorHex) : colorHex }}
    >
      <span className="pa-dot" style={{ background: colorHex }} />
      {text}
    </span>
  )
}

/** Darkens a hex color slightly for readable text on light tinted backgrounds */
function darken(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, ((n >> 16) & 0xff) - 60)
  const g = Math.max(0, ((n >> 8)  & 0xff) - 60)
  const b = Math.max(0, ( n        & 0xff) - 60)
  return `rgb(${r},${g},${b})`
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  onSelectProject: (id: number, period: string, name: string, client: string) => void
  onSalir:         () => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SemaforoGeneral({ onSelectProject, onSalir }: Props) {
  const [periodos,      setPeriodos]      = useState<Periodo[]>([])
  const [period,        setPeriod]        = useState<string>('')
  const [tipo,          setTipo]          = useState<'ACUMULADO' | 'MENSUAL'>('ACUMULADO')
  const [data,          setData]          = useState<SemaforoData | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [uploading,     setUploading]     = useState(false)
  const [ingestResult,  setIngestResult]  = useState<IngestResult | null>(null)
  const [ingestError,   setIngestError]   = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Carga períodos disponibles al montar
  useEffect(() => {
    api.periodos().then(ps => {
      setPeriodos(ps)
      if (ps.length > 0) setPeriod(ps[0].period_date)
    }).catch(e => setError(String(e)))
  }, [])

  // Carga semáforo cuando cambia período o tipo
  const loadSemaforo = useCallback(() => {
    if (!period) return
    setLoading(true)
    setError(null)
    api.semaforo(period, tipo)
      .then(d => setData(d))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [period, tipo])

  useEffect(() => { loadSemaforo() }, [loadSemaforo])

  function handleRowClick(row: SemaforoRow) {
    if (!row.project_id) return
    const name = row.project_name || row.project_id.toString()
    onSelectProject(row.project_id, period, name, row.cliente_name ?? '')
  }

  function handleUploadClick() {
    setIngestResult(null)
    setIngestError(null)
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input para permitir re-subir el mismo archivo
    e.target.value = ''

    setUploading(true)
    setIngestResult(null)
    setIngestError(null)
    try {
      const result = await api.ingest(file)
      setIngestResult(result)
      // Refrescar períodos y semáforo con los nuevos datos
      const ps = await api.periodos()
      setPeriodos(ps)
      if (ps.length > 0) {
        const newPeriod = ps[0].period_date
        setPeriod(newPeriod)
      }
    } catch (err) {
      setIngestError(String(err))
    } finally {
      setUploading(false)
    }
  }

  const labelFor = (pd: string) => periodos.find(p => p.period_date === pd)?.label ?? pd

  return (
    <div className="pa-root">
      {/* Header — solo en standalone */}
      {!IN_PORTAL && (
        <header className="pa-header">
          <div className="pa-logo">PA</div>
          <div className="pa-brand">
            <span className="pa-brand__name">Proyectos Activos</span>
            <span className="pa-brand__sub">CFOTech Latam</span>
          </div>
          <div className="pa-divider" />
          <span style={{ color: 'rgba(255,255,255,.45)', fontSize: 12 }}>
            {labelFor(period)}
          </span>
          <div className="pa-header__spacer" />
          <button className="pa-btn-salir" onClick={onSalir}>Salir →</button>
        </header>
      )}

      {/* Filter bar */}
      <div className="pa-filterbar">
        <span className="pa-filterbar__label">Período</span>
        <select
          className="pa-select"
          value={period}
          onChange={e => setPeriod(e.target.value)}
        >
          {periodos.map(p => (
            <option key={p.period_date} value={p.period_date}>{p.label}</option>
          ))}
        </select>

        <div className="pa-divider" style={{ background: 'var(--gray3)', height: 20 }} />

        <div className="pa-toggle">
          {(['ACUMULADO', 'MENSUAL'] as const).map(t => (
            <button
              key={t}
              className={`pa-toggle__btn${tipo === t ? ' active' : ''}`}
              onClick={() => setTipo(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="pa-header__spacer" />

        {/* Referencia de colores */}
        {data && data.referencia.length > 0 && (
          <div className="pa-referencia">
            {data.referencia.map(r => (
              <div key={r.color_label} className="pa-ref-item">
                <span className="pa-dot" style={{ background: r.color_hex }} />
                <span>{r.description.split('—')[0].trim()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Botón Subir Excel */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className="pa-btn-upload"
          onClick={handleUploadClick}
          disabled={uploading}
          title="Actualizar datos subiendo el Excel de Proyectos Activos"
        >
          {uploading ? (
            <><span className="pa-upload-spinner" /> Procesando…</>
          ) : (
            <>📤 Subir Excel</>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="pa-body">
        {error && <div className="pa-error">⚠ {error}</div>}

        {/* Banner resultado ingesta */}
        {ingestError && (
          <div className="pa-ingest-banner pa-ingest-banner--error">
            ❌ Error al procesar el Excel: {ingestError}
          </div>
        )}
        {ingestResult && (
          <div className="pa-ingest-banner pa-ingest-banner--ok">
            ✅ Excel procesado correctamente
            {ingestResult.period && <> · Período: <strong>{ingestResult.period.slice(0,7)}</strong></>}
            {' '} · <strong>{ingestResult.solapas_real}</strong> proyectos
            · <strong>{ingestResult.recursos_total}</strong> recursos
            · Semáforo: <strong>{ingestResult.semaforo_matched}</strong> coincidentes
            {ingestResult.semaforo_unmatched > 0 && (
              <span style={{ color: 'var(--warning)' }}>
                {' '}· {ingestResult.semaforo_unmatched} sin match: {ingestResult.unmatched_names.join(', ')}
              </span>
            )}
          </div>
        )}

        {loading && <div className="pa-spinner" />}

        {!loading && data && (
          <>
            {/* Tabla de proyectos */}
            <div className="pa-card">
              <div className="pa-card__header">
                <span className="pa-card__title">
                  Semáforo General — {tipo} &nbsp;·&nbsp; {labelFor(period)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {data.proyectos.length} proyecto{data.proyectos.length !== 1 ? 's' : ''}
                </span>
              </div>

              {data.proyectos.length === 0 ? (
                <div className="pa-empty">
                  No hay datos de semáforo para este período.<br />
                  <small>Ejecutar el ETL para cargar los datos.</small>
                </div>
              ) : (
                <div className="pa-table-wrap">
                  <table className="pa-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Cliente</th>
                        <th>Proyecto</th>
                        <th className="right">Res. Real</th>
                        <th className="right">Res. Esperado</th>
                        <th className="right">Variación</th>
                        <th className="right">Facturación</th>
                        <th>Semáforo</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.proyectos.map((row, i) => (
                        <tr
                          key={row.project_id ?? i}
                          className={row.project_id ? 'clickable' : ''}
                          onClick={() => handleRowClick(row)}
                          title={row.project_id ? 'Ver Ejercicio Económico →' : ''}
                        >
                          <td className="center">
                            <span className="pa-dot" style={{ background: row.color_hex ?? '#CBD2DC' }} />
                          </td>
                          <td style={{ fontWeight: 600 }}>{row.cliente_name ?? '—'}</td>
                          <td>
                            {row.project_name
                              ? row.project_name
                              : <span className="pa-name-empty">sin nombre</span>
                            }
                            {row.tipo && <span className="pa-tipo" style={{ marginLeft: 6 }}>{row.tipo}</span>}
                          </td>
                          <td className="right" style={{ fontWeight: 700 }}>{fmt.pct(row.resultado_real)}</td>
                          <td className="right">{fmt.pct(row.resultado_esperado)}</td>
                          <td className="right"><VarCell val={row.variacion_pct} /></td>
                          <td className="right">{fmt.ars(row.facturacion_real)}</td>
                          <td><ColorBadge colorHex={row.color_hex} colorLabel={row.color_label} /></td>
                          <td><span className="pa-accion" title={row.accion_sugerida ?? ''}>{row.accion_sugerida ?? '—'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* DC Metrics */}
            {data.dc_metrics && (
              <div className="pa-card">
                <div className="pa-card__header">
                  <span className="pa-card__title">Delivery Center — Métricas Globales</span>
                </div>
                <div className="pa-card__body">
                  <div className="pa-kpi-grid">
                    <div className="pa-kpi">
                      <div className="pa-kpi__label">Resultado Comercial</div>
                      <div className="pa-kpi__value">{fmt.pct(data.dc_metrics.resultado_comercial_pct)}</div>
                      <div className="pa-kpi__sub">{fmt.ars(data.dc_metrics.resultado_comercial)}</div>
                    </div>
                    <div className="pa-kpi">
                      <div className="pa-kpi__label">Neto Bench</div>
                      <div className="pa-kpi__value">{fmt.pct(data.dc_metrics.resultado_comercial_neto_bench_pct)}</div>
                      <div className="pa-kpi__sub">{fmt.ars(data.dc_metrics.resultado_comercial_neto_bench)}</div>
                    </div>
                    <div className="pa-kpi">
                      <div className="pa-kpi__label">Costo Total Bench</div>
                      <div className="pa-kpi__value">{fmt.ars(data.dc_metrics.costo_total_bench)}</div>
                    </div>
                    <div className="pa-kpi">
                      <div className="pa-kpi__label">Recursos DC</div>
                      <div className="pa-kpi__value">{data.dc_metrics.recursos_delivery_center ?? '—'}</div>
                      <div className="pa-kpi__sub">
                        Bench: {data.dc_metrics.total_recursos_bench ?? '—'}
                      </div>
                    </div>
                    <div className="pa-kpi">
                      <div className="pa-kpi__label">Bench Manpower</div>
                      <div className="pa-kpi__value">{fmt.ars(data.dc_metrics.costo_bench_manpower)}</div>
                    </div>
                    <div className="pa-kpi">
                      <div className="pa-kpi__label">Bench DC</div>
                      <div className="pa-kpi__value">{fmt.ars(data.dc_metrics.costo_bench_dc)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
