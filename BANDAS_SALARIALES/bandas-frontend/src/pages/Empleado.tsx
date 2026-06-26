import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'
import { getEmpleado, buscarEmpleados } from '../api/client'
import { DS } from '../theme'
import { efectivoEstado } from '../utils/estado'
import type { EmpleadoDetalle, EmpleadoBusqueda } from '../types'

const fmtAR = (v: number | null | undefined) =>
  v == null ? '—' : '$ ' + Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })

const fmtTooltip = (v: ValueType | undefined): string => {
  if (v == null || typeof v !== 'number') return '—'
  return '$ ' + Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

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
  const neg = v.startsWith('-')
  return <span style={{ color: neg ? DS.red : DS.green, fontWeight: 600 }}>{v}</span>
}

interface ChartPoint {
  fecha:        string
  remuneracion: number | null
  limInferior:  number | null
  limSuperior:  number | null
}

export default function Empleado() {
  const [searchParams]        = useSearchParams()
  const navigate               = useNavigate()
  const [query,   setQuery]   = useState('')
  const [suggs,   setSuggs]   = useState<EmpleadoBusqueda[]>([])
  const [cuil,    setCuil]    = useState(searchParams.get('cuil') ?? '')
  const [detalle, setDetalle] = useState<EmpleadoDetalle | null>(null)
  const [loading, setLoading] = useState(false)
  const [notFound, setNF]     = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const c = searchParams.get('cuil')
    if (c) loadEmpleado(c)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    clearTimeout(timerRef.current)
    abortRef.current?.abort()              // cancela request anterior (S1-5)
    if (v.length < 2) { setSuggs([]); return }
    timerRef.current = setTimeout(async () => {
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const { data } = await buscarEmpleados(v)
        if (!ctrl.signal.aborted) setSuggs(data)
      } catch { /* descartado si fue abortado por nueva keystroke */ }
    }, 250)
  }

  function selectSugg(e: EmpleadoBusqueda) {
    setQuery(`${e.apellidos} ${e.nombres}`)
    setCuil(e.cuil)
    setSuggs([])
  }

  async function loadEmpleado(c: string) {
    setLoading(true)
    setNF(false)
    setDetalle(null)
    try {
      const { data } = await getEmpleado(c)
      setDetalle(data)
      navigate(`/empleado?cuil=${c}`, { replace: true })
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 404) setNF(true)
    } finally {
      setLoading(false)
    }
  }

  function handleBuscar() {
    if (cuil) loadEmpleado(cuil)
  }

  const chartData: ChartPoint[] = detalle?.historial.map(h => ({
    fecha:        h.fechaCarga ?? '',
    remuneracion: h.remuneracion,
    limInferior:  h.limInferior,
    limSuperior:  h.limSuperior,
  })) ?? []

  return (
    <div>
      <h2 className="page-title mb-3">Evolucion por empleado</h2>

      {/* Buscador */}
      <div className="card mb-3">
        <div className="card-body">
          <div style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ minWidth: 280 }}>
              <label className="form-label">Buscar empleado</label>
              <input
                className="input-field"
                placeholder="Apellido, nombre o CUIL..."
                value={query}
                onChange={handleQueryChange}
                onKeyDown={e => { if (e.key === 'Enter') handleBuscar() }}
                autoComplete="off"
              />
            </div>
            <button className="btn-primary" onClick={handleBuscar} disabled={!cuil}>
              🔍 Ver historial
            </button>

            {/* Autocomplete dropdown */}
            {suggs.length > 0 && (
              <div className="dropdown-list">
                {suggs.map(e => (
                  <div
                    key={e.cuil}
                    className="dropdown-item"
                    onClick={() => { selectSugg(e); setCuil(e.cuil) }}
                  >
                    <div className="di-primary">{e.apellidos}, {e.nombres}</div>
                    <div className="di-secondary">{e.perfil} · {e.seniority} · {e.cuil}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="progress-bar mb-3">
          <div className="progress-fill indeterminate" />
        </div>
      )}

      {notFound && (
        <div className="alert alert-warning mb-3">
          No se encontro el empleado con CUIL <strong>{cuil}</strong>.
        </div>
      )}

      {detalle && (
        <>
          {/* Empleado card */}
          <div className="card mb-3">
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div className="avatar avatar-lg">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                    {detalle.apellidos}, {detalle.nombres}
                  </h3>
                  <div className="flex-center gap-2">
                    <span className="badge badge-primary">{detalle.perfil}</span>
                    <span className="badge badge-outline">{detalle.seniority}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="caption" style={{ marginBottom: 2 }}>CUIL: <strong>{detalle.cuil}</strong></div>
                  <div className="caption" style={{ marginBottom: 2 }}>DNI: <strong>{detalle.dni ?? '—'}</strong></div>
                  <div className="caption" style={{ marginBottom: 2 }}>Ingreso: <strong>{detalle.fechaIngreso ?? '—'}</strong></div>
                  {detalle.ceco && <div className="caption c-text2">{detalle.ceco}</div>}
                </div>
              </div>
            </div>
          </div>

          {detalle.historial.length === 0 ? (
            <div className="alert alert-info">Este empleado no tiene historial en la base de datos.</div>
          ) : (
            <>
              {/* Chart */}
              <div className="card mb-3">
                <div className="card-body">
                  <p className="section-title mb-2">Evolucion de remuneracion</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                      <YAxis
                        tickFormatter={(v: number) => '$ ' + (v / 1000).toFixed(0) + 'k'}
                        tick={{ fontSize: 11 }}
                      />
                      <RTooltip
                        formatter={(v: ValueType | undefined, name: NameType | undefined) =>
                          [fmtTooltip(v), String(name ?? '')]
                        }
                      />
                      <Legend />
                      <Line type="monotone" dataKey="remuneracion" name="Remuneracion"
                        stroke={DS.navy} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="limInferior" name="Lim. inferior"
                        stroke={DS.orange} strokeDasharray="5 4" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="limSuperior" name="Lim. superior"
                        stroke={DS.green}  strokeDasharray="5 4" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* History table */}
              <div className="card">
                <div className="card-body no-pad">
                  <p className="section-title" style={{ padding: '12px 16px 8px' }}>Historial de snapshots</p>
                  <hr className="divider" />
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {['Fecha', 'Periodo', 'Perfil', 'Sen.', 'Remuneracion', 'Lim. Inf.', 'Lim. Sup.', 'Estado', 'Var%'].map(h => (
                            <th
                              key={h}
                              className={['Remuneracion','Lim. Inf.','Lim. Sup.'].includes(h) ? 'right' : undefined}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.historial.map((h, i) => {
                          const eff = efectivoEstado(h.estadoVsInf, h.varPct)
                          return (
                            <tr key={i} style={{
                              background: eff === 'OK'      ? 'rgba(0,135,90,.06)'
                                        : eff === 'REVISAR' ? 'rgba(201,106,0,.07)'
                                        : undefined,
                            }}>
                              <td>{h.fechaCarga}</td>
                              <td><strong>{h.periodo}</strong></td>
                              <td><span className="fs-11 c-text2">{h.perfil}</span></td>
                              <td><span className="badge badge-outline">{h.seniority ?? '—'}</span></td>
                              <td className="right fw-600">{fmtAR(h.remuneracion)}</td>
                              <td className="right"><span className="caption">{fmtAR(h.limInferior)}</span></td>
                              <td className="right"><span className="caption">{fmtAR(h.limSuperior)}</span></td>
                              <td><EstadoBadge estado={h.estadoVsInf} varPct={h.varPct} /></td>
                              <td><VarPct v={h.varPct} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
