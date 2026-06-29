import type { AuditResponse } from '../types/audit'

interface Props {
  result: AuditResponse
  onReset: () => void
}

export const ResultsPanel = ({ result, onReset }: Props) => {
  const { brechas_resumen, blob_url_pdf, nombre_app, fecha } = result

  return (
    <section aria-label="Resultado de la auditoría">
      {/* Región live — anuncia la llegada de resultados */}
      <div aria-live="polite" aria-atomic="true">
        <h2 className="card-title">
          ✅ Auditoría completada — {nombre_app} ({fecha})
        </h2>

        <div className="result-summary" role="list" aria-label="Resumen de brechas por severidad">
          <span className="badge-severity badge-alta"  role="listitem">{brechas_resumen.alta} Altas</span>
          <span className="badge-severity badge-media" role="listitem">{brechas_resumen.media} Medias</span>
          <span className="badge-severity badge-baja"  role="listitem">{brechas_resumen.baja} Bajas</span>
        </div>

        <div className="download-row">
          <a
            href={blob_url_pdf}
            download={`INFORME-${nombre_app}-${fecha}.pdf`}
            className="btn-primary"
            aria-label="Descargar informe PDF"
          >
            ⬇ Descargar PDF
          </a>
        </div>
      </div>

      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      {/* Preview del informe MD — solo texto plano para simplicidad */}
      <details>
        <summary className="form-label" style={{ cursor: 'pointer' }}>
          👁 Ver informe completo
        </summary>
        <pre
          style={{
            marginTop: '12px',
            background: 'var(--gray1)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '16px',
            fontSize: '12px',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6',
          }}
          aria-label="Contenido del informe"
        >
          {result.informe_md}
        </pre>
      </details>

      <div style={{ marginTop: '20px' }}>
        <button type="button" className="btn-secondary" onClick={onReset}>
          ← Nueva auditoría
        </button>
      </div>
    </section>
  )
}
