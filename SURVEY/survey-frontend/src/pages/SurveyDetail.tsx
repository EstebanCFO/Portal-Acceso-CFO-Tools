/**
 * SurveyDetail.tsx
 * Vista de analytics de un survey individual.
 * Muestra pregunta por pregunta con charts de distribución.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { apiAnalytics } from '../api/client'
import type { SurveyAnalyticsResponse, QuestionAnalytics } from '../types'

// ── Colores DS para barras ───────────────────────────────────────────────────
const BAR_COLORS = [
  '#0A1F44', '#1B3F8A', '#4472C4', '#4FD1B2',
  '#00875A', '#00A878', '#C96A00', '#C0392B',
]


// ── Sub-componente: una pregunta con su gráfico ───────────────────────────────
function QuestionBlock({ q, idx }: { q: QuestionAnalytics; idx: number }) {
  const isOpenEnded = q.family === 'open_ended' || q.family === 'presentation'
  const hasChoices  = q.choices && q.choices.length > 0

  return (
    <div className="sv-question-block">
      {/* Header pregunta */}
      <div className="sv-q-header">
        <span className="sv-q-num">{idx + 1}</span>
        <div className="sv-q-info">
          <p className="sv-q-heading">{q.heading}</p>
          <div className="sv-q-meta">
            <span className="badge badge-default">{q.family}</span>
            <span className="sv-q-stats">
              {q.answered} respondieron · {q.skipped} omitieron
            </span>
          </div>
        </div>
      </div>

      {/* Sin respuestas */}
      {q.answered === 0 && (
        <p className="sv-q-no-data">Sin respuestas para esta pregunta.</p>
      )}

      {/* Open-ended: mostrar info */}
      {q.answered > 0 && isOpenEnded && (
        <div className="sv-q-open">
          <span className="sv-q-open-icon">💬</span>
          <p>
            <strong>{q.answered}</strong> respuesta{q.answered !== 1 ? 's' : ''} abiertas.
            Las respuestas textuales se visualizan directamente en SurveyMonkey.
          </p>
        </div>
      )}

      {/* Choice-based: bar chart */}
      {q.answered > 0 && !isOpenEnded && hasChoices && (
        <div className="sv-q-chart">
          <ResponsiveContainer width="100%" height={Math.max(180, q.choices!.length * 44)}>
            <BarChart
              data={q.choices!.map(c => ({
                name: c.text.length > 30 ? c.text.slice(0, 28) + '…' : c.text,
                fullText: c.text,
                count: c.count,
                pct:   c.percentage,
              }))}
              layout="vertical"
              margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                tick={{ fontSize: 11 }}
              />
              <RTooltip
                formatter={(value, _name, props) => [
                  `${value} (${(props.payload as { pct: number }).pct}%)`,
                  (props.payload as { fullText: string }).fullText,
                ]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {q.choices!.map((_, i) => (
                  <Cell
                    key={i}
                    fill={BAR_COLORS[i % BAR_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Tabla compacta debajo del chart */}
          <div className="sv-choice-table">
            {q.choices!.map(c => (
              <div key={c.id} className="sv-choice-row">
                <span className="sv-choice-text">{c.text}</span>
                <span className="sv-choice-pct">{c.percentage}%</span>
                <span className="sv-choice-count">({c.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function SurveyDetail() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()

  const [data,    setData]    = useState<SurveyAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let mounted = true
    setLoading(true)
    setError(null)

    apiAnalytics(id)
      .then(d  => { if (mounted) setData(d) })
      .catch((e: Error) => { if (mounted) setError(e.message) })
      .finally(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [id])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="sv-page">
        <button className="sv-back-btn" onClick={() => navigate('/')}>
          ← Volver
        </button>
        <div className="skeleton" style={{ height: 32, width: 320, marginBottom: 24 }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton sv-question-skeleton" />
        ))}
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="sv-page">
        <button className="sv-back-btn" onClick={() => navigate('/')}>
          ← Volver
        </button>
        <div className="alert alert-error">
          <strong>Error al cargar el survey</strong>
          <p style={{ marginTop: 4, fontSize: 13 }}>{error ?? 'Error desconocido'}</p>
        </div>
      </div>
    )
  }

  // ── Métricas resumen ────────────────────────────────────────────────────────
  const withResponses = data.questions.filter(q => q.answered > 0)
  const avgCompletionPct = data.questions.length > 0
    ? Math.round(withResponses.length / data.questions.length * 100)
    : 0

  return (
    <div className="sv-page">
      {/* Botón volver */}
      <button className="sv-back-btn" onClick={() => navigate('/')}>
        ← Volver al listado
      </button>

      {/* Título del survey */}
      <div className="sv-page-header">
        <h1 className="sv-page-title">{data.surveyTitle}</h1>
        <p className="sv-page-sub">ID: {data.surveyId}</p>
      </div>

      {/* KPIs del survey */}
      <div className="sv-kpi-grid">
        <div className="sv-kpi">
          <span className="sv-kpi-value">{data.totalResponses.toLocaleString('es-AR')}</span>
          <span className="sv-kpi-label">Respuestas totales</span>
        </div>
        <div className="sv-kpi">
          <span className="sv-kpi-value">{data.questions.length}</span>
          <span className="sv-kpi-label">Preguntas</span>
        </div>
        <div className="sv-kpi">
          <span className="sv-kpi-value">{avgCompletionPct}%</span>
          <span className="sv-kpi-label">Preguntas respondidas</span>
        </div>
      </div>

      {/* Sin respuestas */}
      {data.totalResponses === 0 && (
        <div className="alert alert-info" style={{ marginBottom: 24 }}>
          Este survey aún no tiene respuestas.
        </div>
      )}

      {/* Preguntas */}
      <h2 className="sv-section-title">Análisis por pregunta</h2>
      <div className="sv-questions-list">
        {data.questions.map((q, i) => (
          <QuestionBlock key={q.questionId} q={q} idx={i} />
        ))}
      </div>
    </div>
  )
}
