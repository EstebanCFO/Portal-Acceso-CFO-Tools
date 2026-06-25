// ── Registro central de apps del portal ──────────────────────────────────────
// Para agregar una nueva app: añadir un objeto al array APP_REGISTRY.
// El portal la mostrará automáticamente en el header y en el Dashboard.


export interface App {
  id: string            // slug único → usado como key
  name: string          // nombre mostrado en la pill y en el header
  description: string
  icon: string          // emoji o SVG inline
  url: string           // URL donde vive la app
  type: 'iframe' | 'link'
  iconBg: string        // fondo del cuadro de ícono en el Dashboard
  iconColor: string
  tags: string[]
  status: 'active' | 'maintenance' | 'coming-soon'
  category: string
  startCmd?: string     // bat/cmd para iniciar el servidor (mostrado en estado offline)
}

export const APP_REGISTRY: App[] = [
  {
    id:          'reporte-devops',
    name:        'Reporte DevOps',
    description: 'Métricas Azure DevOps por org/proyecto, desvíos de sprint, test plans y generación de PDF',
    icon:        '📋',
    url:         '/apps/reporte-devops/',
    type:        'iframe',
    iconBg:      '#EEF2F8',
    iconColor:   '#0A1F44',
    tags:        ['DevOps', 'Azure', 'Delivery'],
    status:      'active',
    category:    'Delivery Center',
  },
  {
    id:          'bandas-salariales',
    name:        'Bandas Salariales',
    description: 'Gestión y análisis de bandas salariales por posición y nivel',
    icon:        '📊',
    url:         '/apps/bandas-salariales/',
    type:        'iframe',
    iconBg:      '#EEF2F8',
    iconColor:   '#0A1F44',
    tags:        ['RRHH', 'Compensaciones'],
    status:      'active',
    category:    'Recursos Humanos',
  },
  {
    id:          'job-matcher',
    name:        'Job Matcher',
    description: 'Matching IA de candidatos con posiciones + generación de Job Descriptions desde propuestas',
    icon:        '🔍',
    url:         '/apps/job-matcher/',
    type:        'iframe',
    iconBg:      '#F0FDF4',
    iconColor:   '#00875A',
    tags:        ['IA', 'RRHH', 'Matching', 'JD Generator'],
    status:      'active',
    category:    'Recursos Humanos',
  },
  {
    id:          'survey',
    name:        'Survey Analytics',
    description: 'Feedback de clientes y proyectos desde SurveyMonkey — respuestas y analytics por pregunta',
    icon:        '📝',
    url:         '/apps/survey/',
    type:        'iframe',
    iconBg:      '#FFF7ED',
    iconColor:   '#C96A00',
    tags:        ['Encuestas', 'Analytics', 'SurveyMonkey'],
    status:      'active',
    category:    'Analytics',
  },
  {
    id:          'sound-catch',
    name:        'Audio a Texto',
    description: 'Transcripcion de audio multi-formato con IA — WAV, OGG, MP3, WhatsApp PTT y mas',
    icon:        '🎙',
    // Servido desde el gateway unificado — sin puerto separado, sin delay.
    url:         '/apps/sound-catch/',
    type:        'iframe',
    iconBg:      '#E6FAF5',
    iconColor:   '#00A878',
    tags:        ['Audio', 'IA', 'Transcripcion', 'WhatsApp'],
    status:      'active',
    category:    '',
  },
]

// Helpers
export const getApp = (id: string) => APP_REGISTRY.find(a => a.id === id)
export const activeApps   = APP_REGISTRY.filter(a => a.status === 'active')
export const allApps      = APP_REGISTRY
