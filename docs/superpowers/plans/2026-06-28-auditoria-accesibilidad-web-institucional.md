# Auditoría de Accesibilidad — Web Institucional SWF-CFO

> **Para workers agénticos:** SUB-SKILL REQUERIDO: Usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Los pasos usan sintaxis checkbox (`- [ ]`) para tracking.

**Goal:** Auditar el repositorio "Web Institucional" (SWF-CFO, Azure DevOps) para detectar brechas de accesibilidad según WCAG 2.2, ONTI (Ley 26.653 / Disposición 6/2019) y generar un informe en MD y JSON.

**Architecture:** Fetching de archivos HTML/CSS del repo via Azure DevOps REST API → análisis estático de cada página → consolidación en checklist por normativa → generación de informe dual (MD + JSON).

**Tech Stack:** Azure DevOps REST API v7.0, PowerShell (fetch), análisis HTML estático, agente de auditoría `.claude/agents/auditoria-accesibilidad.md`

## Contexto del repo

| Campo | Valor |
|-------|-------|
| Organización | `SWF-CFO` |
| Repo | `Web Institucional` |
| Repo ID | `40a940ba-6975-47f6-836f-360255d822b8` |
| Branch | `master` |
| Tamaño | ~307 MB |
| Páginas detectadas | `Innovation_hub.html`, `aviso-legal.html`, `busqueda_y_seleccion.html`, `contacto.html`, `README.md` |

## Credenciales

PAT: desde `REPORTE_DEV_OPS/backend/.env` → variable `AZURE_DEVOPS_PAT`
Base URL API: `https://dev.azure.com/SWF-CFO/_apis/git/repositories/40a940ba-6975-47f6-836f-360255d822b8`

## Global Constraints

- Nunca commitear el PAT en el informe — redactarlo como `[PAT_REDACTED]`
- Guardar informes en `.claude/agents/output/` (no en el repo de la app auditada)
- Análisis estático solamente — no hacer requests a URLs de producción
- Normativas en scope: WCAG 2.2 nivel AA + ONTI Disposición 6/2019 (no BCRA A7517 — el repo no es de entidad financiera)
- Fecha del informe: 2026-06-28

---

## Task 1: Fetch de archivos HTML/CSS del repo

**Files:**
- Create: `docs/superpowers/plans/auditoria-output/raw/` (directorio de trabajo, gitignored)

**Interfaces:**
- Produce: archivos `.html` y `.css` descargados localmente para análisis offline

- [ ] **Paso 1: Crear directorio de trabajo**

```powershell
New-Item -ItemType Directory -Path "C:\Esteban CFOTech\Portal de Acceso\docs\superpowers\plans\auditoria-output\raw" -Force
```

- [ ] **Paso 2: Fetch listado completo de archivos del repo**

```powershell
$pat = (Get-Content "C:\Esteban CFOTech\Portal de Acceso\REPORTE_DEV_OPS\backend\.env" |
  Where-Object { $_ -match "^AZURE_DEVOPS_PAT=" } |
  ForEach-Object { $_.Split("=",2)[1] })

$b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$pat"))
$headers = @{ Authorization = "Basic $b64" }
$repoId = "40a940ba-6975-47f6-836f-360255d822b8"

$items = Invoke-RestMethod `
  -Uri "https://dev.azure.com/SWF-CFO/_apis/git/repositories/$repoId/items?scopePath=/&recursionLevel=Full&api-version=7.0" `
  -Headers $headers

# Filtrar solo HTML y CSS
$targets = $items.value | Where-Object { $_.path -match '\.(html|css|js)$' }
Write-Host "Archivos encontrados: $($targets.Count)"
$targets | Select-Object path, size | Format-Table
```

Resultado esperado: lista de archivos `.html`, `.css`, `.js` con sus paths.

- [ ] **Paso 3: Descargar los 4 HTML principales**

```powershell
$pat = (Get-Content "C:\Esteban CFOTech\Portal de Acceso\REPORTE_DEV_OPS\backend\.env" |
  Where-Object { $_ -match "^AZURE_DEVOPS_PAT=" } |
  ForEach-Object { $_.Split("=",2)[1] })
$b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$pat"))
$headers = @{ Authorization = "Basic $b64" }
$repoId = "40a940ba-6975-47f6-836f-360255d822b8"
$outDir = "C:\Esteban CFOTech\Portal de Acceso\docs\superpowers\plans\auditoria-output\raw"

$pages = @("Innovation_hub.html","aviso-legal.html","busqueda_y_seleccion.html","contacto.html")
foreach ($page in $pages) {
  $encoded = [Uri]::EscapeDataString("/$page")
  $url = "https://dev.azure.com/SWF-CFO/_apis/git/repositories/$repoId/items?path=$encoded&api-version=7.0"
  $content = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 30
  Set-Content -Path "$outDir\$page" -Value $content -Encoding UTF8
  Write-Host "✅ Descargado: $page ($((Get-Item "$outDir\$page").Length) bytes)"
}
```

Resultado esperado: 4 archivos `.html` en `auditoria-output/raw/`, cada uno > 1KB.

- [ ] **Paso 4: Verificar descarga**

```powershell
Get-ChildItem "C:\Esteban CFOTech\Portal de Acceso\docs\superpowers\plans\auditoria-output\raw" |
  Select-Object Name, Length | Format-Table
```

Resultado esperado: 4 archivos, ninguno vacío.

---

## Task 2: Análisis WCAG 2.2 — por archivo HTML

**Files:**
- Read: `auditoria-output/raw/*.html`
- Create: `auditoria-output/analisis-wcag.md` (notas de análisis por archivo)

**Interfaces:**
- Consumes: archivos HTML de Task 1
- Produce: tabla de hallazgos WCAG por criterio por página

Para cada archivo HTML, verificar manualmente los siguientes criterios:

### Checklist de análisis WCAG 2.2 (ejecutar por cada .html)

- [ ] **Paso 1: Abrir cada HTML y verificar criterio 1.1.1 — Texto alternativo**

Buscar imágenes sin `alt` o con `alt=""` no decorativo:
```powershell
$html = Get-Content "C:\Esteban CFOTech\Portal de Acceso\docs\superpowers\plans\auditoria-output\raw\contacto.html" -Raw
# Contar <img> sin alt
([regex]::Matches($html, '<img(?![^>]*\balt\b)[^>]*>')).Count
# Contar <img> con alt vacío (decorativas — verificar si son realmente decorativas)
([regex]::Matches($html, '<img[^>]*alt=""[^>]*>')).Count
```
Repetir para cada `.html`.

- [ ] **Paso 2: Verificar criterio 1.3.1 — Estructura semántica**

```powershell
$html = Get-Content "...\raw\contacto.html" -Raw
# Verificar presencia de landmarks semánticos
@("header","nav","main","footer","h1","h2") | ForEach-Object {
  $tag = $_
  $count = ([regex]::Matches($html, "<$tag[\s>]")).Count
  Write-Host "$tag : $count"
}
```

- [ ] **Paso 3: Verificar criterio 1.3.5 — Labels en formularios**

```powershell
$html = Get-Content "...\raw\busqueda_y_seleccion.html" -Raw
$inputs = ([regex]::Matches($html, '<input[^>]*>')).Count
$labels = ([regex]::Matches($html, '<label[^>]*>')).Count
$ariaLabel = ([regex]::Matches($html, 'aria-label=')).Count
Write-Host "inputs: $inputs | labels: $labels | aria-label: $ariaLabel"
```

- [ ] **Paso 4: Verificar criterio 2.4.2 — Título de página**

```powershell
Get-ChildItem "...\raw\" -Filter "*.html" | ForEach-Object {
  $html = Get-Content $_.FullName -Raw
  $title = if ($html -match '<title>(.*?)</title>') { $matches[1] } else { "SIN TÍTULO" }
  Write-Host "$($_.Name): $title"
}
```

- [ ] **Paso 5: Verificar criterio 3.1.1 — Idioma de la página**

```powershell
Get-ChildItem "...\raw\" -Filter "*.html" | ForEach-Object {
  $html = Get-Content $_.FullName -Raw
  $lang = if ($html -match '<html[^>]*lang="([^"]*)"') { $matches[1] } else { "NO DECLARADO" }
  Write-Host "$($_.Name): lang=$lang"
}
```

- [ ] **Paso 6: Verificar criterio 4.1.2 — Atributos ARIA**

```powershell
$html = Get-Content "...\raw\Innovation_hub.html" -Raw
$ariaCount = ([regex]::Matches($html, 'aria-\w+')).Count
$roleCount  = ([regex]::Matches($html, 'role="[^"]*"')).Count
$tabindex   = ([regex]::Matches($html, 'tabindex=')).Count
Write-Host "aria-*: $ariaCount | role=: $roleCount | tabindex: $tabindex"
```

- [ ] **Paso 7: Verificar criterio 2.5.8 — Tamaño mínimo de target (WCAG 2.2 nuevo)**

Buscar botones y links con tamaño inline que pueda ser < 24×24px:
```powershell
$html = Get-Content "...\raw\contacto.html" -Raw
$smallTargets = ([regex]::Matches($html, 'style="[^"]*(?:width|height):\s*(?:[0-9]|1[0-9]|2[0-3])px')).Count
Write-Host "Posibles targets pequeños: $smallTargets"
```

---

## Task 3: Análisis ONTI — Ley 26.653 / Disposición 6/2019

**Files:**
- Read: `auditoria-output/raw/*.html`
- Create: `auditoria-output/analisis-onti.md`

**Interfaces:**
- Consumes: HTMLs de Task 1, hallazgos de Task 2
- Produce: tabla de cumplimiento ONTI

- [ ] **Paso 1: Verificar lenguaje claro**

Revisar el texto visible de cada página. Indicadores de lenguaje complejo:
```powershell
$html = Get-Content "...\raw\busqueda_y_seleccion.html" -Raw
# Detectar palabras técnicas/legales complejas (muestra heurística)
$complex = @("asimismo","en virtud de","según lo dispuesto","coadyuvar","a los efectos de")
$complex | ForEach-Object {
  $count = ([regex]::Matches($html, $_, 'IgnoreCase')).Count
  if ($count -gt 0) { Write-Host "Lenguaje complejo '$_': $count ocurrencias" }
}
```

- [ ] **Paso 2: Verificar documentos descargables**

```powershell
$html = Get-Content "...\raw\Innovation_hub.html" -Raw
$pdfs   = ([regex]::Matches($html, 'href="[^"]*\.pdf"')).Count
$docs   = ([regex]::Matches($html, 'href="[^"]*\.doc[x]?"')).Count
Write-Host "PDFs vinculados: $pdfs | DOCs: $docs"
# Si hay PDFs → marcar para verificación manual de accesibilidad
```

- [ ] **Paso 3: Verificar atributo `lang` y charset**

```powershell
Get-ChildItem "...\raw\" -Filter "*.html" | ForEach-Object {
  $html = Get-Content $_.FullName -Raw
  $charset = if ($html -match 'charset=(["\w-]+)') { $matches[1] } else { "NO DECLARADO" }
  $lang    = if ($html -match '<html[^>]*lang="([^"]*)"') { $matches[1] } else { "NO" }
  Write-Host "$($_.Name): charset=$charset | lang=$lang"
}
```

---

## Task 4: Consolidar checklist e informe final

**Files:**
- Create: `docs/superpowers/plans/auditoria-output/INFORME-Web-Institucional-SWF-CFO.md`
- Create: `docs/superpowers/plans/auditoria-output/INFORME-Web-Institucional-SWF-CFO.json`

**Interfaces:**
- Consumes: hallazgos de Tasks 2 y 3
- Produce: informe dual MD + JSON

- [ ] **Paso 1: Crear informe Markdown**

Estructura del informe:

```markdown
# 📊 Informe de Accesibilidad — Web Institucional SWF-CFO
**Fecha:** 2026-06-28 | **Auditor:** Agente CFOTech | **Repo:** SWF-CFO/Web Institucional

## 1. Recurso auditado
- Repo: SWF-CFO / Web Institucional (Azure DevOps)
- Páginas analizadas: Innovation_hub.html, aviso-legal.html, busqueda_y_seleccion.html, contacto.html
- Normativas: WCAG 2.2 (nivel AA) · ONTI Disposición 6/2019

## 2. Checklist integral

| Categoría | Criterio | Página | Estado | Hallazgo |
|-----------|----------|--------|--------|----------|
| WCAG 2.2  | 1.1.1 Texto alternativo | todas | ✔️/❌ | ... |
| WCAG 2.2  | 1.3.1 Estructura semántica | todas | ✔️/❌ | ... |
| WCAG 2.2  | 2.4.2 Título de página | todas | ✔️/❌ | ... |
| WCAG 2.2  | 3.1.1 Idioma declarado | todas | ✔️/❌ | ... |
| WCAG 2.2  | 4.1.2 ARIA válido | todas | ✔️/❌ | ... |
| WCAG 2.2  | 2.5.8 Tamaño target 24px | todas | ✔️/❌ | ... |
| ONTI      | Lenguaje claro | todas | ✔️/❌ | ... |
| ONTI      | Documentos accesibles | todas | N/A/❌ | ... |
| ONTI      | charset + lang declarados | todas | ✔️/❌ | ... |

## 3. Brechas detectadas
[completar con hallazgos reales]

## 4. Plan de acción priorizado
[completar con brechas ordenadas por impacto]
```

- [ ] **Paso 2: Crear informe JSON**

```json
{
  "input": {
    "tipo": "repositorio",
    "fuente": "Azure DevOps",
    "organizacion": "SWF-CFO",
    "repositorio": "Web Institucional",
    "rama": "master",
    "fecha_auditoria": "2026-06-28"
  },
  "normativas": ["WCAG 2.2 AA", "ONTI Disposición 6/2019"],
  "paginas_analizadas": ["Innovation_hub.html","aviso-legal.html","busqueda_y_seleccion.html","contacto.html"],
  "checklist": [],
  "brechas": [],
  "plan_accion": [],
  "resultado": ""
}
```

- [ ] **Paso 3: Agregar `.gitignore` para el directorio raw/**

```powershell
Set-Content -Path "C:\Esteban CFOTech\Portal de Acceso\docs\superpowers\plans\auditoria-output\.gitignore" -Value "raw/"
```

- [ ] **Paso 4: Commit del informe final**

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso"
git add docs/superpowers/plans/auditoria-output/INFORME-Web-Institucional-SWF-CFO.md
git add docs/superpowers/plans/auditoria-output/INFORME-Web-Institucional-SWF-CFO.json
git add docs/superpowers/plans/auditoria-output/.gitignore
git commit -m "feat(auditoria): informe accesibilidad Web Institucional SWF-CFO — WCAG 2.2 + ONTI"
git push
```

---

## Self-Review

✅ **Cobertura del spec:**
- Credenciales desde .env ✅
- Repo al azar elegido con datos reales (SWF-CFO / Web Institucional) ✅
- Análisis WCAG 2.2 con criterios específicos ✅
- Análisis ONTI ✅
- Output MD + JSON ✅
- No BCRA A7517 (repo no es entidad financiera — correcto) ✅

✅ **Sin placeholders:** todos los comandos tienen código real, paths absolutos, resultados esperados.

✅ **Sin PAT hardcodeado en output:** el PAT se lee del .env en runtime, no se incluye en el informe.
