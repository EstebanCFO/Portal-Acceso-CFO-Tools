# Convenciones de Código — CFOTech Portal de Acceso

Aplica a todos los archivos del portal shell (`src/`) y frontends de apps.

---

## TypeScript

- `strict: true` en todos los `tsconfig.json`. **Nunca usar `any`.**
- Componentes funcionales con tipado explícito de props:
  ```typescript
  interface Props { appId: string; onClose: () => void }
  const MyComponent = ({ appId, onClose }: Props) => { ... }
  ```
- Props opcionales con `?`, nunca con `| undefined` explícito.

## Operadores — regla crítica

```typescript
// ✅ CORRECTO — env vars que pueden ser string vacío:
const url = import.meta.env.VITE_API_URL || 'http://localhost:5010'

// ❌ INCORRECTO — "" ?? fallback evalúa a "" (bug silencioso):
const url = import.meta.env.VITE_API_URL ?? 'http://localhost:5010'
```

**Regla:** usar `||` para variables de entorno. Reservar `??` para valores que pueden ser `null`/`undefined` pero donde `""` o `0` son valores válidos.

## CSS

- **CSS plano** con variables del Design System (`index.css`). Sin Tailwind, sin MUI.
- No usar inline styles salvo valores verdaderamente dinámicos (ej: `width: ${pct}%`).
- Clases en kebab-case: `.app-card`, `.nav-pill--active`.
- Leer `DESIGN_SYSTEM.md` antes de crear cualquier pantalla o componente.

## Imports

- Paths relativos: `'../components/Header'` — **sin aliases `@/`**.
- Agrupar: externos → internos → tipos.

## Naming

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Componentes React | PascalCase | `AppFrame.tsx` |
| Utils / hooks | camelCase | `launcher.ts` |
| Constantes globales | UPPER_SNAKE | `APP_REGISTRY` |
| CSS clases | kebab-case | `.nav-pill` |

## URLs — nunca hardcodear

```typescript
// ✅
url: `/apps/proyectos-activos/`
const apiBase = import.meta.env.VITE_API_URL || `http://${host}:5010`

// ❌
url: 'http://localhost:5011/apps/proyectos-activos/'
```

Siempre desde `app.url`, `import.meta.env` o variables de config.
