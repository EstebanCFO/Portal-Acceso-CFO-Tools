/**
 * SurveyCard.tsx — Tarjeta de survey en el Dashboard.
 */

import type { SurveyItem } from '../types'

interface Props {
  survey:   SurveyItem
  onClick:  (id: string) => void
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    })
  } catch {
    return iso
  }
}

export default function SurveyCard({ survey, onClick }: Props) {
  const modified = formatDate(survey.dateModified ?? survey.dateCreated)

  return (
    <div
      className="survey-card"
      onClick={() => onClick(survey.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(survey.id) }}
    >
      {/* Ícono */}
      <div className="survey-card-icon">📝</div>

      {/* Contenido */}
      <div className="survey-card-body">
        <p className="survey-card-title">{survey.title}</p>
        <p className="survey-card-meta">
          Modificado: {modified}
        </p>
      </div>

      {/* Badge de respuestas */}
      <div className="survey-card-count">
        <span className="survey-count-num">{survey.responseCount}</span>
        <span className="survey-count-label">resp.</span>
      </div>

      {/* Flecha */}
      <span className="survey-card-arrow">→</span>
    </div>
  )
}
