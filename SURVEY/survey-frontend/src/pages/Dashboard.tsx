/**
 * Dashboard.tsx
 * Página principal: lista todos los surveys de la cuenta SurveyMonkey
 * con su count de respuestas y fecha de modificación.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiSurveys } from '../api/client'
import SurveyCard from '../components/SurveyCard'
import type { SurveyItem } from '../types'

export default function Dashboard() {
  const [surveys,  setSurveys]  = useState<SurveyItem[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [query,    setQuery]    = useState('')

  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    apiSurveys()
      .then(data => {
        if (!mounted) return
        setSurveys(data.surveys)
        setTotal(data.total)
      })
      .catch((err: Error) => {
        if (!mounted) return
        setError(err.message)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => { mounted = false }
  }, [])

  const filtered = query.trim()
    ? surveys.filter(s =>
        s.title.toLowerCase().includes(query.toLowerCase())
      )
    : surveys

  const totalResponses = surveys.reduce((sum, s) => sum + s.responseCount, 0)

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="sv-page">
        <div className="sv-page-header">
          <h1 className="sv-page-title">Survey Analytics</h1>
        </div>
        <div className="sv-kpi-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton sv-kpi-skeleton" />
          ))}
        </div>
        <div className="sv-list">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton sv-card-skeleton" />
          ))}
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="sv-page">
        <div className="sv-page-header">
          <h1 className="sv-page-title">Survey Analytics</h1>
        </div>
        <div className="alert alert-error">
          <strong>Error al conectar con SurveyMonkey</strong>
          <p style={{ marginTop: 4, fontSize: 13 }}>{error}</p>
          {error.toLowerCase().includes('token') && (
            <p style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>
              Verificar que el token en <code>appsettings.json</code> sea válido.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Empty ────────────────────────────────────────────────────────────────────
  if (surveys.length === 0) {
    return (
      <div className="sv-page">
        <div className="sv-page-header">
          <h1 className="sv-page-title">Survey Analytics</h1>
        </div>
        <div className="sv-empty">
          <span className="sv-empty-icon">📭</span>
          <p>No se encontraron surveys en la cuenta de SurveyMonkey.</p>
        </div>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className="sv-page">
      {/* Header de página */}
      <div className="sv-page-header">
        <h1 className="sv-page-title">Survey Analytics</h1>
        <p className="sv-page-sub">
          Feedback de clientes y proyectos — cuenta SurveyMonkey
        </p>
      </div>

      {/* KPIs */}
      <div className="sv-kpi-grid">
        <div className="sv-kpi">
          <span className="sv-kpi-value">{total}</span>
          <span className="sv-kpi-label">Surveys totales</span>
        </div>
        <div className="sv-kpi">
          <span className="sv-kpi-value">{totalResponses.toLocaleString('es-AR')}</span>
          <span className="sv-kpi-label">Respuestas totales</span>
        </div>
        <div className="sv-kpi">
          <span className="sv-kpi-value">
            {surveys.length > 0
              ? (totalResponses / surveys.length).toFixed(0)
              : '—'}
          </span>
          <span className="sv-kpi-label">Promedio por survey</span>
        </div>
      </div>

      {/* Buscador */}
      <div className="sv-search-row">
        <input
          className="sv-search"
          type="text"
          placeholder="Buscar survey..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <span className="sv-search-count">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Lista de surveys */}
      <div className="sv-list">
        {filtered.length === 0 ? (
          <p className="sv-no-results">Sin resultados para "{query}"</p>
        ) : (
          filtered.map(s => (
            <SurveyCard
              key={s.id}
              survey={s}
              onClick={id => navigate(`/survey/${id}`)}
            />
          ))
        )}
      </div>
    </div>
  )
}
