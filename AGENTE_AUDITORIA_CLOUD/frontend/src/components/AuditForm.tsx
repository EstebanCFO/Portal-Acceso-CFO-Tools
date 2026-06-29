import { useState, useId, useRef, useEffect } from 'react'
import type { AuditRequest, ResourceType, Normativa } from '../types/audit'

interface Props {
  onSubmit: (req: AuditRequest) => void
  disabled: boolean
}

const NORMATIVAS: { id: Normativa; label: string }[] = [
  { id: 'wcag22', label: 'WCAG 2.2' },
  { id: 'onti',   label: 'ONTI / Ley 26.653' },
  { id: 'bcra',   label: 'BCRA A7517' },
]

const TIPOS: { id: ResourceType; label: string }[] = [
  { id: 'repo',  label: '📁 Repositorio' },
  { id: 'url',   label: '🌐 URL' },
  { id: 'local', label: '📂 App Local' },
]

// Título del campo principal según el artefacto elegido
const FIELD_TITLE: Record<ResourceType, string> = {
  repo:  'URL Repositorio',
  url:   'URL',
  local: 'App Local',
}

export const AuditForm = ({ onSubmit, disabled }: Props) => {
  const [type, setType]             = useState<ResourceType>('repo')
  const [repoUrl, setRepoUrl]       = useState('')
  const [url, setUrl]               = useState('')
  const [files, setFiles]           = useState<File[]>([])
  const [localName, setLocalName]   = useState('')
  const [normativas, setNormativas] = useState<Normativa[]>(['wcag22', 'onti', 'bcra'])
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const errorRef = useRef<HTMLDivElement>(null)

  const repoUrlId   = useId()
  const urlId       = useId()
  const filesId     = useId()
  const localNameId = useId()
  const errorSummId       = useId()
  const normativasErrorId = useId()

  useEffect(() => {
    if (Object.keys(errors).length > 0) errorRef.current?.focus()
  }, [errors])

  const toggleNormativa = (n: Normativa) =>
    setNormativas(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (type === 'repo') {
      if (!repoUrl.trim()) errs.repoUrl = 'La URL del repositorio es requerida'
    }
    if (type === 'url') {
      if (!url.trim() || !url.startsWith('http'))
        errs.url = 'Ingresá una URL válida (https://...)'
    }
    if (type === 'local') {
      if (files.length === 0) errs.files     = 'Seleccioná al menos un archivo HTML o CSS'
      if (!localName.trim())  errs.localName = 'El nombre del recurso es requerido'
    }
    if (normativas.length === 0) errs.normativas = 'Seleccioná al menos una normativa'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const req: AuditRequest = {
      type,
      normativas,
      ...(type === 'repo'  && { repo:  { url: repoUrl.trim() } }),
      ...(type === 'url'   && { url:   { url: url.trim() } }),
      ...(type === 'local' && { local: { files, name: localName } }),
    }
    onSubmit(req)
  }

  const errorCount = Object.keys(errors).length

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Formulario de auditoría de accesibilidad">
      {errorCount > 0 && (
        <div
          ref={errorRef}
          id={errorSummId}
          className="banner banner--error"
          role="alert"
          tabIndex={-1}
          aria-live="assertive"
        >
          <strong>Corregí {errorCount} error{errorCount > 1 ? 'es' : ''}:</strong>{' '}
          {Object.values(errors).join(' · ')}
        </div>
      )}

      {/* ── Selección de artefacto ── */}
      <div className="form-group">
        <span className="form-label" id="type-group-label">Seleccione artefacto para Auditar</span>
        <div className="type-tabs" role="group" aria-labelledby="type-group-label">
          {TIPOS.map(t => (
            <button
              key={t.id}
              type="button"
              className="type-tab"
              aria-pressed={type === t.id}
              onClick={() => { setType(t.id); setErrors({}) }}
              disabled={disabled}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Campo principal según artefacto ── */}
      {type === 'repo' && (
        <div className="form-group">
          <label htmlFor={repoUrlId} className="form-label">
            {FIELD_TITLE.repo} <span aria-hidden="true">*</span>
          </label>
          <input
            id={repoUrlId}
            type="url"
            className="form-input"
            placeholder="https://dev.azure.com/organización/proyecto/_git/repositorio"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            aria-required="true"
            aria-invalid={!!errors.repoUrl}
            aria-describedby={errors.repoUrl ? `${repoUrlId}-error` : undefined}
            disabled={disabled}
          />
          {errors.repoUrl && <p id={`${repoUrlId}-error`} className="form-error" role="alert">{errors.repoUrl}</p>}
        </div>
      )}

      {type === 'url' && (
        <div className="form-group">
          <label htmlFor={urlId} className="form-label">
            {FIELD_TITLE.url} <span aria-hidden="true">*</span>
          </label>
          <input
            id={urlId}
            type="url"
            className="form-input"
            placeholder="https://www.bancogalicia.com.ar"
            value={url}
            onChange={e => setUrl(e.target.value)}
            aria-required="true"
            aria-invalid={!!errors.url}
            aria-describedby={errors.url ? `${urlId}-error` : undefined}
            disabled={disabled}
          />
          {errors.url && <p id={`${urlId}-error`} className="form-error" role="alert">{errors.url}</p>}
        </div>
      )}

      {type === 'local' && (
        <>
          <div className="form-group">
            <label htmlFor={localNameId} className="form-label">
              {FIELD_TITLE.local} — Nombre <span aria-hidden="true">*</span>
            </label>
            <input
              id={localNameId}
              type="text"
              className="form-input"
              placeholder="Mi App Web"
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              aria-required="true"
              aria-invalid={!!errors.localName}
              aria-describedby={errors.localName ? `${localNameId}-error` : undefined}
              disabled={disabled}
            />
            {errors.localName && <p id={`${localNameId}-error`} className="form-error" role="alert">{errors.localName}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={filesId} className="form-label">
              Archivos HTML / CSS <span aria-hidden="true">*</span>
            </label>
            <input
              id={filesId}
              type="file"
              className="form-input"
              multiple
              accept=".html,.htm,.css"
              onChange={e => setFiles(Array.from(e.target.files ?? []))}
              aria-required="true"
              aria-invalid={!!errors.files}
              aria-describedby={`${filesId}-hint${errors.files ? ` ${filesId}-error` : ''}`}
              disabled={disabled}
            />
            <p id={`${filesId}-hint`} className="form-hint">Podés seleccionar múltiples archivos (Ctrl+clic).</p>
            {errors.files && <p id={`${filesId}-error`} className="form-error" role="alert">{errors.files}</p>}
          </div>
        </>
      )}

      {/* ── Normativas ── */}
      <div className="form-group">
        <span className="form-label" id="normativas-label">
          Normativas a evaluar <span aria-hidden="true">*</span>
        </span>
        <div
          className="checkbox-group"
          role="group"
          aria-labelledby="normativas-label"
          aria-describedby={errors.normativas ? normativasErrorId : undefined}
        >
          {NORMATIVAS.map(n => (
            <label key={n.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={normativas.includes(n.id)}
                onChange={() => toggleNormativa(n.id)}
                disabled={disabled}
              />
              {n.label}
            </label>
          ))}
        </div>
        {errors.normativas && <p id={normativasErrorId} className="form-error" role="alert">{errors.normativas}</p>}
      </div>

      <button type="submit" className="btn-primary" disabled={disabled}>
        {disabled ? '⏳ Auditando...' : '▶ Iniciar auditoría'}
      </button>
    </form>
  )
}
