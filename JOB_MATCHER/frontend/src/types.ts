// ── Job Matcher ───────────────────────────────────────────────────────────────

export interface ScoresDetallados {
  fit_tecnico:                     number
  fit_experiencia:                 number
  fit_liderazgo:                   number
  fit_cultural:                    number
  fit_idiomas_comunicacion:        number
  fit_formacion_certificaciones:   number
  fit_compensacion_expectativas:   number
  red_flags_alertas:               number
}

export interface CandidateAnalysis {
  compatibilidad_general:       number
  nivel_match:                  string
  recomendacion:                string
  scores_detallados:            ScoresDetallados
  fortalezas_criticas:          string[]
  fortalezas_adicionales:       string[]
  brechas_criticas:             string[]
  brechas_menores:              string[]
  red_flags:                    string[]
  puntos_validar_entrevista:    string[]
  analisis_tecnico_detallado:   string
  analisis_experiencia_liderazgo: string
  analisis_cultural_comunicacion: string
  justificacion_recomendacion:  string
}

// ── JD Generator ──────────────────────────────────────────────────────────────

export interface JDProfile {
  rol:                    string
  tipo:                   string
  proveedor:              string
  seniority:              string
  justificacion:          string
  jd_recomendado:         boolean
  preguntas_refinamiento: string[]
}

export interface JDAnalysis {
  proyecto:                string
  cliente:                 string
  duracion:                string
  stack_principal:         string[]
  perfiles_identificados:  JDProfile[]
  total_jds:               number
  observaciones:           string
}

export interface Template {
  id:     string
  nombre: string
  perfil: string
}
