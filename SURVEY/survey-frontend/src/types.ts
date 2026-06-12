// types.ts — interfaces TypeScript para la API de Survey Analytics

// ── Lista de surveys ──────────────────────────────────────────────────────────

export interface SurveyListResponse {
  surveys:  SurveyItem[]
  total:    number
}

export interface SurveyItem {
  id:            string
  title:         string
  responseCount: number
  dateCreated:   string | null
  dateModified:  string | null
}

// ── Detalle de survey ─────────────────────────────────────────────────────────

export interface SurveyDetailResponse {
  id:            string
  title:         string
  responseCount: number
  dateCreated:   string | null
  dateModified:  string | null
  questions:     QuestionInfo[]
}

export interface QuestionInfo {
  id:      string
  heading: string
  family:  QuestionFamily
  subtype: string | null
  choices: ChoiceInfo[] | null
}

export type QuestionFamily =
  | 'rating'
  | 'matrix'
  | 'open_ended'
  | 'multiple_choice'
  | 'checkbox'
  | 'demographic'
  | 'presentation'
  | string   // SM puede tener otros tipos

export interface ChoiceInfo {
  id:       string
  text:     string
  position: number
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface SurveyAnalyticsResponse {
  surveyId:       string
  surveyTitle:    string
  totalResponses: number
  questions:      QuestionAnalytics[]
}

export interface QuestionAnalytics {
  questionId: string
  heading:    string
  family:     string
  subtype:    string | null
  answered:   number
  skipped:    number
  choices:    ChoiceResult[] | null
}

export interface ChoiceResult {
  id:               string
  text:             string
  count:            number
  percentage:       number
  representedLabel: string
}
