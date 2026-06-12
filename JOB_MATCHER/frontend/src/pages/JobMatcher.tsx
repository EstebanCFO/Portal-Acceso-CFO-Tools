import { useRef, useState } from 'react'
import UploadZone from '../components/UploadZone'
import StepBar    from '../components/StepBar'
import {
  apiUpload, apiSummarize,
  apiAnalyzeCandidate, apiAskQuestion,
} from '../api/client'
import type { CandidateAnalysis } from '../types'

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface Doc {
  name:    string
  text:    string
  summary: string | null
}

interface CandidateItem {
  id:       string
  name:     string
  fileName: string
  text:     string
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }

interface AnalysisResult {
  candidateName: string
  analysis:      CandidateAnalysis
  chat:          ChatMsg[]
  chatLoading:   boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

function normalizeCandidateName(fileName: string) {
  let n = fileName.replace(/\.[^/.]+$/, '')
  n = n.replace(/^(CV|cv|Curriculum|curriculum|Resume|resume)[_\-\s]*/i, '')
  n = n.replace(/[_\-\s]*(CV|cv|LiderTecnico|FullStack|QA|Dev|Developer|Senior|Junior|SSr|Sr|Jr)[_\-\s]*/gi, ' ')
  n = n.replace(/[_\-]/g, ' ').replace(/\s+/g, ' ').trim()
  return n.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function parseAnalysis(raw: string): CandidateAnalysis {
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(clean) as CandidateAnalysis
}

function scoreColor(val: number) {
  if (val >= 70) return 'var(--green)'
  if (val >= 40) return 'var(--orange)'
  return 'var(--red)'
}

function recBadge(rec: string) {
  const r = rec.toLowerCase()
  if (r.includes('contratar')) return 'badge-green'
  if (r.includes('descartar')) return 'badge-red'
  return 'badge-orange'
}

function mdToHtml(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

const SCORE_LABELS: Record<string, string> = {
  fit_tecnico:                   'Técnico',
  fit_experiencia:               'Experiencia',
  fit_liderazgo:                 'Liderazgo',
  fit_cultural:                  'Cultural',
  fit_idiomas_comunicacion:      'Idiomas / Comunicación',
  fit_formacion_certificaciones: 'Formación / Certificaciones',
  fit_compensacion_expectativas: 'Compensación / Expectativas',
  red_flags_alertas:             'Red Flags / Alertas',
}

const MATCHER_STEPS = [
  { label: 'Job Description' },
  { label: 'Proyecto (opcional)' },
  { label: 'Candidatos' },
  { label: 'Analizando...' },
  { label: 'Resultados' },
]

// ── Subcomponente: resultado de un candidato ──────────────────────────────────

interface ResultCardProps {
  result:  AnalysisResult
  idx:     number
  onChat:  (idx: number, question: string) => void
}

function ResultCard({ result, idx, onChat }: ResultCardProps) {
  const { analysis } = result
  const [input, setInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const scores = analysis.scores_detallados
  const fort   = [...(analysis.fortalezas_criticas ?? []), ...(analysis.fortalezas_adicionales ?? [])]
  const brec   = [...(analysis.brechas_criticas    ?? []), ...(analysis.brechas_menores       ?? [])]
  const redf   = analysis.red_flags ?? []
  const pregs  = (analysis.puntos_validar_entrevista ?? []).slice(0, 10)

  function sendMsg() {
    const q = input.trim()
    if (!q || result.chatLoading) return
    setInput('')
    onChat(idx, q)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  return (
    <div className="card result-card">
      {/* Header */}
      <div className="result-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="cand-av" style={{ width: 38, height: 38, fontSize: 13 }}>
            {toInitials(result.candidateName)}
          </div>
          <div>
            <div className="result-name">{result.candidateName}</div>
            <span className={`badge ${recBadge(analysis.recomendacion)}`} style={{ marginTop: 3 }}>
              {analysis.recomendacion}
            </span>
          </div>
        </div>
        <div className="result-score-big">
          {analysis.compatibilidad_general}%
          <span>compatibilidad</span>
        </div>
      </div>

      <div className="card-body">
        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-box">
            <div className="kpi-n" style={{ color: scoreColor(analysis.compatibilidad_general) }}>
              {analysis.compatibilidad_general}
            </div>
            <div className="kpi-l">Compatibilidad</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-n" style={{ fontSize: 13 }}>{analysis.nivel_match}</div>
            <div className="kpi-l">Nivel</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-n" style={{ fontSize: 11, color: 'var(--text2)' }}>
              {analysis.fortalezas_criticas?.length ?? 0} fortalezas
            </div>
            <div className="kpi-l">Críticas</div>
          </div>
        </div>

        {/* Scores */}
        <div className="scores-section">
          <p className="section-title">Scores Detallados (8 Dimensiones)</p>
          {(Object.entries(scores) as [string, number][]).map(([key, val]) => (
            <div key={key} className="score-row">
              <div className="score-row-head">
                <span className="lbl">{SCORE_LABELS[key] ?? key}</span>
                <span className="val">{val}%</span>
              </div>
              <div className="score-track">
                <div
                  className="score-fill"
                  style={{ width: `${val}%`, background: scoreColor(val) }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Fortalezas / Brechas */}
        {(fort.length > 0 || brec.length > 0) && (
          <div className="fb-section">
            <div>
              <p className="fb-col-title green">Fortalezas</p>
              {fort.length > 0
                ? <ul className="fb-list">{fort.map((f, i) => <li key={i}>{f}</li>)}</ul>
                : <p className="text-sm">Sin fortalezas identificadas</p>
              }
            </div>
            <div>
              <p className="fb-col-title orange">Brechas</p>
              {brec.length > 0
                ? <ul className="fb-list">{brec.map((b, i) => <li key={i}>{b}</li>)}</ul>
                : <p className="text-sm">Sin brechas identificadas</p>
              }
            </div>
          </div>
        )}

        {/* Red Flags */}
        {redf.length > 0 && (
          <div className="red-flags-section">
            <p className="fb-col-title red">Red Flags</p>
            <ul className="fb-list">{redf.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        )}

        {/* Preguntas entrevista */}
        {pregs.length > 0 && (
          <div className="interview-section">
            <p className="section-title">Preguntas Sugeridas en Entrevista</p>
            <ol>
              {pregs.map((q, i) => <li key={i}>{q}</li>)}
            </ol>
          </div>
        )}

        {/* ChatJob */}
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-avatar">CJ</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>ChatJob</div>
              <div style={{ fontSize: 10, color: 'var(--text2)' }}>
                Pregunta sobre el candidato, el JD o el proyecto
              </div>
            </div>
          </div>

          <div className="chat-msgs">
            {result.chat.map((msg, i) => (
              <div
                key={i}
                className={msg.role === 'user' ? 'msg-u' : 'msg-a'}
                dangerouslySetInnerHTML={{ __html: msg.role === 'assistant' ? mdToHtml(msg.content) : msg.content }}
              />
            ))}
            {result.chatLoading && (
              <div className="msg-a">
                <div className="spinner-sm" />
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-row">
            <input
              className="chat-input"
              placeholder="Pregunta sobre el candidato..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMsg() }}
              disabled={result.chatLoading}
            />
            <button
              className="btn btn-blue btn-sm"
              onClick={sendMsg}
              disabled={result.chatLoading}
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function JobMatcher() {
  const [jd,             setJD]            = useState<Doc | null>(null)
  const [jdLoading,      setJDLoading]     = useState(false)
  const [project,        setProject]       = useState<Doc | null>(null)
  const [projectLoading, setProjectLoading] = useState(false)
  const [candidates,     setCandidates]    = useState<CandidateItem[]>([])
  const [cvLoading,      setCvLoading]     = useState(false)
  const [analyzing,      setAnalyzing]     = useState(false)
  const [results,        setResults]       = useState<AnalysisResult[]>([])
  const [error,          setError]         = useState<string | null>(null)
  const [progStep,       setProgStep]      = useState(0)   // 1-3 durante análisis

  const step = results.length > 0 ? 5
             : analyzing         ? 4
             : candidates.length ? 3
             : jd                ? 2
             : 1

  // ── Upload JD ──────────────────────────────────────────────────────────────
  async function handleJDUpload(files: FileList) {
    const file = files[0]
    if (!file) return
    setJDLoading(true)
    setJD(null)
    try {
      const up = await apiUpload(file)
      if (!up.success || !up.text) throw new Error('No se pudo extraer el texto del archivo.')
      setJD({ name: file.name, text: up.text, summary: null })
      // Generar resumen asíncrono (no bloquea)
      apiSummarize(up.text, 'job').then(sr => {
        setJD(prev => prev ? { ...prev, summary: sr.success ? sr.summary : null } : prev)
      }).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al leer el Job Description.')
    } finally {
      setJDLoading(false)
    }
  }

  // ── Upload Project ──────────────────────────────────────────────────────────
  async function handleProjectUpload(files: FileList) {
    const file = files[0]
    if (!file) return
    setProjectLoading(true)
    setProject(null)
    try {
      const up = await apiUpload(file)
      if (!up.success || !up.text) throw new Error('No se pudo extraer el texto del archivo.')
      setProject({ name: file.name, text: up.text, summary: null })
      apiSummarize(up.text, 'project').then(sr => {
        setProject(prev => prev ? { ...prev, summary: sr.success ? sr.summary : null } : prev)
      }).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al leer el documento de proyecto.')
    } finally {
      setProjectLoading(false)
    }
  }

  // ── Upload CVs ──────────────────────────────────────────────────────────────
  async function handleCVUpload(files: FileList) {
    setCvLoading(true)
    const newCands: CandidateItem[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const up = await apiUpload(file)
        if (up.success && up.text) {
          newCands.push({
            id:       crypto.randomUUID(),
            name:     normalizeCandidateName(file.name),
            fileName: file.name,
            text:     up.text,
          })
        }
      } catch {
        // Silencioso por CV individual — no interrumpe el resto
      }
    }
    setCandidates(prev => [...prev, ...newCands])
    setCvLoading(false)
  }

  // ── Analizar todos ──────────────────────────────────────────────────────────
  async function runMatcher() {
    if (!jd) { setError('Falta la descripción del puesto.'); return }
    if (!candidates.length) { setError('Falta subir al menos un CV.'); return }

    setAnalyzing(true)
    setResults([])
    setError(null)
    setProgStep(1)

    await new Promise(r => setTimeout(r, 300))
    setProgStep(2)

    const newResults: AnalysisResult[] = []

    for (const cand of candidates) {
      try {
        const r = await apiAnalyzeCandidate({
          candidateName: cand.name,
          candidateText: cand.text,
          jobText:       jd.summary ?? jd.text,
          projectText:   project ? (project.summary ?? project.text) : undefined,
        })
        if (r.success && r.analysis) {
          const analysis = parseAnalysis(r.analysis)
          newResults.push({ candidateName: cand.name, analysis, chat: [], chatLoading: false })
          // Mostrar resultados a medida que llegan
          setResults(prev => [...prev, { candidateName: cand.name, analysis, chat: [], chatLoading: false }])
        } else {
          setError(`Error en el análisis de ${cand.name}: ${r.error ?? 'respuesta inválida'}`)
        }
      } catch (e) {
        setError(`No se pudo analizar a ${cand.name}. ${e instanceof Error ? e.message : ''}`)
      }
    }

    setProgStep(3)
    await new Promise(r => setTimeout(r, 300))
    setAnalyzing(false)
    setProgStep(0)

    if (newResults.length === 0) {
      setError('No se pudo generar ningún resultado. Verificá la conexión y la API key.')
    }
  }

  // ── ChatJob por candidato ───────────────────────────────────────────────────
  async function handleChat(idx: number, question: string) {
    setResults(prev => prev.map((r, i) =>
      i === idx
        ? { ...r, chat: [...r.chat, { role: 'user', content: question }], chatLoading: true }
        : r
    ))

    try {
      const result = results[idx]
      const res = await apiAskQuestion({
        question,
        analysisResult:  result?.analysis ?? null,
        projectContext:  project ? (project.summary ?? project.text) : undefined,
        jobDescription:  jd ? (jd.summary ?? jd.text) : undefined,
      })
      const answer = res.success ? res.answer : (res.error ?? 'Sin respuesta')
      setResults(prev => prev.map((r, i) =>
        i === idx
          ? { ...r, chat: [...r.chat, { role: 'assistant', content: answer }], chatLoading: false }
          : r
      ))
    } catch {
      setResults(prev => prev.map((r, i) =>
        i === idx
          ? { ...r, chat: [...r.chat, { role: 'assistant', content: 'Error de conexión.' }], chatLoading: false }
          : r
      ))
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">

      {/* Step bar */}
      <StepBar steps={MATCHER_STEPS} current={step} />

      {/* Error banner */}
      {error && (
        <div className="card" style={{ marginBottom: 12, borderColor: 'var(--red)', background: 'var(--red-l)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="text-err">{error}</span>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
              onClick={() => setError(null)}
            >✕</button>
          </div>
        </div>
      )}

      {/* Sección 1: JD + Proyecto */}
      <div className="grid-2" style={{ marginBottom: 12 }}>

        {/* Job Description */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">📋 Job Description</div>
              <div className="card-sub">PDF, DOCX o TXT con el puesto a cubrir</div>
            </div>
            {jd && <span className="badge badge-green">Cargado</span>}
          </div>
          <div className="card-body">
            {!jd && !jdLoading ? (
              <UploadZone
                label="Subir Job Description"
                hint="Arrastrá o hacé clic"
                icon="📋"
                onFiles={handleJDUpload}
              />
            ) : (
              <UploadZone
                label={jd?.name ?? ''}
                filename={jd?.name}
                loading={jdLoading}
                onFiles={handleJDUpload}
              />
            )}

            {jd && (
              <div className="mt-8">
                <p className="text-sm" style={{ marginBottom: 4 }}>Resumen estructurado:</p>
                <div
                  className={`summary-box ${!jd.summary ? 'loading' : ''}`}
                  dangerouslySetInnerHTML={{
                    __html: jd.summary
                      ? mdToHtml(jd.summary)
                      : '<div style="display:flex;align-items:center;gap:8px"><div class="spinner-sm"></div><span>Generando resumen con Claude...</span></div>',
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Proyecto */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">📁 Documento de Proyecto</div>
              <div className="card-sub">Opcional — enriquece el análisis</div>
            </div>
            {project && <span className="badge badge-navy">Cargado</span>}
          </div>
          <div className="card-body">
            {!project && !projectLoading ? (
              <UploadZone
                label="Subir documento de proyecto"
                hint="Opcional pero recomendado"
                icon="📁"
                onFiles={handleProjectUpload}
              />
            ) : (
              <UploadZone
                label={project?.name ?? ''}
                filename={project?.name}
                loading={projectLoading}
                onFiles={handleProjectUpload}
              />
            )}

            {project && (
              <div className="mt-8">
                <p className="text-sm" style={{ marginBottom: 4 }}>Resumen estructurado:</p>
                <div
                  className={`summary-box ${!project.summary ? 'loading' : ''}`}
                  dangerouslySetInnerHTML={{
                    __html: project.summary
                      ? mdToHtml(project.summary)
                      : '<div style="display:flex;align-items:center;gap:8px"><div class="spinner-sm"></div><span>Generando resumen con Claude...</span></div>',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sección 2: Candidatos */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <div>
            <div className="card-title">👥 Candidatos</div>
            <div className="card-sub">
              {candidates.length === 0
                ? 'Sin candidatos cargados'
                : `${candidates.length} candidato${candidates.length !== 1 ? 's' : ''} cargado${candidates.length !== 1 ? 's' : ''}`
              }
            </div>
          </div>
          {cvLoading && <div className="spinner-sm" />}
        </div>

        <div className="card-body">
          <UploadZone
            label="Subir CVs"
            hint="Podés subir varios a la vez"
            icon="👤"
            accept=".pdf,.docx,.txt"
            multiple
            loading={cvLoading}
            onFiles={handleCVUpload}
          />

          {candidates.length > 0 && (
            <div className="cand-list mt-12">
              {candidates.map(c => (
                <div key={c.id} className="cand-item">
                  <div className="cand-av">{toInitials(c.name)}</div>
                  <div style={{ flex: 1 }}>
                    <div className="cand-name">{c.name}</div>
                    <div className="cand-file">{c.fileName}</div>
                  </div>
                  <button
                    className="cand-remove"
                    onClick={() => setCandidates(prev => prev.filter(x => x.id !== c.id))}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {!cvLoading && candidates.length === 0 && (
            <div className="empty-state">
              <div className="empty-ico">👤</div>
              <div className="empty-t">Sin candidatos</div>
              <div className="empty-s">Subí uno o más CVs para evaluar</div>
            </div>
          )}
        </div>
      </div>

      {/* Botón Analizar */}
      {(jd || candidates.length > 0) && (
        <div style={{ marginBottom: 16 }}>
          <button
            className="btn-analyze"
            onClick={runMatcher}
            disabled={analyzing || !jd || candidates.length === 0}
          >
            {analyzing ? 'Analizando...' : `Analizar ${candidates.length > 1 ? `${candidates.length} candidatos` : '1 candidato'}`}
          </button>
        </div>
      )}

      {/* Progress durante análisis */}
      {analyzing && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body">
            <p className="section-title" style={{ marginBottom: 8 }}>Análisis en curso</p>
            <div className="prog-steps">
              {[
                { id: 1, label: 'Preparando contexto' },
                { id: 2, label: 'Consultando Claude AI' },
                { id: 3, label: 'Procesando resultados' },
              ].map(ps => {
                const state = ps.id < progStep ? 'done' : ps.id === progStep ? 'run' : ''
                return (
                  <div key={ps.id} className={`prog-step ${state}`}>
                    <div className="ps-dot" />
                    {ps.label}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <>
          <div style={{ marginBottom: 12 }}>
            <p className="section-title">
              Resultados — {results.length} candidato{results.length !== 1 ? 's' : ''} analizados
            </p>
          </div>
          {results.map((r, i) => (
            <ResultCard
              key={r.candidateName + i}
              result={r}
              idx={i}
              onChat={handleChat}
            />
          ))}
        </>
      )}
    </div>
  )
}
