import { useEffect, useState } from 'react'
import { getHistory } from '../api/client'
import type { HistoryEntry } from '../types/audit'

export const HistoryPanel = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getHistory()
      .then(setHistory)
      .catch(() => setError('No se pudo cargar el historial.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="form-hint" aria-busy="true">Cargando historial...</p>
  if (error)   return <p className="form-error" role="alert">{error}</p>
  if (history.length === 0) return <p className="form-hint">Todavía no hay auditorías guardadas.</p>

  return (
    <section aria-label="Historial de auditorías">
      <h2 className="card-title">Historial</h2>
      <div role="list">
        {history.map((entry, i) => (
          <div key={i} className="history-row" role="listitem">
            <span className="history-app">{entry.nombre_app}</span>
            <span className="history-date">{entry.fecha}</span>
            <span className="badge-severity badge-alta">{entry.brechas.alta}A</span>
            <span className="badge-severity badge-media">{entry.brechas.media}M</span>
            <span className="badge-severity badge-baja">{entry.brechas.baja}B</span>
            <div className="history-links">
              {entry.url_md && (
                <a href={entry.url_md} className="btn-secondary" aria-label={`Descargar MD de ${entry.nombre_app} ${entry.fecha}`}>
                  MD
                </a>
              )}
              {entry.url_json && (
                <a href={entry.url_json} className="btn-secondary" aria-label={`Descargar JSON de ${entry.nombre_app} ${entry.fecha}`}>
                  JSON
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
