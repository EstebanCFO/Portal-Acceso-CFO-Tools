# Integración en el Portal de Acceso CFOTech

Para registrar Sound Catch en el portal, aplicar los 4 cambios siguientes.

---

## 1 — `src/registry/apps.ts`

Agregar al array `APP_REGISTRY`:

```typescript
{
  id:          'sound-catch',
  name:        'Sound Catch',
  description: 'Transcripcion de audio multi-formato con IA — WAV, OGG, MP3 y mas',
  icon:        '🎙',
  url:         `http://${_H}:5009`,
  type:        'iframe',
  iconBg:      '#E6FAF5',
  iconColor:   '#00A878',
  tags:        ['Audio', 'IA', 'Transcripcion'],
  status:      'active',
  category:    'Productividad',
  startCmd:    'Sound Catch\\START.bat',
},
```

---

## 2 — `src/App.tsx` — `ALLOWED_APP_ORIGINS`

Agregar el origen del frontend de Sound Catch:

```typescript
`http://${_H}:5009`,   // Sound Catch
```

---

## 3 — `portal-launcher/launcher.py` — `APP_CONFIGS`

```python
'sound-catch': {
    'backend':  {
        'dir':     'Sound Catch\\web\\backend',
        'cmd':     'python app.py',
        'health':  'http://localhost:5008/api/health',
        'timeout': 20,
    },
    'frontend': {
        'dir':     'Sound Catch\\web\\frontend',
        'cmd':     'npm run dev',
        'url':     'http://localhost:5009',
        'timeout': 30,
    },
},
```

> El launcher instalará dependencias (`npm install`) automaticamente si falta `node_modules`.

---

## 4 — `src/__tests__/registry.test.ts`

Agregar invariante:

```typescript
it('sound-catch tiene url, icon y category definidos', () => {
  const app = APP_REGISTRY.find(a => a.id === 'sound-catch')
  expect(app).toBeDefined()
  expect(app?.url).toMatch(/:\d+$/)
  expect(app?.icon).toBeTruthy()
  expect(app?.category).toBe('Productividad')
})
```
