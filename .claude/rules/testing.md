# Convenciones de Testing — CFOTech Portal de Acceso

---

## Stack

| Capa | Herramienta | Versión | Motivo |
|------|-------------|---------|--------|
| Frontend (React) | **Vitest 4.x** + RTL | 4.1.8+ | `@vitejs/plugin-react v6` es ESM-only — Vitest 2.x falla con `require()` |
| Coverage | `@vitest/coverage-v8` | — | Requerido por Vite 8 + plugin-react v6 |
| Backend Flask | `pytest` + `pytest-mock` + `responses` | — | Mock de llamadas HTTP a Azure |
| Backend FastAPI | `pytest` + `httpx` | — | Test client async |

> ⚠️ **No bajar a Vitest 2.x.** La incompatibilidad con ESM fue detectada y corregida — esta versión es la correcta.

---

## Comandos por app

```powershell
# Portal shell
npm run test:run      # CI (una pasada)
npm run test          # watch (desarrollo)
npm run coverage      # con reporte

# Reporte DevOps (backend)
cd REPORTE_DEV_OPS\backend
python -m pytest tests/ -v --tb=short

# Todas las suites
.\RUN_TESTS.bat
```

---

## Conteo de tests (referencia)

| Suite | Tests | Archivo principal |
|-------|-------|-------------------|
| Portal shell | 141 | `src/__tests__/` |
| Bandas Salariales | 96 | `bandas-frontend/src/__tests__/` |
| Job Matcher | 84 | `frontend/src/__tests__/` |
| Proyectos Activos | 31 | `frontend/src/__tests__/` |
| Reporte DevOps | 42 | `frontend/src/__tests__/` + `backend/tests/` |
| Audio a Texto | 11 | `web/frontend/src/__tests__/` |

---

## Convenciones

- **Naming:** descripciones en español — legible para no-técnicos.
  ```typescript
  it('muestra spinner mientras carga', ...)
  it('no llama onSelectApp si la app está disabled', ...)
  ```
- **AAA:** Arrange / Act / Assert separados con línea en blanco en tests complejos.
- **Mocking:** mockear SIEMPRE las llamadas externas (Azure API, `subprocess`, `fetch`).
- **No tests en prod:** `requirements-test.txt` separado de `requirements.txt`.
- **Reset de estado:** fixture con `autouse=True` en tests de Flask que usan estado global.

## Pirámide de testing

```
        ┌──────────────┐
        │   E2E (*)    │  ← Playwright — flujos completos (infraestructura futura)
        ├──────────────┤
        │  Integración │  ← pytest + Flask test client / Vitest + RTL compuestos
        ├──────────────┤
        │  Unitarios   │  ← Vitest (registro, lógica pura) / pytest (procesamiento)
        └──────────────┘
```

(*) E2E documentados en `TEST_STRATEGY.md` — implementar con Playwright cuando haya CI/CD.

## Regla: agregar invariante por cada app nueva

Cada app agregada al `APP_REGISTRY` requiere un test en `registry.test.ts`:
```typescript
it('proyectos-activos está activa en puerto 5011', () => {
  const app = getApp('proyectos-activos')
  expect(app?.status).toBe('active')
  expect(app?.url).toContain('proyectos-activos')
})
```
