# /nueva-app — Integrar una nueva app al Portal

Guía paso a paso para agregar una app al Portal de Acceso CFOTech.
Ejecutar en orden. Cada paso es atómico y verificable.

---

## Parámetros requeridos

Antes de empezar, definir:
- `{id}` — identificador único en kebab-case (ej: `mi-nueva-app`)
- `{nombre}` — nombre visible (ej: `Mi Nueva App`)
- `{puerto-frontend}` — puerto Vite dev (ej: `5012`)
- `{puerto-backend}` — puerto del backend (ej: `5013`, si aplica)
- `{descripcion}` — una línea describiendo la app
- `{icono}` — emoji (ej: `📊`)
- `{categoria}` — categoría del Dashboard (ej: `Delivery Center`)
- `{tags}` — array de tags (ej: `['Finanzas', 'Proyectos']`)

---

## Paso 1 — Registro central

**Archivo:** `src/registry/apps.ts`

```typescript
{
  id:          '{id}',
  name:        '{nombre}',
  description: '{descripcion}',
  icon:        '{icono}',
  url:         '/apps/{id}/',   // ← URL gateway (NO el puerto directo)
  type:        'iframe',
  iconBg:      '#EEF2F8',
  iconColor:   '#0A1F44',
  tags:        {tags},
  status:      'active',
  category:    '{categoria}',
}
```

## Paso 2 — Gateway

**Archivo:** `portal_server.py` → dict `APPS`

```python
'{id}': {
    'backend_cmd':    '"python" app.py',          # ajustar según stack
    'backend_dir':    BASE_DIR / 'CARPETA_APP' / 'backend',
    'backend_port':   {puerto-backend},
    'backend_health': 'http://localhost:{puerto-backend}/api/health',
    'frontend_cmd':   'npm run dev',
    'frontend_dir':   BASE_DIR / 'CARPETA_APP' / 'frontend',
    'frontend_port':  {puerto-frontend},
    'frontend_dist':  BASE_DIR / 'CARPETA_APP' / 'frontend' / 'dist',
},
```

## Paso 3 — CORS del portal

**Archivo:** `src/App.tsx` → array `ALLOWED_APP_ORIGINS`

```typescript
`http://${_H}:{puerto-frontend}`,   // {nombre}
```

## Paso 4 — Test invariante

**Archivo:** `src/__tests__/registry.test.ts`

```typescript
it('{id} está activa y apunta al gateway', () => {
  const app = getApp('{id}')
  expect(app?.status).toBe('active')
  expect(app?.url).toContain('{id}')
})
```

## Paso 5 — En la app: detección iframe

```typescript
// Evaluar UNA VEZ a nivel módulo en App.tsx (o index.tsx) de la app:
const IN_PORTAL = window.self !== window.top

// Si IN_PORTAL: ocultar header propio
// Botón Salir:
window.parent.postMessage({ type: 'portal:goHome', appId: '{id}' }, import.meta.env.VITE_PORTAL_URL || 'http://localhost:5174')
```

## Paso 6 — `vite.config.ts` de la app

```typescript
export default defineConfig({
  base: '/apps/{id}/',   // ← obligatorio para que los assets carguen desde el gateway
  server: { port: {puerto-frontend} },
})
```

---

## Checklist final

- [ ] `src/registry/apps.ts` → objeto en `APP_REGISTRY`
- [ ] `portal_server.py` → entrada en `APPS` dict
- [ ] `src/App.tsx` → origen en `ALLOWED_APP_ORIGINS`
- [ ] `src/__tests__/registry.test.ts` → invariante
- [ ] App: `IN_PORTAL` + postMessage implementado
- [ ] App: header propio oculto cuando `IN_PORTAL === true`
- [ ] App: `vite.config.ts` con `base: '/apps/{id}/'`
- [ ] App: backend expone `GET /api/health`
- [ ] App: CORS acepta `PORTAL_ORIGIN` (env var)
- [ ] App: `frontend/.env.example` con `VITE_PORTAL_URL=http://localhost:5174`
- [ ] `.gitignore` con `node_modules/`, `dist/`, `.env`
- [ ] `npm run test` → 141/141 ✅ (o nuevo total)

---

## Verificación rápida post-integración

```powershell
# 1. Tests del portal
npm run test:run

# 2. Gateway arranca la app
python portal_server.py
# → abrir http://localhost:5174/apps/{id}/

# 3. postMessage funciona
# → Botón Salir vuelve al Dashboard
```
