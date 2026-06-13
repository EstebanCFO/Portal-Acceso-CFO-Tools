import { useState, useRef } from 'react'
import { uploadExcel } from '../api/client'
import type { UploadResult } from '../types'

interface Props {
  open:      boolean
  onClose:   () => void
  onSuccess: () => void
}

interface LocalResult {
  status:  UploadResult['status'] | 'error'
  message: string
}

export default function UploadModal({ open, onClose, onSuccess }: Props) {
  const [file,    setFile]    = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<LocalResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  function handleFile(f: File | null | undefined) {
    if (!f) return
    if (!f.name.endsWith('.xlsx')) {
      setResult({ status: 'error', message: 'El archivo debe ser .xlsx' })
      return
    }
    setFile(f)
    setResult(null)
  }

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const { data } = await uploadExcel(file)
      setResult({ status: data.status, message: data.message })
      if (data.status === 'ok') onSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })
        .response?.data?.message ?? (err as { message?: string }).message ?? 'Error desconocido'
      setResult({ status: 'error', message: msg })
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
    setFile(null)
    setResult(null)
    onClose()
  }

  const alertClass = result?.status === 'ok'        ? 'alert alert-success'
                   : result?.status === 'ya_existia' ? 'alert alert-warning'
                   : result?.status === 'error'      ? 'alert alert-error'
                   : 'alert alert-info'

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">Cargar nuevo Excel</div>

        <div className="modal-body">
          {/* Drop zone */}
          <div
            className={`upload-zone${file ? ' has-file' : ''}${loading ? ' loading' : ''}`}
            onClick={() => !loading && inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])}
            />
            {file ? (
              <>
                {/* CheckCircle icon */}
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"
                  style={{ color: 'var(--green)', display: 'block', margin: '0 auto 8px' }}
                  aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <p className="upload-name">{file.name}</p>
                <p className="caption">{(file.size / 1024).toFixed(0)} KB · listo para importar</p>
              </>
            ) : (
              <>
                {/* CloudUpload icon */}
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"
                  style={{ color: 'var(--navy)', display: 'block', margin: '0 auto 8px' }}
                  aria-hidden="true">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                </svg>
                <p className="upload-name">Arrastra el archivo o hace click</p>
                <p className="caption">Solo archivos .xlsx</p>
              </>
            )}
          </div>

          {loading && (
            <div className="progress-bar" style={{ marginTop: 12 }}>
              <div className="progress-fill indeterminate" />
            </div>
          )}

          {result && (
            <div className={alertClass} style={{ marginTop: 12 }}>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.message}</p>
            </div>
          )}

          <p className="caption" style={{ marginTop: 8 }}>
            El periodo se extrae del nombre del archivo. Ej: "Bandas Salariales Julio 2026 - DC.xlsx"
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={handleClose} disabled={loading}>Cancelar</button>
          <button
            className="btn-primary"
            onClick={handleUpload}
            disabled={!file || loading}
          >
            {loading
              ? <><span className="spinner spinner-sm" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.25)' }} /> Importando...</>
              : 'Importar'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
