// ── CFOTech IT Tools Design System tokens ────────────────────────────────────
// Fuente de verdad: DESIGN_SYSTEM.md en la raíz del repo.
// FASE 4: MUI removido — solo tokens DS y helper semaforo()

export const DS = {
  navyDark:  '#0B1526',
  navy:      '#0A1F44',
  navy2:     '#0D2B5E',
  blue:      '#4472C4',
  green:     '#00875A',
  greenL:    '#E3F5EE',
  greenA:    '#4FD1B2',
  logoGreen: '#00A878',
  red:       '#C0392B',
  orange:    '#C96A00',
  gray1:     '#F4F6F9',
  gray2:     '#E8ECF2',
  gray3:     '#C5CDD8',
  text:      '#0D1B2A',
  text2:     '#4A5568',
  border:    '#D1D9E6',
} as const

// ── Helper: semáforo numérico (escala 1–5) ───────────────────────────────────
export function semaforo(valor: number | null): { bg: string; color: string } {
  if (valor == null) return { bg: DS.gray2, color: DS.text2 }
  if (valor >= 4.0)  return { bg: DS.green,  color: '#085041' }
  if (valor >= 3.0)  return { bg: '#FFF3E0', color: DS.orange }
  return               { bg: '#FDECEA',  color: DS.red }
}
