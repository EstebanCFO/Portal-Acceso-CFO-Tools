import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { api } from '../api/client'
import { IN_PORTAL } from '../App'
import type { EjercicioEconomico as EjData, HistoryRow } from '../types'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = {
  pct: (v: number | null | undefined) =>
    v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`,
  ars: (v: number | null | undefined) =>
    v == null ? '—'
    : new Intl.NumberFormat('es-AR', {
        style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
      }).format(Number(v)),
  arsK: (v: number | null | undefined) => {
    if (v == null) return '—'
    const n = Number(v)
    return n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}K`
      : `$${n.toFixed(0)}`
  },
  period: (d: string) => {
    const [y, m] = d.split('-')
    const meses = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return `${meses[parseInt(m ?? '0')] ?? m} ${y}`
  },
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  projectId:   number
  period:      string
  projectName: string
  clientName:  string
  onBack:      () => void
  onSalir:     () => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function EjercicioEconomico({ projectId, period, projectName, clientName, onBack, onSalir }: Props) {
  const [data,    setData]    = useState<EjData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.ejercicio(projectId, period)
      .then(d => setData(d))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [projectId, period])

  const displayName = projectName || `Proyecto #${projectId}`
  // Usar el período real de los datos si ya cargó, si no el pedido
  const actualPeriod = data?.period_date ?? period
  const periodLabel  = fmt.period(actualPeriod)
  // Mostrar aviso si el período de datos difiere del período del semáforo
  const periodsDiffer = data != null &&
    data.semaforo_period_date != null &&
    data.period_date !== data.semaforo_period_date

  // Histórico solo de meses (no acumulado) para el gráfico
  const chartData: HistoryRow[] = data?.history.filter(h => !h.is_cumulative) ?? []
  const cumul = data?.history.find(h => h.is_cumulative)

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
          <span style={{ color: 'rgba(255,255,255,.55)', fontSize: 12 }}>
            {clientName} · {displayName}
          </span>
          <div className="pa-header__spacer" />
          <button className="pa-btn-salir" onClick={onSalir}>Salir →</button>
        </header>
      )}

      {/* Back bar */}
      <div className="pa-backbar">
        <button className="pa-back-btn" onClick={onBack}>
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M10.5 3L5.5 8l5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Semáforo General
        </button>
        <span className="pa-backbar__breadcrumb">
          <span style={{ color: 'var(--gray3)' }}>›</span>
          <strong>{clientName}</strong>
          <span style={{ color: 'var(--gray3)' }}>›</span>
          {displayName}
          <span style={{ color: 'var(--gray3)' }}>·</span>
          {periodLabel}
        </span>
        {periodsDiffer && (
          <span className="pa-period-notice">
            📅 Datos al {periodLabel} · Semáforo {fmt.period(data!.semaforo_period_date!)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="pa-body">
        {error && <div className="pa-error">⚠ {error}</div>}
        {loading && <div className="pa-spinner" />}

        {!loading && data && (
          <>
            {/* ── Resumen Financiero ─────────────────────────────────────────── */}
            <div className="pa-card">
              <div className="pa-card__header">
                <span className="pa-card__title">Resumen Financiero</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{periodLabel}</span>
              </div>
              <div className="pa-card__body">
                {data.financials ? (
                  <div className="pa-fin-grid">
                    {/* Resultado badge con color del semáforo */}
                    <div
                      className="pa-result-badge"
                      style={{ background: data.financials.color_hex ?? 'var(--navy)' }}
                    >
                      <span className="pa-result-badge__pct">
                        {fmt.pct(data.financials.result_percentage)}
                      </span>
                      <span className="pa-result-badge__label">
                        {data.financials.color_label?.replace('_', ' ') ?? 'Resultado'}
                      </span>
                    </div>

                    {/* Detalle financiero */}
                    <div className="pa-fin-details">
                      <div className="pa-fin-item">
                        <div className="pa-fin-item__label">Precio c/ IVA</div>
                        <div className="pa-fin-item__value">{fmt.ars(data.financials.sale_price_with_vat)}</div>
                      </div>
                      <div className="pa-fin-item">
                        <div className="pa-fin-item__label">Precio Mensual</div>
                        <div className="pa-fin-item__value">{fmt.ars(data.financials.monthly_sale_price)}</div>
                      </div>
                      <div className="pa-fin-item">
                        <div className="pa-fin-item__label">Margen Comercial</div>
                        <div className="pa-fin-item__value">{fmt.ars(data.financials.commercial_margin_value)}</div>
                      </div>
                      <div className="pa-fin-item">
                        <div className="pa-fin-item__label">Comisión Comercial</div>
                        <div className="pa-fin-item__value">{fmt.ars(data.financials.commercial_commission)}</div>
                      </div>
                      <div className="pa-fin-item">
                        <div className="pa-fin-item__label">Peaje / WHT</div>
                        <div className="pa-fin-item__value">
                          {fmt.pct(data.financials.peaje_wht_percentage)}
                          &nbsp;·&nbsp;
                          {fmt.ars(data.financials.peaje_wht_value)}
                        </div>
                      </div>
                      <div className="pa-fin-item">
                        <div className="pa-fin-item__label">Resultado Proyecto</div>
                        <div className="pa-fin-item__value">{fmt.ars(data.financials.project_result)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pa-empty">Sin datos financieros para este período.</div>
                )}
              </div>
            </div>

            {/* ── Recursos ──────────────────────────────────────────────────── */}
            <div className="pa-card">
              <div className="pa-card__header">
                <span className="pa-card__title">Recursos</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {data.total_recursos} recurso{data.total_recursos !== 1 ? 's' : ''}
                  &nbsp;·&nbsp;
                  {Number(data.total_horas).toFixed(0)} hs totales
                  &nbsp;·&nbsp;
                  Costo: {fmt.ars(data.costo_total_recursos)}
                </span>
              </div>

              {data.recursos.length === 0 ? (
                <div className="pa-empty">Sin recursos registrados para este período.</div>
              ) : (
                <div className="pa-table-wrap">
                  <table className="pa-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Perfil</th>
                        <th>Contrato</th>
                        <th>CeCo</th>
                        <th className="right">Hs Total</th>
                        <th className="right">Hs Mes</th>
                        <th className="right">Hs Extra</th>
                        <th className="right">Salario</th>
                        <th className="right">Costo Mensual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recursos.map(r => (
                        <tr key={r.dni}>
                          <td style={{ fontWeight: 600 }}>{r.nombre_completo}</td>
                          <td>{r.role_name}</td>
                          <td>
                            <span className="pa-tipo">{r.contract_type}</span>
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.code_ceco}</td>
                          <td className="right">{Number(r.total_hours).toFixed(0)}</td>
                          <td className="right">{Number(r.monthly_hours).toFixed(0)}</td>
                          <td className="right">{Number(r.extra_hours).toFixed(0)}</td>
                          <td className="right">{fmt.arsK(r.monthly_salary)}</td>
                          <td className="right" style={{ fontWeight: 600 }}>{fmt.arsK(r.total_monthly_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--gray1)', fontWeight: 700 }}>
                        <td colSpan={8} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-sub)' }}>
                          TOTAL
                        </td>
                        <td className="right" style={{ padding: '10px 12px', fontWeight: 700 }}>
                          {fmt.arsK(data.costo_total_recursos)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* ── Historial ─────────────────────────────────────────────────── */}
            <div className="pa-card">
              <div className="pa-card__header">
                <span className="pa-card__title">Historial</span>
              </div>

              {data.history.length === 0 ? (
                <div className="pa-empty">Sin historial disponible.</div>
              ) : (
                <>
                  {/* Gráfico de línea — resultado % por mes */}
                  {chartData.length > 1 && (
                    <div style={{ padding: '16px 16px 0' }}>
                      <div className="pa-section-title">Resultado % por mes</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF0" />
                          <XAxis
                            dataKey="period_date"
                            tickFormatter={d => fmt.period(d)}
                            tick={{ fontSize: 11, fill: '#718096' }}
                          />
                          <YAxis
                            tickFormatter={v => `${(Number(v)*100).toFixed(0)}%`}
                            tick={{ fontSize: 11, fill: '#718096' }}
                          />
                          <Tooltip
                            formatter={(v: number) => [`${(v*100).toFixed(1)}%`, 'Resultado']}
                            labelFormatter={(l: string) => fmt.period(l)}
                          />
                          <ReferenceLine y={0.16} stroke="#9AE6B4" strokeDasharray="4 2" label={{ value: '16%', fontSize: 10, fill: '#38A169' }} />
                          <Line
                            type="monotone"
                            dataKey="result_percentage"
                            stroke="#0A1F44"
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#0A1F44' }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Tabla historial */}
                  <div className="pa-table-wrap" style={{ marginTop: 8 }}>
                    <table className="pa-table pa-history-table">
                      <thead>
                        <tr>
                          <th>Período</th>
                          <th className="right">Facturación</th>
                          <th className="right">Margen Comercial</th>
                          <th className="right">Resultado %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.history.filter(h => !h.is_cumulative).map((h, i) => (
                          <tr key={i}>
                            <td>{fmt.period(h.period_date)}</td>
                            <td className="right">{fmt.ars(h.billing)}</td>
                            <td className="right">{fmt.ars(h.commercial_margin)}</td>
                            <td className="right" style={{ fontWeight: 600 }}>{fmt.pct(h.result_percentage)}</td>
                          </tr>
                        ))}
                        {cumul && (
                          <tr className="cumul">
                            <td className="cumul" style={{ fontWeight: 700, color: 'var(--navy)' }}>
                              ACUMULADO
                            </td>
                            <td className="right cumul">{fmt.ars(cumul.billing)}</td>
                            <td className="right cumul">{fmt.ars(cumul.commercial_margin)}</td>
                            <td className="right cumul" style={{ fontWeight: 700 }}>{fmt.pct(cumul.result_percentage)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
