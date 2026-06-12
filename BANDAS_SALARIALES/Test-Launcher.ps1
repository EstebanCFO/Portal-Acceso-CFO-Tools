# Test-Launcher.ps1 - Bandas Salariales DC
# Verifica archivos, backend (todos los endpoints) y frontend.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File "Test-Launcher.ps1"

$ErrorActionPreference = 'SilentlyContinue'

$ProjectRoot  = "C:\Esteban CFOTech\Bandas Salariales"
$BackendDir   = "$ProjectRoot\BandasSalariales.Web"
$FrontendDir  = "$ProjectRoot\bandas-frontend"
$BatPath      = "$ProjectRoot\Iniciar Bandas Salariales.bat"
$Desktop      = [Environment]::GetFolderPath('Desktop')
$LnkPath      = "$Desktop\Bandas Salariales DC.lnk"
$BackendPort  = 5050
$FrontendPort = 5173
$TimeoutSec   = 45

$pass = 0; $fail = 0; $warn = 0
$log  = [System.Collections.Generic.List[string]]::new()

function Add-Log($icon, $label, $detail = '') {
    $line = "  $icon  $label"
    if ($detail) { $line += "   |   $detail" }
    $script:log.Add($line)
    if     ($icon -eq '[OK]')   { $script:pass++ }
    elseif ($icon -eq '[FAIL]') { $script:fail++ }
    else                        { $script:warn++ }
}

function Wait-Port([int]$Port, [int]$Timeout = $TimeoutSec) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $Timeout) {
        try {
            $tcp = New-Object Net.Sockets.TcpClient
            if ($tcp.ConnectAsync('localhost', $Port).Wait(600)) {
                $tcp.Close(); return $true
            }
        } catch {}
        Start-Sleep -Milliseconds 700
    }
    return $false
}

function Wait-Http([string]$Url, [int]$Timeout = 90) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $Timeout) {
        try {
            $r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { return $true }
        } catch {}
        Start-Sleep -Milliseconds 1000
    }
    return $false
}

function Stop-ByPort([int]$Port) {
    Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}

Write-Host ""
Write-Host "  CFOTech IT Tools - Bandas Salariales DC - Test Suite" -ForegroundColor Cyan
Write-Host "  ======================================================" -ForegroundColor Cyan
Write-Host ""

Stop-ByPort $BackendPort
Stop-ByPort $FrontendPort
Start-Sleep -Milliseconds 600

# -- ARCHIVOS ------------------------------------------------------------------
Write-Host "  [Archivos]" -ForegroundColor DarkGray

if (Test-Path $BatPath) {
    Add-Log '[OK]'   'T01  Launcher .bat existe'         $BatPath
} else {
    Add-Log '[FAIL]' 'T01  Launcher .bat NO encontrado'  $BatPath
}

if (Test-Path $LnkPath) {
    Add-Log '[OK]'   'T02  Acceso directo en Escritorio' $LnkPath
} else {
    Add-Log '[FAIL]' 'T02  Acceso directo NO encontrado' $LnkPath
}

if (Test-Path $LnkPath) {
    $sh  = New-Object -ComObject WScript.Shell
    $lnk = $sh.CreateShortcut($LnkPath)
    if ($lnk.TargetPath -eq $BatPath) {
        Add-Log '[OK]'   'T03  Shortcut target correcto'     $lnk.TargetPath
    } else {
        Add-Log '[FAIL]' 'T03  Shortcut target incorrecto'   "actual: $($lnk.TargetPath)"
    }
    if ($lnk.WorkingDirectory -eq $ProjectRoot) {
        Add-Log '[OK]'   'T04  Shortcut WorkingDirectory OK' $lnk.WorkingDirectory
    } else {
        Add-Log '[WARN]' 'T04  Shortcut WorkingDir difiere'  "actual: $($lnk.WorkingDirectory)"
    }
}

# -- BACKEND -------------------------------------------------------------------
Write-Host ""
Write-Host "  [Backend - ASP.NET Core 8 :$BackendPort]" -ForegroundColor DarkGray
Write-Host "  Iniciando dotnet run (hasta ${TimeoutSec}s)..." -ForegroundColor Yellow

$backProc = Start-Process -FilePath "dotnet" -ArgumentList "run" `
    -WorkingDirectory $BackendDir -PassThru -WindowStyle Minimized

if (Wait-Port $BackendPort) {
    Add-Log '[OK]'   "T05  Backend levanto en :$BackendPort"  "PID $($backProc.Id)"
} else {
    Add-Log '[FAIL]' "T05  Backend NO respondio en ${TimeoutSec}s"
}

# T06 - Health check (sin BD, respuesta inmediata)
try {
    $r    = Invoke-WebRequest "http://localhost:$BackendPort/api/health" -UseBasicParsing
    $json = $r.Content | ConvertFrom-Json
    if ($json.status -eq 'ok') {
        Add-Log '[OK]'   'T06  GET /api/health -> 200  {status:ok}'
    } else {
        Add-Log '[WARN]' 'T06  GET /api/health -> 200 payload inesperado'  $r.Content
    }
} catch {
    Add-Log '[FAIL]' 'T06  GET /api/health -> error'  $_.Exception.Message
}

# T07 - Dashboard KPIs
try {
    $r    = Invoke-WebRequest "http://localhost:$BackendPort/api/dashboard" -UseBasicParsing
    $json = $r.Content | ConvertFrom-Json
    if ($null -ne $json.total) {
        Add-Log '[OK]'   'T07  GET /api/dashboard -> 200'  "total=$($json.total) ok=$($json.ok) revisar=$($json.revisar)"
    } else {
        Add-Log '[WARN]' 'T07  GET /api/dashboard -> 200 sin campo total'  $r.Content.Substring(0,80)
    }
} catch {
    Add-Log '[FAIL]' 'T07  GET /api/dashboard -> error'  $_.Exception.Message
}

# T08 - Snapshots lista
$firstSnapshotId = $null
try {
    $r    = Invoke-WebRequest "http://localhost:$BackendPort/api/snapshots" -UseBasicParsing
    $json = $r.Content | ConvertFrom-Json
    $count = @($json).Count
    if ($count -gt 0) {
        $firstSnapshotId = @($json)[0].id
        Add-Log '[OK]'   'T08  GET /api/snapshots -> 200'  "$count snapshot(s) - ultimo id=$firstSnapshotId"
    } else {
        Add-Log '[WARN]' 'T08  GET /api/snapshots -> 200 pero lista vacia'
    }
} catch {
    Add-Log '[FAIL]' 'T08  GET /api/snapshots -> error'  $_.Exception.Message
}

# T09 - Empleados de un snapshot
if ($firstSnapshotId) {
    try {
        $r     = Invoke-WebRequest "http://localhost:$BackendPort/api/snapshots/$firstSnapshotId/empleados" -UseBasicParsing
        $count = @($r.Content | ConvertFrom-Json).Count
        if ($count -gt 0) {
            Add-Log '[OK]'   "T09  GET /api/snapshots/$firstSnapshotId/empleados -> 200"  "$count empleados"
        } else {
            Add-Log '[WARN]' "T09  GET /api/snapshots/$firstSnapshotId/empleados -> 200 sin empleados"
        }
    } catch {
        Add-Log '[FAIL]' "T09  GET /api/snapshots/$firstSnapshotId/empleados -> error"  $_.Exception.Message
    }
} else {
    Add-Log '[WARN]' 'T09  GET /api/snapshots/{id}/empleados -> omitido (no hay snapshots)'
}

# T10 - Buscar empleados autocomplete
try {
    $r     = Invoke-WebRequest "http://localhost:$BackendPort/api/empleados/buscar?q=a" -UseBasicParsing
    $count = @($r.Content | ConvertFrom-Json).Count
    Add-Log '[OK]'   'T10  GET /api/empleados/buscar?q=a -> 200'  "$count resultado(s)"
} catch {
    Add-Log '[FAIL]' 'T10  GET /api/empleados/buscar -> error'  $_.Exception.Message
}

# T11 - DELETE /api/snapshots/99999 debe devolver 404 (id inexistente)
try {
    $r = Invoke-WebRequest "http://localhost:$BackendPort/api/snapshots/99999" `
         -Method DELETE -UseBasicParsing
    Add-Log '[FAIL]' 'T11  DELETE /api/snapshots/99999 -> esperaba 404, obtuvo 200'
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 404) {
        Add-Log '[OK]'   'T11  DELETE /api/snapshots/99999 -> 404 correcto'
    } else {
        Add-Log '[FAIL]' "T11  DELETE /api/snapshots/99999 -> $code (esperado 404)"
    }
}

# T12 - Ruta inexistente devuelve 404
try {
    $r = Invoke-WebRequest "http://localhost:$BackendPort/api/NO_EXISTE" -UseBasicParsing
    Add-Log '[WARN]' "T12  /api/NO_EXISTE -> $($r.StatusCode) (esperado 404)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 404) {
        Add-Log '[OK]'   'T12  /api/NO_EXISTE -> 404 correcto'
    } else {
        Add-Log '[WARN]' "T12  /api/NO_EXISTE -> $code (esperado 404)"
    }
}

# -- FRONTEND ------------------------------------------------------------------
Write-Host ""
Write-Host "  [Frontend - Vite + React :$FrontendPort]" -ForegroundColor DarkGray
$FrontendTimeout = 90
Write-Host "  Iniciando npm run dev (hasta ${FrontendTimeout}s)..." -ForegroundColor Yellow

$frontProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" `
    -WorkingDirectory $FrontendDir -PassThru -WindowStyle Minimized

if (Wait-Http "http://localhost:$FrontendPort" $FrontendTimeout) {
    Add-Log '[OK]'   "T13  Frontend levanto en :$FrontendPort"  "PID $($frontProc.Id)"
} else {
    Add-Log '[FAIL]' "T13  Frontend NO respondio en ${FrontendTimeout}s"
}

# T14 - index.html con div#root
try {
    $r = Invoke-WebRequest "http://localhost:$FrontendPort" -UseBasicParsing
    if ($r.Content -match 'id="root"') {
        Add-Log '[OK]'   'T14  Frontend sirve index.html con div#root'  "$($r.Content.Length) bytes"
    } elseif ($r.Content -match '(?i)<!doctype html') {
        Add-Log '[WARN]' 'T14  Frontend sirve HTML pero sin div#root'   "$($r.Content.Length) bytes"
    } else {
        Add-Log '[FAIL]' 'T14  Frontend no devolvio HTML valido'        "status $($r.StatusCode)"
    }
} catch {
    Add-Log '[FAIL]' "T14  GET localhost:$FrontendPort -> error"  $_.Exception.Message
}

# T15 - Proxy Vite -> /api/health
try {
    $r = Invoke-WebRequest "http://localhost:$FrontendPort/api/health" -UseBasicParsing
    if ($r.StatusCode -eq 200) {
        Add-Log '[OK]'   'T15  Proxy Vite -> /api/health OK'  "200 OK $($r.Content.Length) bytes"
    } else {
        Add-Log '[FAIL]' "T15  Proxy Vite -> /api/health fallo"  "status $($r.StatusCode)"
    }
} catch {
    Add-Log '[FAIL]' 'T15  Proxy Vite -> /api/health -> error'  $_.Exception.Message
}

# T16 - Vite dev runtime accesible
try {
    $html = (Invoke-WebRequest "http://localhost:$FrontendPort" -UseBasicParsing).Content
    if ($html -match '@vite/client|type="module"') {
        $r2 = Invoke-WebRequest "http://localhost:$FrontendPort/@vite/client" -UseBasicParsing
        Add-Log '[OK]'   'T16  Vite dev runtime (@vite/client) accesible'  "$($r2.Content.Length) bytes"
    } else {
        Add-Log '[WARN]' 'T16  No se encontro script de Vite dev en index.html'
    }
} catch {
    Add-Log '[WARN]' 'T16  No se pudo verificar Vite dev runtime'  $_.Exception.Message
}

# -- CLEANUP -------------------------------------------------------------------
Write-Host ""
Write-Host "  Deteniendo procesos de test..." -ForegroundColor Gray
Stop-ByPort $BackendPort
Stop-ByPort $FrontendPort
Start-Sleep -Milliseconds 800
if ($backProc  -and !$backProc.HasExited)  { Stop-Process -Id $backProc.Id  -Force -ErrorAction SilentlyContinue }
if ($frontProc -and !$frontProc.HasExited) { Stop-Process -Id $frontProc.Id -Force -ErrorAction SilentlyContinue }

# -- REPORTE -------------------------------------------------------------------
$total = $pass + $fail + $warn
Write-Host ""
Write-Host "  ======================================================" -ForegroundColor DarkGray
Write-Host "  Resultados ($total tests)" -ForegroundColor Cyan
Write-Host "  ======================================================" -ForegroundColor DarkGray

foreach ($line in $log) {
    if     ($line -match '\[OK\]')   { Write-Host $line -ForegroundColor Green  }
    elseif ($line -match '\[FAIL\]') { Write-Host $line -ForegroundColor Red    }
    else                             { Write-Host $line -ForegroundColor Yellow }
}

Write-Host ""
if ($fail -eq 0) {
    Write-Host "  PASS  $pass/$total tests pasaron" -ForegroundColor Green
} else {
    Write-Host "  FAIL  $pass/$total pasaron, $fail fallaron" -ForegroundColor Red
}
if ($warn -gt 0) {
    Write-Host "  WARN  $warn advertencias" -ForegroundColor Yellow
}
Write-Host ""
