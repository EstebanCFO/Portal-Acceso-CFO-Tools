import { useState, useId, useRef } from 'react'
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

export const AuditForm = ({ onSubmit, disabled }: Props) => {
  const [type, setType]             = useState<ResourceType>('repo')
  const [org, setOrg]               = useState('')
  const [project, setProject]       = useState('')
  const [repoName, setRepoName]     = useState('')
  const [branch, setBranch]         = useState('main')
  const [pat, setPat]               = useState('')
  const [url, setUrl]               = useState('')
  const [depth, setDepth]           = useState<1 | 2>(1)
  const [files, setFiles]           = useState<File[]>([])
  const [localName, setLocalName]   = useState('')
  const [normativas, setNormativas] = useState<Normativa[]>(['wcag22', 'onti', 'bcra'])
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const errorRef = useRef<HTMLDivElement>(null)

  // IDs únicos para accesibilidad
  const orgId       = useId()
  const projectId   = useId()
  const repoId      = useId()
  const branchId    = useId()
  const patId       = useId()
  const urlId       = useId()
  const depthId     = useId()
  const filesId     = useId()
  const localNameId = useId()
  const errorSummId = useId()

  const toggleNormativa = (n: Normativa) =>
    setNormativas(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (type === 'repo') {
      if (!org.trim())      errs.org     = 'La organización es requerida'
      if (!project.trim())  errs.project = 'El proyecto es requerido'
      if (!repoName.trim()) errs.repo    = 'El repositorio es requerido'
      if (!pat.trim())      errs.pat     = 'El Personal Access Token es requerido'
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
    if (Object.keys(errs).length > 0) {
      // Mover foco al resumen de errores (WCAG 3.3.1)
      setTimeout(() => errorRef.current?.focus(), 50)
    }
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const req: AuditRequest = {
      type,
      normativas,
      ...(type === 'repo'  && { repo:  { platform: 'azure-devops', org, project, repo: repoName, branch, pat } }),
      ...(type === 'url'   && { url:   { url, depth } }),
      ...(type === 'local' && { local: { files, name: localName } }),
    }
    onSubmit(req)
  }

  const errorCount = Object.keys(errors).length

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Formulario de auditoría de accesibilidad">
      {/* Resumen de errores (WCAG 3.3.1) */}
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

      {/* ── Tipo de recurso ── */}
      <div className="form-group">
        <span className="form-label" id="type-group-label">Tipo de recurso</span>
        <div className="type-tabs" role="group" aria-labelledby="type-group-label">
          {(['repo', 'url', 'local'] as ResourceType[]).map(t => (
            <button
              key={t}
              type="button"
              className="type-tab"
              aria-pressed={type === t}
              onClick={() => { setType(t); setErrors({}) }}
            >
              {t === 'repo'  && '📁 Repositorio'}
              {t === 'url'   && '🌐 URL'}
              {t === 'local' && '📂 App local'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Campos según tipo ── */}
      {type === 'repo' && (
        <>
          <div className="form-group">
            <label htmlFor={orgId} className="form-label">
              Organización <span aria-hidden="true">*</span>
            </label>
            <input
              id={orgId}
              type="text"
              className="form-input"
              value={org}
              onChange={e => setOrg(e.target.value)}
              aria-required="true"
              aria-invalid={errors.org ? true : undefined}
              aria-describedby={errors.org ? `${orgId}-error` : undefined}
              disabled={disabled}
              autoComplete="organization"
            />
            {errors.org && <p id={`${orgId}-error`} className="form-error">{errors.org}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={projectId} className="form-label">
              Proyecto <span aria-hidden="true">*</span>
            </label>
            <input
              id={projectId}
              type="text"
              className="form-input"
              value={project}
              onChange={e => setProject(e.target.value)}
              aria-required="true"
              aria-invalid={errors.project ? true : undefined}
              aria-describedby={errors.project ? `${projectId}-error` : undefined}
              disabled={disabled}
            />
            {errors.project && <p id={`${projectId}-error`} className="form-error">{errors.project}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={repoId} className="form-label">
              Repositorio <span aria-hidden="true">*</span>
            </label>
            <input
              id={repoId}
              type="text"
              className="form-input"
              value={repoName}
              onChange={e => setRepoName(e.target.value)}
              aria-required="true"
              aria-invalid={errors.repo ? true : undefined}
              aria-describedby={errors.repo ? `${repoId}-error` : undefined}
              disabled={disabled}
            />
            {errors.repo && <p id={`${repoId}-error`} className="form-error">{errors.repo}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={branchId} className="form-label">Rama</label>
            <input
              id={branchId}
              type="text"
              className="form-input"
              value={branch}
              onChange={e => setBranch(e.target.value)}
              disabled={disabled}
            />
            <p className="form-hint">Dejar "main" si no sabés cuál es la rama principal.</p>
          </div>

          <div className="form-group">
            <label htmlFor={patId} className="form-label">
              Token de acceso (PAT) <span aria-hidden="true">*</span>
            </label>
            <input
              id={patId}
              type="password"
              className="form-input"
              value={pat}
              onChange={e => setPat(e.target.value)}
              aria-required="true"
              aria-invalid={errors.pat ? true : undefined}
              aria-describedby={`${patId}-hint${errors.pat ? ` ${patId}-error` : ''}`}
              disabled={disabled}
              autoComplete="current-password"
            />
            <p id={`${patId}-hint`} className="form-hint">El token no se almacena — se usa únicamente durante la auditoría.</p>
            {errors.pat && <p id={`${patId}-error`} className="form-error">{errors.pat}</p>}
          </div>
        </>
      )}

      {type === 'url' && (
        <>
          <div className="form-group">
            <label htmlFor={urlId} className="form-label">
              URL del sitio <span aria-hidden="true">*</span>
            </label>
            <input
              id={urlId}
              type="url"
              className="form-input"
              placeholder="https://www.bancogalicia.com.ar"
              value={url}
              onChange={e => setUrl(e.target.value)}
              aria-required="true"
              aria-invalid={errors.url ? true : undefined}
              aria-describedby={errors.url ? `${urlId}-error` : undefined}
              disabled={disabled}
              autoComplete="url"
            />
            {errors.url && <p id={`${urlId}-error`} className="form-error">{errors.url}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={depthId} className="form-label">Profundidad de rastreo</label>
            <select
              id={depthId}
              className="form-select"
              value={depth}
              onChange={e => setDepth(Number(e.target.value) as 1 | 2)}
              disabled={disabled}
            >
              <option value={1}>Solo esta página (1 nivel)</option>
              <option value={2}>Páginas enlazadas (2 niveles)</option>
            </select>
          </div>
        </>
      )}

      {type === 'local' && (
        <>
          <div className="form-group">
            <label htmlFor={localNameId} className="form-label">
              Nombre del recurso <span aria-hidden="true">*</span>
            </label>
            <input
              id={localNameId}
              type="text"
              className="form-input"
              placeholder="Mi App Web"
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              aria-required="true"
              aria-invalid={errors.localName ? true : undefined}
              aria-describedby={errors.localName ? `${localNameId}-error` : undefined}
              disabled={disabled}
            />
            {errors.localName && <p id={`${localNameId}-error`} className="form-error">{errors.localName}</p>}
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
              aria-invalid={errors.files ? true : undefined}
              aria-describedby={`${filesId}-hint${errors.files ? ` ${filesId}-error` : ''}`}
              disabled={disabled}
            />
            <p id={`${filesId}-hint`} className="form-hint">Podés seleccionar múltiples archivos (Ctrl+clic).</p>
            {errors.files && <p id={`${filesId}-error`} className="form-error">{errors.files}</p>}
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
          aria-describedby={errors.normativas ? 'normativas-error' : undefined}
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
        {errors.normativas && <p id="normativas-error" className="form-error">{errors.normativas}</p>}
      </div>

      <button
        type="submit"
        className="btn-primary"
        disabled={disabled}
        aria-label="Iniciar auditoría"
      >
        {disabled ? '⏳ Auditando...' : '▶ Iniciar auditoría'}
      </button>
    </form>
  )
}
