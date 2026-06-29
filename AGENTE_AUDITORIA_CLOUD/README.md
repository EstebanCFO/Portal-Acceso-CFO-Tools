# Agente de Auditoría de Accesibilidad — CFOTech

App cloud que audita la accesibilidad de sitios web, repositorios o apps locales
según WCAG 2.2, ONTI y BCRA A7517.

## Stack

- **Frontend:** React 19 + Vite + TypeScript (Azure Static Web Apps)
- **Backend:** Azure Functions Python 3.11
- **Storage:** Azure Blob Storage (`audit-reports`)
- **AI:** Claude API (`claude-sonnet-4-6`)
- **Auth:** Microsoft Entra ID (via Azure Static Web Apps)

## Instalación local

### 1. Frontend

```powershell
cd frontend
npm install
cp .env.example .env
npm run dev   # → http://localhost:5020
```

### 2. Backend (Azure Functions)

```powershell
cd api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# Editar local.settings.json con ANTHROPIC_API_KEY y AZURE_STORAGE_CONNECTION_STRING
func start   # requiere Azure Functions Core Tools
```

### 3. Tests

```powershell
# Frontend
cd frontend && npm run test:run

# Backend
cd api && python -m pytest tests/ -v
```

## Deploy a Azure

1. Crear Azure Static Web App y vincular a este repo
2. Crear Azure Storage Account → contenedor `audit-reports`
3. Configurar variables de entorno en Azure:
   - `ANTHROPIC_API_KEY`
   - `AZURE_STORAGE_CONNECTION_STRING`
   - `BLOB_CONTAINER_NAME=audit-reports`
   - `AAD_CLIENT_ID` + `AAD_CLIENT_SECRET` (app registration en Entra ID)
4. Push a `main` → GitHub Actions despliega automáticamente

## Accesibilidad

Esta app cumple WCAG 2.2 nivel AA:
- Skip link visible al Tab
- Todos los inputs con `<label>` explícito
- Contraste 4.5:1 mínimo (DS CFOTech: navy `#0A1F44` sobre blanco = 15:1)
- Focus visible en todos los interactivos (`outline: 2px solid #4FD1B2`)
- `aria-live="polite"` en resultados, `role="alert"` en errores
- Landmark `<main id="main">` + `<header role="banner">`
- `aria-invalid` + `aria-describedby` en campos con error
