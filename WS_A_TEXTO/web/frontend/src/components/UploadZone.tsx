/**
 * UploadZone — zona de drag & drop para subir archivos de audio.
 */
import { useRef, useState } from 'react'

const ACCEPT = '.wav,.ogg,.mp3,.m4a,.flac,.opus,.webm,.aac,.wma,.mp4'

interface Props {
  onFile: (file: File) => void
  disabled: boolean
}

export function UploadZone({ onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = ''
  }

  return (
    <div
      className={`sc-upload${dragging ? ' sc-upload--drag' : ''}${disabled ? ' sc-upload--disabled' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={disabled ? undefined : handleDrop}
      onClick={disabled ? undefined : () => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={disabled}
      />
      <div className="sc-upload__icon">
        {dragging ? '📂' : '🎙'}
      </div>
      <p className="sc-upload__title">
        {dragging ? 'Soltá el archivo aqui' : 'Arrastrar o hacer click para subir'}
      </p>
      <p className="sc-upload__hint">
        WAV · OGG · MP3 · M4A · FLAC · OPUS · WEBM · AAC
      </p>
    </div>
  )
}
