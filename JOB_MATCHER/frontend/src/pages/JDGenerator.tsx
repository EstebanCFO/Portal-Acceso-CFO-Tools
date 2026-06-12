import { useEffect, useRef, useState } from 'react'
import UploadZone from '../components/UploadZone'
import StepBar    from '../components/StepBar'
import {
  apiUpload, apiSummarize,
  apiJDAnalyze, apiJDGenerate,
  apiGetTemplates, apiSaveTemplate, apiDeleteTemplate,
} from '../api/client'
import type { JDAnalysis, JDProfile, Template } from '../types'

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface JDChatMsg { who: 'agent' | 'user'; html: string }

const JD_STEPS = [
  { label: 'Subir propuesta' },
  { label: 'Equipo detectado' },
  { label: 'Refinamiento' },
  { label: 'Generando JD' },
  { label: 'JD listo' },
]

// ── TemplateDrawer ─────────────────────────────────────────────────────────────

interface DrawerProps {
  open:      boolean
  templates: Template[]
  onClose:   () => void
  onSaved:   () => void
  onDelete:  (id: string) => void
}

function TemplateDrawer({ open, templates, onClose, onSaved, onDelete }: DrawerProps) {
  const [file,   setFile]   = useState<File | null>(null)
  const [nombre, setNombre] = useState('')
  const [perfil, setPerfil] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function save() {
    if (!file) { alert('Seleccioná un archivo .docx'); return }
    if (!perfil) { alert('Seleccioná el perfil del template'); return }
    setSaving(true)
    try {
      await apiSaveTemplate(file, nombre || file.name.replace('.docx', ''), perfil)
      setFile(null); setNombre(''); setPerfil('')
      onSaved()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {open && <div className="drawer-overlay" onClick={onClose} />}
      <div className={`drawer ${open ? 'open' : ''}`}>
        <div className="drawer-head">
          <span className="card-title">📄 Templates DOCX</span>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">

          {/* Lista de templates */}
          {templates.length === 0 ? (
            <p className="text-sm" style={{ textAlign: 'center', padding: '14px 0' }}>
              No hay templates guardados
            </p>
          ) : (
            <div style={{ marginBottom: 16 }}>
              {templates.map(t => (
                <div key={t.id} style={{
                  background: 'var(--gray1)', borderRadius: 8, padding: '10px 12px',
                  marginBottom: 7, display: 'flex', alignItems: 'center', gap: 9,
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 28, height: 28, background: 'var(--navy)', borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: 'white', flexShrink: 0,
                  }}>📄</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.nombre}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text2)' }}>{t.perfil}</p>
                  </div>
                  <button
                    onClick={() => onDelete(t.id)}
                    style={{
                      background: 'var(--red-l)', border: 'none', borderRadius: 5,
                      color: 'var(--red)', fontSize: 11, cursor: 'pointer', padding: '3px 7px',
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="section-divider" />
          <p className="section-title">Agregar template</p>

          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                border: `2px dashed ${file ? 'var(--green)' : 'var(--border)'}`,
                borderRadius: 8, padding: '14px 12px', cursor: 'pointer', textAlign: 'center',
                background: file ? 'var(--green-l)' : 'var(--gray1)', marginBottom: 8,
              }}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef} type="file" accept=".docx"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setFile(f); if (!nombre) setNombre(f.name.replace('.docx', '')) }
                  e.target.value = ''
                }}
              />
              {file
                ? <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✓ {file.name}</span>
                : <span style={{ fontSize: 12, color: 'var(--text2)' }}>📎 Subir .docx</span>
              }
            </div>

            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input
                className="form-input" value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Template Backend Node.js"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Perfil</label>
              <select className="form-select" value={perfil} onChange={e => setPerfil(e.target.value)}>
                <option value="">Seleccionar perfil...</option>
                <option>General</option>
                <option>Frontend</option>
                <option>Backend</option>
                <option>FullStack</option>
                <option>DevOps</option>
                <option>QA</option>
                <option>Tech Lead</option>
                <option>Data</option>
                <option>Mobile</option>
              </select>
            </div>

            <button
              className="btn btn-navy"
              style={{ width: '100%' }}
              onClick={save}
              disabled={saving || !file}
            >
              {saving ? 'Guardando...' : 'Guardar template'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function JDGenerator() {
  const [proposalFile,    setProposalFile]   = useState<File | null>(null)
  const [proposalName,    setProposalName]   = useState('')
  const [proposalSummary, setProposalSummary] = useState<string | null>(null)
  const [uploadLoading,   setUploadLoading]  = useState(false)
  const [contexto,        setContexto]       = useState('')
  const [analysis,        setAnalysis]       = useState<JDAnalysis | null>(null)
  const [analyzing,       setAnalyzing]      = useState(false)
  const [selectedIdx,     setSelectedIdx]    = useState<number | null>(null)
  const [chat,            setChat]           = useState<JDChatMsg[]>([])
  const [chatInput,       setChatInput]      = useState('')
  const [generating,      setGenerating]     = useState(false)
  const [docxBlob,        setDocxBlob]       = useState<{ blob: Blob; name: string } | null>(null)
  const [progStep,        setProgStep]       = useState(0)
  const [genProgStep,     setGenProgStep]    = useState(0)
  const [templates,       setTemplates]      = useState<Template[]>([])
  const [drawerOpen,      setDrawerOpen]     = useState(false)
  const [error,           setError]          = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Calcular step actual
  const jdStep = docxBlob ? 5
               : generating ? 4
               : selectedIdx !== null ? 3
               : analysis ? 2
               : 1

  useEffect(() => {
    apiGetTemplates().then(d => setTemplates(d.templates ?? [])).catch(() => {})
  }, [])

  // ── Upload propuesta ────────────────────────────────────────────────────────
  async function handleProposalUpload(files: FileList) {
    const file = files[0]
    if (!file) return
    setUploadLoading(true)
    setProposalFile(file)
    setProposalName(file.name)
    setProposalSummary(null)
    setAnalysis(null)
    setSelectedIdx(null)
    setChat([])
    setDocxBlob(null)
    try {
      const up = await apiUpload(file)
      if (!up.success || !up.text) throw new Error('No se pudo extraer el texto del archivo.')
      setProposalSummary(null) // loading state
      apiSummarize(up.text, 'propuesta').then(sr => {
        setProposalSummary(sr.success ? sr.summary : null)
      }).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al leer la propuesta.')
    } finally {
      setUploadLoading(false)
    }
  }

  // ── Analizar propuesta ──────────────────────────────────────────────────────
  async function runAnalyze() {
    if (!proposalFile) { setError('Falta adjuntar la propuesta técnica.'); return }
    setAnalyzing(true)
    setAnalysis(null)
    setSelectedIdx(null)
    setChat([])
    setDocxBlob(null)
    setError(null)
    setProgStep(1)

    try {
      await new Promise(r => setTimeout(r, 300))
      setProgStep(2)
      const r = await apiJDAnalyze(proposalFile, contexto || undefined)
      setProgStep(3)
      await new Promise(r2 => setTimeout(r2, 200))
      setProgStep(4)
      if (!r.success) throw new Error(r.error ?? 'Error en el análisis')
      await new Promise(r2 => setTimeout(r2, 200))
      setAnalysis(r.analysis)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo analizar la propuesta.')
    } finally {
      setAnalyzing(false)
      setProgStep(0)
    }
  }

  // ── Seleccionar perfil ──────────────────────────────────────────────────────
  function selectProfile(idx: number) {
    const p = analysis?.perfiles_identificados[idx]
    if (!p) return
    setSelectedIdx(idx)
    setDocxBlob(null)
    setChat([])

    const initMsgs: JDChatMsg[] = [
      { who: 'agent', html: `Voy a generar el JD para <strong>${p.rol}</strong> (${p.tipo}, ${p.seniority}).` },
    ]
    if (p.preguntas_refinamiento?.length) {
      initMsgs.push({ who: 'agent', html: 'Antes de continuar, necesito confirmar algunos puntos:' })
      p.preguntas_refinamiento.forEach((q, i) => {
        initMsgs.push({ who: 'agent', html: `${i + 1}. ${q}` })
      })
      initMsgs.push({ who: 'agent', html: 'Respondé las preguntas o hacé clic en <strong>Generar JD</strong> si está todo claro.' })
    } else {
      initMsgs.push({ who: 'agent', html: 'No hay ambigüedades detectadas. Podés agregar contexto o hacer clic en <strong>Generar JD</strong> directamente.' })
    }
    setChat(initMsgs)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // ── Enviar mensaje de refinamiento ─────────────────────────────────────────
  function sendChatMsg() {
    const txt = chatInput.trim()
    if (!txt) return
    setChat(prev => [
      ...prev,
      { who: 'user', html: txt },
      { who: 'agent', html: 'Anotado. Cuando estés listo, hacé clic en <strong>Generar JD</strong>.' },
    ])
    setChatInput('')
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  // ── Generar DOCX ────────────────────────────────────────────────────────────
  async function runGenerate() {
    if (!proposalFile || selectedIdx === null || !analysis) return
    const p: JDProfile = analysis.perfiles_identificados[selectedIdx]

    const respuestas = chat
      .filter(m => m.who === 'user')
      .map(m => m.html.replace(/<[^>]+>/g, ''))
      .join('; ')

    const tplId = findTemplate(p.rol) ?? findTemplate(p.tipo) ?? undefined

    setGenerating(true)
    setDocxBlob(null)
    setError(null)
    setGenProgStep(1)

    try {
      await new Promise(r => setTimeout(r, 300))
      setGenProgStep(2)

      const result = await apiJDGenerate({
        file:                   proposalFile,
        cliente:                analysis.cliente ?? 'CFOTech',
        rol:                    p.rol,
        tipo_perfil:            p.tipo,
        seniority:              p.seniority,
        contexto:               contexto || undefined,
        respuestas_refinamiento: respuestas || undefined,
        template_id:            tplId,
      })

      setGenProgStep(3)
      await new Promise(r => setTimeout(r, 300))
      setGenProgStep(4)
      await new Promise(r => setTimeout(r, 200))
      setGenProgStep(5)

      const docxName = `JD_${p.rol.replace(/[^a-zA-Z0-9]/g, '_')}_${analysis.cliente.replace(/[^a-zA-Z0-9]/g, '_')}.docx`
      setDocxBlob({ blob: result.blob, name: result.filename || docxName })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el Job Description.')
    } finally {
      setGenerating(false)
      setGenProgStep(0)
    }
  }

  // ── Descargar DOCX ──────────────────────────────────────────────────────────
  function downloadDocx() {
    if (!docxBlob) return
    const url = URL.createObjectURL(docxBlob.blob)
    const a   = document.createElement('a')
    a.href = url; a.download = docxBlob.name; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  function reset() {
    setProposalFile(null); setProposalName(''); setProposalSummary(null)
    setAnalysis(null); setSelectedIdx(null); setChat([]); setDocxBlob(null)
    setContexto(''); setError(null)
  }

  // ── Template helpers ────────────────────────────────────────────────────────
  function findTemplate(query: string) {
    const exact   = templates.find(t => t.perfil.toLowerCase() === query.toLowerCase())
    const general = templates.find(t => t.perfil === 'General')
    return exact?.id ?? general?.id ?? null
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">

      {/* Drawer templates */}
      <TemplateDrawer
        open={drawerOpen}
        templates={templates}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => apiGetTemplates().then(d => setTemplates(d.templates ?? [])).catch(() => {})}
        onDelete={id => {
          apiDeleteTemplate(id).then(() =>
            apiGetTemplates().then(d => setTemplates(d.templates ?? [])).catch(() => {})
          ).catch(() => {})
        }}
      />

      {/* Header de la sección */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <StepBar steps={JD_STEPS} current={jdStep} />
        <button
          className="btn btn-outline btn-sm"
          style={{ flexShrink: 0, marginLeft: 12 }}
          onClick={() => setDrawerOpen(true)}
        >
          🗂 Templates
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ marginBottom: 12, borderColor: 'var(--red)', background: 'var(--red-l)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="text-err">{error}</span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }} onClick={() => setError(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Paso 1: Upload propuesta */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <div>
            <div className="card-title">📋 Propuesta Técnica</div>
            <div className="card-sub">
              {proposalFile ? proposalName : 'Subí el documento de propuesta para analizar los perfiles necesarios'}
            </div>
          </div>
          {proposalFile && !analyzing && (
            <button className="btn btn-outline btn-sm" onClick={reset}>Cambiar</button>
          )}
        </div>

        <div className="card-body">
          {!proposalFile ? (
            <>
              <UploadZone
                label="Subir propuesta técnica"
                hint="Arrastrá o hacé clic"
                icon="📋"
                loading={uploadLoading}
                onFiles={handleProposalUpload}
              />
              <div className="form-group mt-8">
                <label className="form-label">Contexto adicional (opcional)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Ej: cliente enterprise, foco en cloud AWS, equipo de 3 personas..."
                  value={contexto}
                  onChange={e => setContexto(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <UploadZone
                label={proposalName}
                filename={proposalName}
                loading={uploadLoading}
                onFiles={handleProposalUpload}
              />

              {proposalSummary !== undefined && (
                <div className="mt-8">
                  <p className="text-sm" style={{ marginBottom: 4 }}>Resumen de la propuesta:</p>
                  <div
                    className={`summary-box ${proposalSummary === null ? 'loading' : ''}`}
                    dangerouslySetInnerHTML={{
                      __html: proposalSummary !== null
                        ? proposalSummary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
                        : '<div style="display:flex;align-items:center;gap:8px"><div class="spinner-sm"></div><span>Generando resumen con Claude...</span></div>',
                    }}
                  />
                </div>
              )}

              {!analysis && (
                <div className="mt-12">
                  <button
                    id="jd-btn-analyze"
                    className="btn-analyze"
                    onClick={runAnalyze}
                    disabled={analyzing}
                  >
                    {analyzing ? 'Analizando...' : 'Analizar propuesta y detectar perfiles'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress análisis propuesta */}
      {analyzing && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body">
            <p className="section-title" style={{ marginBottom: 8 }}>Detectando equipo necesario</p>
            <div className="prog-steps">
              {[
                { id: 1, label: 'Leyendo propuesta' },
                { id: 2, label: 'Consultando Claude AI' },
                { id: 3, label: 'Identificando perfiles' },
                { id: 4, label: 'Estructurando resultados' },
              ].map(ps => {
                const state = ps.id < progStep ? 'done' : ps.id === progStep ? 'run' : ''
                return (
                  <div key={ps.id} className={`prog-step ${state}`}>
                    <div className="ps-dot" />{ps.label}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Paso 2: Equipo detectado */}
      {analysis && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-head">
            <div>
              <div className="card-title">
                {analysis.proyecto || 'Proyecto'} — {analysis.total_jds} JD{analysis.total_jds !== 1 ? 's' : ''} a generar
              </div>
              <div className="card-sub">
                Cliente: {analysis.cliente || '—'} · {analysis.duracion || 'Duración no especificada'} · Hacé clic en "Generar JD" en el perfil que querés armar
              </div>
            </div>
          </div>
          <div className="card-body">
            <div className="profile-grid">
              {analysis.perfiles_identificados.map((p, i) => (
                <div
                  key={i}
                  className={`pcard ${p.proveedor === 'CFOTech' ? 'cfo' : 'cli'}`}
                >
                  <div className="pcard-rol">{p.rol}</div>
                  <div className="pcard-tipo">{p.tipo}</div>
                  <div>
                    <span className={`ptag ${p.proveedor === 'CFOTech' ? 'ptag-g' : 'ptag-n'}`}>
                      {p.proveedor}
                    </span>
                    <span className="ptag ptag-b">{p.seniority}</span>
                  </div>
                  <div className="pcard-just">{p.justificacion}</div>
                  {p.preguntas_refinamiento?.length > 0 && (
                    <div className="pcard-warn">⚠ Hay preguntas de refinamiento</div>
                  )}
                  {p.jd_recomendado && p.proveedor === 'CFOTech' ? (
                    <button
                      className={`btn-gen-jd ${selectedIdx === i ? 'selected' : ''}`}
                      onClick={() => selectProfile(i)}
                    >
                      {selectedIdx === i ? '✓ Seleccionado' : 'Generar JD'}
                    </button>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 5 }}>
                      {p.proveedor !== 'CFOTech' ? 'Perfil del cliente, no requiere JD' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {analysis.observaciones && (
              <div className="obs-banner">
                📌 {analysis.observaciones}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paso 3: Chat de refinamiento + Generar */}
      {selectedIdx !== null && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-head">
            <div>
              <div className="card-title">💬 Refinamiento</div>
              <div className="card-sub">
                Para: {analysis?.perfiles_identificados[selectedIdx]?.rol}
              </div>
            </div>
          </div>
          <div className="card-body">
            {/* Chat history */}
            <div style={{
              background: 'var(--gray1)', borderRadius: 8, padding: 12,
              marginBottom: 10, minHeight: 80, maxHeight: 240, overflowY: 'auto',
            }}>
              {chat.map((msg, i) => (
                <div key={i} className={`jd-chat-wrap ${msg.who}`} style={{ marginBottom: 8 }}>
                  <div className={`jd-chat-av ${msg.who}`}>
                    {msg.who === 'user' ? 'Vos' : 'JD'}
                  </div>
                  <div
                    className={msg.who === 'agent' ? 'msg-a' : 'msg-u'}
                    dangerouslySetInnerHTML={{ __html: msg.html }}
                  />
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input refinamiento */}
            <div className="chat-input-row" style={{ marginBottom: 10, background: 'transparent', borderTop: 'none', padding: 0 }}>
              <input
                className="chat-input"
                placeholder="Respondé las preguntas o agregá contexto..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendChatMsg() }}
              />
              <button className="btn btn-outline btn-sm" onClick={sendChatMsg}>
                Enviar
              </button>
            </div>

            {/* Botón Generar JD */}
            <button
              className="btn-analyze"
              onClick={runGenerate}
              disabled={generating}
            >
              {generating ? 'Generando Job Description...' : '✨ Generar Job Description'}
            </button>
          </div>
        </div>
      )}

      {/* Progress generación */}
      {generating && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body">
            <p className="section-title" style={{ marginBottom: 8 }}>Generando JD con Claude AI</p>
            <div className="prog-steps">
              {[
                { id: 1, label: 'Preparando contexto' },
                { id: 2, label: 'Generando contenido' },
                { id: 3, label: 'Estructurando secciones' },
                { id: 4, label: 'Armando DOCX' },
                { id: 5, label: 'Finalizando' },
              ].map(ps => {
                const state = ps.id < genProgStep ? 'done' : ps.id === genProgStep ? 'run' : ''
                return (
                  <div key={ps.id} className={`prog-step ${state}`}>
                    <div className="ps-dot" />{ps.label}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Paso 5: JD listo */}
      {docxBlob && (
        <div className="card" style={{ borderColor: 'var(--green)' }}>
          <div className="card-head" style={{ background: 'var(--green-l)' }}>
            <div>
              <div className="card-title" style={{ color: 'var(--green)' }}>✅ Job Description listo</div>
              <div className="card-sub">{docxBlob.name}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={reset}>
              Nuevo JD
            </button>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 12 }}>
              {[
                { l: 'Posición',           v: `${analysis?.perfiles_identificados[selectedIdx ?? 0]?.rol ?? '—'}` },
                { l: 'Proyecto',           v: 'Extraído 100% de la propuesta analizada' },
                { l: 'Responsabilidades',  v: '4 áreas adaptadas al tipo de perfil' },
                { l: 'Stack técnico',      v: 'Tabla con 8 áreas del stack del proyecto' },
                { l: 'Habilidades blandas', v: 'Derivadas del contexto real del proyecto' },
              ].map((row, i) => (
                <div key={i} className="sum-row">
                  <span className="sum-arrow">→</span>
                  <span>
                    <strong>{row.l}:</strong>{' '}
                    <span style={{ color: 'var(--text2)' }}>{row.v}</span>
                  </span>
                </div>
              ))}
            </div>
            <button className="btn-analyze" onClick={downloadDocx}>
              ⬇ Descargar {docxBlob.name}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
