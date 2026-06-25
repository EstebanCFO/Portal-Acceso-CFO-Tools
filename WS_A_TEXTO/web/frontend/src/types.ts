export interface Segment {
  start: number
  end: number
  text: string
  confidence: number
  speaker: string | null
}

export interface Transcript {
  language: string
  language_probability: number
  duration: number
  word_count: number
  avg_confidence: number
  text: string
  segments: Segment[]
}

export interface TranscribeOptions {
  lang: string
  model: string
  fmt: string
  minConfidence: number
  diarize: boolean
}

export type ProgressStep = 'saving' | 'converting' | 'transcribing' | 'diarizing' | 'done' | 'error'

export interface ProgressEvent {
  type: 'progress' | 'segment' | 'done' | 'error'
  step?: ProgressStep
  message?: string
  index?: number
  start?: number
  end?: number
  text?: string
  confidence?: number
  transcript?: Transcript
}

export const STEP_LABELS: Record<ProgressStep, string> = {
  saving:       'Recibiendo archivo...',
  converting:   'Normalizando audio...',
  transcribing: 'Transcribiendo...',
  diarizing:    'Identificando hablantes...',
  done:         'Listo',
  error:        'Error',
}

export const MODELS = ['tiny', 'base', 'small', 'medium', 'large-v3'] as const
export const FORMATS = ['txt', 'srt', 'vtt', 'json'] as const
export const LANGUAGES = [
  { code: '',   label: 'Auto-detectar' },
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
] as const
