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

const MESES: { label: string; num: string }[] = [
  { label: 'Enero',      num: '01' },
  { label: 'Febrero',    num: '02' },
  { label: 'Marzo',      num: '03' },
  { label: 'Abril',      num: '04' },
  { label: 'Mayo',       num: '05' },
  { label: 'Junio',      num: '06' },
  { label: 'Julio',      num: '07' },
  { label: 'Agosto',     num: '08' },
  { label: 'Septiembre', num: '09' },
  { label: 'Octubre',    num: '10' },
  { label: 'Noviembre',  num: '11' },
  { label: 'Diciembre',  num: '12' },
]

const ANIO_ACTUAL = new Date().getFullYear()
const ANIOS = [ANIO_ACTUAL - 1, ANIO_ACTUAL, ANIO_ACTUAL + 1]

export default function UploadModal({ open, onClose, onSuccess }: Props) {
  const [file,    setFile]    = useState<File | null>(null)
  const [mes,     setMes]     = useState<string>('')
  const [anio,    setAnio]    = useState<string>(String(ANIO_ACTUAL))
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
    if (!file || !mes) return
    setLoading(true)
    setResult(null)

    const mesObj  = MESES.find(m => m.label === mes)!
    const periodo = `${anio}-${mesObj.num}`   // e.g. "2026-06"

    try {
      const { data } = await uploadExcel(file, mes, periodo)
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
    setMes('')
    setAnio(String(ANIO_ACTUAL))
    setResult(null)
    onClose()
  }

  const alertClass = result?.status === 'ok'        ? 'alert alert-success'
                   : result?.status === 'ya_existia' ? 'alert alert-warning'
                   : result?.status === 'error'      ? 'alert alert-error'
                   : 'alert alert-info'

  const canImport = !!file && !!mes && !loading

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">Cargar nuevo Excel</div>

        <div className="modal-body">

          {/* ── Selector de mes / año ── */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label className="caption" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                Mes *
              </label>
              <select
                value={mes}
                onChange={e => { setMes(e.target.value); setResult(null) }}
                disabled={loading}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: '1.5px solid var(--gray3)',
                  background: 'var(--gray1)',
                  color: mes ? 'var(--navy)' : 'var(--gray5)',
                  fontSize: 13,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                <option value="">Seleccionar mes…</option>
                {MESES.map(m => (
                  <option key={m.num} value={m.label}>{m.label}</option>
                ))}
              </select>
            </div>

            <div style={{ width: 100 }}>
              <label className="caption" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
                Año *
              </label>
              <select
                value={anio}
                onChange={e => setAnio(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: '1.5px solid var(--gray3)',
                  background: 'var(--gray1)',
                  color: 'var(--navy)',
                  fontSize: 13,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {ANIOS.map(a => (
                  <option key={a} value={String(a)}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {mes && (
            <p className="caption" style={{ marginBottom: 10, color: 'var(--green-d)' }}>
              Se leerá la solapa <strong>"{mes}"</strong> del archivo · Período: <strong>{anio}-{MESES.find(m => m.label === mes)!.num}</strong>
            </p>
          )}

          {/* ── Drop zone ── */}
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

          {!mes && (
            <p className="caption" style={{ marginTop: 8, color: 'var(--orange)' }}>
              ⚠ Seleccioná el mes antes de importar.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={handleClose} disabled={loading}>Cancelar</button>
          <button
            className="btn-primary"
            onClick={handleUpload}
            disabled={!canImport}
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
