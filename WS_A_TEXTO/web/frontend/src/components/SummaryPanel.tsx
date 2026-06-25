/**
 * SummaryPanel — muestra el resumen ejecutivo generado por IA.
 * Recibe texto en streaming y lo renderiza con markdown básico:
 * ## Header → <h3>, - item → <li>, párrafos normales → <p>.
 */
import type { FC } from 'react'

interface Props {
  text:    string   // texto acumulado (puede estar incompleto durante streaming)
  loading: boolean
  error?:  string
}

export const SummaryPanel: FC<Props> = ({ text, loading, error }) => {
  if (error) {
    return (
      <div className="sc-summary sc-summary--error">
        <span>⚠️</span>
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="sc-summary">
      <div className="sc-summary__header">
        <span className="sc-summary__title">📋 Resumen Ejecutivo</span>
        {loading && <span className="sc-summary__badge">Generando con IA…</span>}
      </div>

      <div className="sc-summary__body">
        {renderMarkdown(text)}
        {loading && <span className="sc-summary__cursor" aria-hidden />}
      </div>
    </div>
  )
}

// ── Renderer de markdown mínimo ───────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let listItems: string[] = []
  let key = 0

  const flushList = () => {
    if (!listItems.length) return
    nodes.push(
      <ul className="sc-summary__list" key={key++}>
        {listItems.map((item, i) => <li key={i}>{item}</li>)}
      </ul>,
    )
    listItems = []
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushList()
      nodes.push(
        <h3 className="sc-summary__section" key={key++}>
          {line.slice(3)}
        </h3>,
      )
    } else if (line.startsWith('- ')) {
      listItems.push(line.slice(2))
    } else if (line.trim()) {
      flushList()
      nodes.push(<p className="sc-summary__para" key={key++}>{line}</p>)
    }
  }
  flushList()

  return nodes
}
