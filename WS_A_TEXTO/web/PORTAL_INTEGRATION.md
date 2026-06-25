# Integración en el Portal de Acceso CFOTech

> **Estado:** Integración ya aplicada. Este documento refleja la configuración actual.

---

## Configuración actual en el portal

### `src/registry/apps.ts`

```typescript
{
  id:          'sound-catch',          // ID estable — URL del gateway no cambia
  name:        'WA a Texto',
  description: 'Transcripcion de audio multi-formato con IA — WAV, OGG, MP3 y mas',
  icon:        '🎙',
  url:         '/apps/sound-catch/',   // gateway same-origin
  type:        'iframe',
  iconBg:      '#E6FAF5',
  iconColor:   '#00A878',
  tags:        ['Audio', 'IA', 'Transcripcion', 'WhatsApp'],
  status:      'active',
  category:    '',                     // sin categoría
  startCmd:    'WS_A_TEXTO\\web\\frontend',
},
```

### `src/App.tsx` — `ALLOWED_APP_ORIGINS`

```typescript
`http://${_H}:5009`,   // WS_A_TEXTO frontend (Vite dev)
```

### `portal_server.py` — APPS dict

```python
'sound-catch': {
    # Backend: router FastAPI montado inline (sin subprocess ni puerto extra)
    'backend_inline':  True,
    'frontend_cmd':    'npm run dev',
    'frontend_dir':    BASE_DIR / 'WS_A_TEXTO' / 'web' / 'frontend',
    'frontend_port':   5009,
    'frontend_dist':   BASE_DIR / 'WS_A_TEXTO' / 'web' / 'frontend' / 'dist',
},
```

> El backend (router.py) se importa inline en el gateway:
> ```python
> sys.path.insert(0, str(BASE_DIR / 'WS_A_TEXTO'))
> from sound_catch.web.backend.router import router as _sc_router
> app.include_router(_sc_router, prefix='/api/sound-catch/api')
> ```

### `src/__tests__/registry.test.ts`

```typescript
it('wa-a-texto (sound-catch) existe, name es WA a Texto y category puede ser vacío', () => {
  const app = APP_REGISTRY.find(a => a.id === 'sound-catch')
  expect(app).toBeDefined()
  expect(app?.name).toBe('WA a Texto')
  expect(app?.url).toBe('/apps/sound-catch/')
  expect(app?.category).toBe('')
})
```

---

## Historial de cambios

| Fecha | Cambio |
|-------|--------|
| 2026-06-19 | Integración inicial: Sound Catch. Backend inline, frontend Vite :5009. URL `http://${_H}:5009`. |
| 2026-06-25 | Carpeta renombrada de `Sound Catch` (repo separado, `APPS_ROOT`) → `WS_A_TEXTO` (dentro del portal, `BASE_DIR`). |
| 2026-06-25 | Nombre en registry: `'Sound Catch'` → `'WS a Texto'` → `'WA a Texto'`. `category: 'Productividad'` → `''`. Tags: añadido `'WhatsApp'`. |
| 2026-06-25 | URL cambiada a gateway same-origin: `http://${_H}:5009` → `'/apps/sound-catch/'`. |
| 2026-06-25 | Header.tsx: `IN_PORTAL=true` → `return null` (el portal provee "← Volver"). |
