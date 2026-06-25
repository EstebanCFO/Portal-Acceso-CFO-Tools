import { useRef, useState } from 'react'

interface Props {
  accept?:    string
  multiple?:  boolean
  label:      string
  hint?:      string
  icon?:      string
  filename?:  string         // cuando ya hay archivo cargado
  loading?:   boolean        // mientras procesa el upload
  onFiles:    (files: FileList) => void
}

export default function UploadZone({
  accept = '.pdf,.docx,.txt',
  multiple = false,
  label,
  hint,
  icon = '📄',
  filename,
  loading = false,
  onFiles,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const cls = [
    'upload-zone',
    drag    ? 'drag'    : '',
    filename ? 'ready'  : '',
    loading  ? 'loading': '',
  ].filter(Boolean).join(' ')

  function handleClick() {
    if (loading) return
    inputRef.current?.click()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files?.length) onFiles(files)
    // Reset para permitir re-seleccionar el mismo archivo
    e.target.value = ''
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDrag(true)
  }
  function handleDragLeave() { setDrag(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    if (loading) return
    const files = e.dataTransfer.files
    if (files?.length) onFiles(files)
  }

  return (
    <div
      className={cls}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {loading ? (
        <>
          <div className="spinner-sm" />
          <span className="uz-hint">Procesando {filename ?? 'archivo'}...</span>
        </>
      ) : filename ? (
        <>
          <span className="uz-icon">✅</span>
          <span className="uz-file" title={filename}>{filename}</span>
          <span className="uz-hint">Clic para reemplazar</span>
        </>
      ) : (
        <>
          <span className="uz-icon">{icon}</span>
          <span className="uz-title">{label}</span>
          {hint && <span className="uz-hint">{hint}</span>}
          <span className="uz-hint" style={{ fontSize: 10, color: 'var(--text3)' }}>
            {accept.split(',').join(' · ')}
          </span>
        </>
      )}
    </div>
  )
}
