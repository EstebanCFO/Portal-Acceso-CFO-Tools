# Convenciones de API y Comunicación — CFOTech Portal de Acceso

---

## Gateway — Routing

Todas las requests pasan por `portal_server.py` en `:5174`.

| Ruta | Dev (local) | Prod (local/Azure) |
|------|-------------|-------------------|
| `/` | Proxy → Vite :5175 | Sirve `dist/index.html` |
| `/apps/{id}/*` | Proxy → Vite dev de la app | Sirve `dist/` de la app |
| `/api/{id}/*` | Proxy → backend localhost | Proxy → Container App (Azure) |
| `/api/sound-catch/*` | Router FastAPI inline | Router FastAPI inline |
| `/api/health` | Health check gateway | Health check gateway |

**Nunca** exponer los puertos de backend directamente al browser — todo pasa por el gateway.

---

## Protocolo postMessage (portal ↔ apps)

```typescript
// App embebida → Portal (salir / volver al Dashboard):
window.parent.postMessage({ type: 'portal:goHome', appId: 'mi-app' }, VITE_PORTAL_URL)

// Portal escucha en App.tsx:
window.addEventListener('message', (event) => {
  if (!ALLOWED_APP_ORIGINS.includes(event.origin)) return
  if (event.data?.type === 'portal:goHome') setActiveApp(null)
})
```

### Detección de iframe (en cada app)

```typescript
// Evaluar UNA VEZ a nivel módulo (no en render):
const IN_PORTAL = window.self !== window.top

// Si IN_PORTAL === true:
// - Ocultar header propio
// - Botón "Salir" → postMessage (no window.close())
```

---

## CORS

### `ALLOWED_APP_ORIGINS` en `App.tsx`

Cada app nueva agrega su origen dev aquí:
```typescript
const ALLOWED_APP_ORIGINS = [
  `http://${_H}:5001`,  // reporte-devops
  `http://${_H}:5003`,  // job-matcher
  `http://${_H}:5173`,  // bandas-salariales
  `http://${_H}:5176`,  // survey
  `http://${_H}:5009`,  // audio-a-texto
  `http://${_H}:5011`,  // proyectos-activos
]
```

### En backends

CORS configurado para aceptar `PORTAL_ORIGIN` (env var):
```python
# FastAPI
app.add_middleware(CORSMiddleware, allow_origins=[os.getenv('PORTAL_ORIGIN', 'http://localhost:5174')])

# Flask
CORS(app, origins=[os.environ.get('PORTAL_ORIGIN', 'http://localhost:5174')])
```

---

## Variables de entorno

### Reglas

- **Frontend Vite:** `VITE_` prefix requerido para que sean accesibles en el browser.
- **No commitear `.env`:** siempre tener `.env.example` con plantilla pública.
- **`||` para env vars** (ver `code-style.md`).

### Variables estándar por app frontend

| Variable | Descripción | Default en código |
|----------|-------------|-------------------|
| `VITE_PORTAL_URL` | Destino del postMessage al salir | `http://localhost:5174` |
| `VITE_API_URL` | Prefijo de la API del backend | ver app |
| `VITE_HOST` | Host sin protocolo (portal shell) | `localhost` |

---

## Health checks

Cada backend debe exponer `GET /api/health` que devuelva `200 { ok: true }`.

El gateway lo usa para verificar que los backends están listos antes de arrancar el frontend.

```python
@app.get('/api/health')
def health():
    return { 'ok': True, 'service': 'nombre-del-servicio' }
```

---

## Agregar una app nueva — checklist de API

- [ ] Backend expone `GET /api/health`
- [ ] Entrada en `APPS` dict de `portal_server.py`
- [ ] Origen en `ALLOWED_APP_ORIGINS` de `App.tsx`
- [ ] CORS del backend acepta `PORTAL_ORIGIN`
- [ ] `vite.config.ts` con `base: '/apps/{id}/'`
- [ ] `frontend/.env.example` con `VITE_PORTAL_URL=http://localhost:5174`
