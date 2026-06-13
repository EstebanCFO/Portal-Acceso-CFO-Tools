/**
 * Dashboard.tsx
 * Vista principal: selector AÑO → ENCUESTA → Consultar
 * Muestra collectors, enviados/respondidos y pendientes de la encuesta elegida.
 */

import { useState, useEffect } from 'react'
import type { SurveyForYearItem, SurveyReportResponse, CollectorReport } from '../types'
import { apiSurveysForYear, apiSurveyReport } from '../api/client'
import { SURVEY_YEARS } from '../config'

// ── Subcomponente: tarjeta de un collector ───────────────────────────────────
function CollectorCard({ collector }: { collector: CollectorReport }) {
  const { sent, responded, pending, typeLabel, collectorName } = collector
  const tasa = sent > 0 ? Math.round(responded / sent * 100) : 0

  const badgeClass =
    typeLabel === 'Mensual'   ? 'sv-badge sv-badge-mensual'   :
    typeLabel === 'Quincenal' ? 'sv-badge sv-badge-quincenal' :
    typeLabel === 'Weblink'   ? 'sv-badge sv-badge-weblink'   :
                                'sv-badge sv-badge-email'

  return (
    <div className="sv-collector-card">
      {/* Cabecera: tipo badge + nombre collector */}
      <div className="sv-collector-header">
        <span className={badgeClass}>{typeLabel}</span>
        <span className="sv-collector-name">{collectorName}</span>
      </div>

      {/* Estadísticas */}
      <div className="sv-collector-stats">
        <div className="sv-stat">
          <div className="sv-stat-value">{sent}</div>
          <div className="sv-stat-label">Enviados</div>
        </div>
        <div className="sv-stat">
          <div className={`sv-stat-value${responded === sent && sent > 0 ? ' green' : ''}`}>
            {responded}
          </div>
          <div className="sv-stat-label">Respondidos</div>
        </div>
        <div className="sv-stat">
          <div className={`sv-stat-value${pending.length > 0 ? ' orange' : ''}`}>
            {pending.length}
          </div>
          <div className="sv-stat-label">Pendientes</div>
        </div>
        {sent > 0 && (
          <div className="sv-stat">
            <div className={`sv-stat-value${tasa >= 80 ? ' green' : tasa < 50 && sent > 0 ? ' orange' : ''}`}>
              {tasa}%
            </div>
            <div className="sv-stat-label">Tasa</div>
          </div>
        )}
      </div>

      {/* Lista de pendientes */}
      {pending.length > 0 && (
        <div className="sv-pending-section">
          <div className="sv-pending-header">
            Pendientes ({pending.length})
          </div>
          <div className="sv-pending-list">
            {pending.map((p, i) => (
              <div key={i} className="sv-pending-item">
                <div className="sv-pending-dot" />
                <span className="sv-pending-email">{p.email}</span>
                <span className="sv-pending-status">{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Dashboard() {
  // Años disponibles — leídos de config.ts (estático, sin llamada al backend)
  const years = SURVEY_YEARS
  const [yearSel, setYearSel] = useState<number | ''>('')

  // Encuestas del año seleccionado
  const [surveys,       setSurveys]       = useState<SurveyForYearItem[]>([])
  const [encuestaSel,   setEncuestaSel]   = useState('')
  const [loadingSurveys, setLoadingSurveys] = useState(false)

  // Reporte tras Consultar
  const [report,        setReport]        = useState<SurveyReportResponse | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [error,         setError]         = useState('')

  // ── Cambio de año → cargar encuestas ────────────────────
  useEffect(() => {
    if (!yearSel) {
      setSurveys([]); setEncuestaSel(''); setReport(null); setError('')
      return
    }
    setLoadingSurveys(true)
    setEncuestaSel('')
    setReport(null)
    setError('')
    apiSurveysForYear(yearSel as number)
      .then(data => setSurveys(data.surveys))
      .catch(err  => setError((err as Error).message))
      .finally(() => setLoadingSurveys(false))
  }, [yearSel])

  // ── Cambio de encuesta → limpiar reporte anterior ───────
  useEffect(() => {
    setReport(null); setError('')
  }, [encuestaSel])

  // ── Consultar ────────────────────────────────────────────
  const handleConsultar = async () => {
    if (!encuestaSel) return
    setLoadingReport(true)
    setReport(null)
    setError('')
    try {
      const data = await apiSurveyReport(encuestaSel)
      setReport(data)
    } catch (err) {
      setError((err as Error).message ?? 'Error al consultar')
    } finally {
      setLoadingReport(false)
    }
  }

  const tasa = report && report.totalSent > 0
    ? Math.round(report.totalResponded / report.totalSent * 100)
    : 0

  return (
    <div className="sv-page">

      {/* ── Encabezado ─────────────────────────────────────── */}
      <div className="sv-page-header">
        <h1 className="sv-page-title">Survey Analytics</h1>
        <p className="sv-page-sub">
          Feedback de clientes y proyectos — cuenta SurveyMonkey
        </p>
      </div>

      {/* ── Toolbar: AÑO · ENCUESTA · Consultar ────────────── */}
      <div className="sv-toolbar">
        <label className="sv-toolbar-label">Año</label>
        <select
          className="sv-sel sv-sel-year"
          value={yearSel}
          onChange={e => setYearSel(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">— año —</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <label className="sv-toolbar-label">Encuesta</label>
        <select
          className="sv-sel sv-sel-survey"
          value={encuestaSel}
          onChange={e => setEncuestaSel(e.target.value)}
          disabled={!yearSel || loadingSurveys}
        >
          <option value="">
            {loadingSurveys
              ? 'Cargando...'
              : yearSel
              ? `— ${surveys.length} encuesta${surveys.length !== 1 ? 's' : ''} disponible${surveys.length !== 1 ? 's' : ''} —`
              : '— primero elegí el año —'}
          </option>
          {surveys.map(s => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>

        <button
          className="btn-primary sv-btn-consultar"
          onClick={handleConsultar}
          disabled={!encuestaSel || loadingReport}
        >
          {loadingReport
            ? <><span className="spinner spinner-sm" style={{ marginRight: 6 }} />Consultando...</>
            : 'Consultar'}
        </button>
      </div>

      {/* ── Welcome — sin año ───────────────────────────────── */}
      {!yearSel && (
        <div className="sv-welcome-card">
          <div className="sv-welcome-icon">📋</div>
          <div className="sv-welcome-title">Survey Analytics — Delivery Center</div>
          <p className="sv-welcome-sub">
            Seleccioná un <strong>año</strong> y una <strong>encuesta</strong>,
            luego presioná <strong>Consultar</strong>.
          </p>
        </div>
      )}

      {/* ── Hint — año seleccionado, sin encuesta o sin consultar ─ */}
      {yearSel && !loadingSurveys && !report && !loadingReport && !error && (
        <div className="sv-empty">
          <span className="sv-empty-icon">{encuestaSel ? '🔍' : '📊'}</span>
          <p>{encuestaSel
            ? 'Presioná Consultar para ver el reporte'
            : surveys.length === 0
            ? 'Sin encuestas disponibles para este año'
            : 'Seleccioná una encuesta'}
          </p>
        </div>
      )}

      {/* ── Cargando encuestas ──────────────────────────────── */}
      {loadingSurveys && (
        <div className="sv-empty">
          <div className="spinner spinner-md" style={{ margin: '0 auto 12px' }} />
          <p>Cargando encuestas de {yearSel}...</p>
        </div>
      )}

      {/* ── Cargando reporte ────────────────────────────────── */}
      {loadingReport && (
        <div className="sv-empty">
          <div className="spinner spinner-md" style={{ margin: '0 auto 12px' }} />
          <p>Consultando SurveyMonkey...</p>
          <p className="sv-empty-sub">Obteniendo collectors, enviados y pendientes</p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────── */}
      {error && !loadingReport && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <strong>Error al consultar</strong>
          <p style={{ marginTop: 4, fontSize: 13 }}>{error}</p>
        </div>
      )}

      {/* ── Reporte ─────────────────────────────────────────── */}
      {report && !loadingReport && (
        <>
          {/* Título + fecha de la encuesta */}
          <div className="sv-report-survey-header">
            <div className="sv-report-survey-title">{report.title}</div>
            <div className="sv-report-survey-meta">
              Última modificación: {report.dateModified}
            </div>
          </div>

          {/* KPIs globales */}
          <div className="sv-report-kpis">
            <div className="sv-report-kpi">
              <div className="sv-report-kpi-value">{report.totalSent}</div>
              <div className="sv-report-kpi-label">Enviados</div>
            </div>
            <div className="sv-report-kpi">
              <div className={`sv-report-kpi-value${
                report.totalResponded === report.totalSent && report.totalSent > 0
                  ? ' green' : ''
              }`}>{report.totalResponded}</div>
              <div className="sv-report-kpi-label">Respondidos</div>
            </div>
            <div className="sv-report-kpi">
              <div className={`sv-report-kpi-value${
                report.totalPending > 0 ? ' orange' : ''
              }`}>{report.totalPending}</div>
              <div className="sv-report-kpi-label">Pendientes</div>
            </div>
            <div className="sv-report-kpi">
              <div className={`sv-report-kpi-value${
                tasa >= 80 ? ' green' : report.totalSent > 0 && tasa < 50 ? ' orange' : ''
              }`}>
                {report.totalSent > 0 ? `${tasa}%` : '—'}
              </div>
              <div className="sv-report-kpi-label">Tasa de respuesta</div>
            </div>
          </div>

          {/* Tarjetas de collectors */}
          {report.collectors.length === 0 ? (
            <div className="sv-empty">
              <span className="sv-empty-icon">📭</span>
              <p>Sin collectors para esta encuesta.</p>
            </div>
          ) : (
            report.collectors.map(c => (
              <CollectorCard key={c.collectorId} collector={c} />
            ))
          )}
        </>
      )}

    </div>
  )
}
