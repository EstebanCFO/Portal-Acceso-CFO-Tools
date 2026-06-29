import { useEffect, useState } from 'react'
import { getHistory, deleteReport } from '../api/client'
import type { HistoryEntry } from '../types/audit'

export const HistoryPanel = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    getHistory()
      .then(setHistory)
      .catch(() => setError('No se pudo cargar el historial.'))
      .finally(() => setLoading(false))
  }, [])

  const keyOf = (e: HistoryEntry) => `${e.nombre_app}|${e.fecha}|${e.version}`

  const handleDelete = async (entry: HistoryEntry) => {
    const k = keyOf(entry)
    setDeleting(k)
    try {
      await deleteReport({ nombre_app: entry.nombre_app, fecha: entry.fecha, version: entry.version })
      setHistory(prev => prev.filter(e => keyOf(e) !== k))
    } catch {
      setError('No se pudo eliminar el informe.')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <p className="form-hint" aria-busy="true">Cargando historial...</p>
  if (error)   return <p className="form-error" role="alert">{error}</p>
  if (history.length === 0) return <p className="form-hint">Todavía no hay auditorías guardadas.</p>

  return (
    <section aria-label="Historial de auditorías">
      <h2 className="card-title">Historial</h2>
      <div role="list">
        {history.map(entry => {
          const k = keyOf(entry)
          const etiqueta = `${entry.nombre_app} ${entry.fecha}${entry.version ? ` ${entry.version}` : ''}`
          return (
            <div key={k} className="history-row" role="listitem">
              <span className="history-app">{entry.nombre_app}</span>
              <span className="history-date">{entry.fecha}</span>
              <span className="badge-severity badge-alta">{entry.brechas.alta}A</span>
              <span className="badge-severity badge-media">{entry.brechas.media}M</span>
              <span className="badge-severity badge-baja">{entry.brechas.baja}B</span>
              <div className="history-links">
                {entry.url_pdf && (
                  <a
                    href={entry.url_pdf}
                    className="btn-secondary"
                    aria-label={`Descargar PDF de ${etiqueta}`}
                  >
                    ⬇ PDF
                  </a>
                )}
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => handleDelete(entry)}
                  disabled={deleting === k}
                  aria-label={`Eliminar informe de ${etiqueta}`}
                  title="Eliminar informe"
                >
                  🗑
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
