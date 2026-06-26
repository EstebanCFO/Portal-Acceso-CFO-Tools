// tipos.ts — Interfaces TypeScript para Proyectos Activos

export interface Periodo {
  period_date: string    // "2026-01-01"
  label:       string    // "Junio 2026 — 14:30:22"
  upload_ts?:  string    // "14:30:22" (presente cuando viene de ingest_uploads)
}

export interface SemaforoReferencia {
  color_label:   string
  color_hex:     string
  threshold_min: number
  threshold_max: number | null
  description:   string
  sort_order:    number
}

export interface SemaforoRow {
  project_id:          number | null
  project_name:        string | null
  cliente_name:        string | null
  tipo:                string | null
  period_date:         string
  semaforo_type:       string
  resultado_real:      number | null
  resultado_esperado:  number | null
  variacion_pct:       number | null
  accion_sugerida:     string | null
  facturacion_real:    number | null
  color_label:         string | null
  color_hex:           string | null
}

export interface DCMetrics {
  period_date:                         string
  resultado_comercial:                 number | null
  resultado_comercial_pct:             number | null
  resultado_comercial_neto_bench:      number | null
  resultado_comercial_neto_bench_pct:  number | null
  costo_total_bench:                   number | null
  costo_bench_manpower:                number | null
  costo_bench_dc:                      number | null
  recursos_delivery_center:            number | null
  total_recursos_bench:                number | null
}

export interface SemaforoGeneral {
  period_date:   string
  semaforo_type: string
  proyectos:     SemaforoRow[]
  dc_metrics:    DCMetrics | null
  referencia:    SemaforoReferencia[]
}

export interface Recurso {
  dni:                   string
  nombre_completo:       string
  role_name:             string
  contract_type:         string
  code_ceco:             string
  total_hours:           number
  monthly_hours:         number
  extra_hours:           number
  monthly_salary:        number
  total_monthly_cost:    number
  monthly_resource_cost: number
  extra_hours_cost:      number
  extra_hours_ratio:     number
}

export interface Financial {
  period_date:             string
  revenue:                 number
  sale_price_with_vat:     number
  monthly_sale_price:      number
  commercial_margin_value: number
  result_percentage:       number
  commercial_commission:   number
  peaje_wht_percentage:    number
  peaje_wht_value:         number
  project_result:          number
  color_label:             string | null
  color_hex:               string | null
}

export interface HistoryRow {
  period_date:       string
  is_cumulative:     boolean
  billing:           number
  commercial_margin: number
  result_percentage: number
}

export interface EjercicioEconomico {
  project_id:              number
  project_name:            string
  client_name:             string
  sheet_name:              string
  tipo:                    string
  period_date:             string   // período real de los datos (recursos/financiero)
  semaforo_period_date?:   string   // período del semáforo (puede diferir)
  recursos:                Recurso[]
  financials:              Financial | null
  history:                 HistoryRow[]
  total_recursos:          number
  total_horas:             number
  costo_total_recursos:    number
}

export interface ProjectListItem {
  id:          number
  name:        string
  sheet_name:  string
  tipo:        string
  is_active:   boolean
  client_name: string
}

export interface IngestResult {
  ok:                 boolean
  period:             string | null
  solapas_real:       number
  recursos_total:     number
  semaforo_acumulado: number
  semaforo_mensual:   number
  semaforo_matched:   number
  semaforo_unmatched: number
  unmatched_names:    string[]
}
