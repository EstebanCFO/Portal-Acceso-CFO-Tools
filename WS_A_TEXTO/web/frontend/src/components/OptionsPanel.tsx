/**
 * OptionsPanel — controles de modelo, idioma, formato y confianza.
 */
import type { TranscribeOptions } from '../types'
import { MODELS, FORMATS, LANGUAGES } from '../types'

interface Props {
  opts: TranscribeOptions
  onChange: (patch: Partial<TranscribeOptions>) => void
  diarizationAvailable: boolean
  disabled: boolean
}

export function OptionsPanel({ opts, onChange, diarizationAvailable, disabled }: Props) {
  return (
    <div className="sc-options">
      <div className="sc-options__group">
        <label className="sc-label">Idioma</label>
        <select
          className="sc-select"
          value={opts.lang}
          onChange={e => onChange({ lang: e.target.value })}
          disabled={disabled}
        >
          {LANGUAGES.map(l => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className="sc-options__group">
        <label className="sc-label">Modelo</label>
        <select
          className="sc-select"
          value={opts.model}
          onChange={e => onChange({ model: e.target.value })}
          disabled={disabled}
        >
          {MODELS.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="sc-options__group">
        <label className="sc-label">Formato salida</label>
        <select
          className="sc-select"
          value={opts.fmt}
          onChange={e => onChange({ fmt: e.target.value })}
          disabled={disabled}
        >
          {FORMATS.map(f => (
            <option key={f} value={f}>{f.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="sc-options__group">
        <label className="sc-label">
          Confianza min: <strong>{Math.round(opts.minConfidence * 100)}%</strong>
        </label>
        <input
          type="range"
          className="sc-range"
          min={0} max={1} step={0.05}
          value={opts.minConfidence}
          onChange={e => onChange({ minConfidence: parseFloat(e.target.value) })}
          disabled={disabled}
        />
      </div>

      {diarizationAvailable && (
        <div className="sc-options__group sc-options__group--check">
          <label className="sc-check-label">
            <input
              type="checkbox"
              checked={opts.diarize}
              onChange={e => onChange({ diarize: e.target.checked })}
              disabled={disabled}
            />
            Identificar hablantes
          </label>
        </div>
      )}
    </div>
  )
}
