"""
analizar_logs.py
Analiza los archivos Trace_*.log del backend y genera un reporte de:
  - Resumen ejecutivo (total requests, errores, warnings)
  - Errores con frecuencia y contexto
  - Calls a Azure DevOps API (OK vs. fallidos)
  - Historial de generaciones de informe
  - Top endpoints más usados
  - Línea de tiempo del último log

Uso:
    python analizar_logs.py                  # analiza todos los logs
    python analizar_logs.py --ultimo         # solo el log más reciente
    python analizar_logs.py --html           # también guarda un reporte HTML
    python analizar_logs.py logs/Trace_*.log # archivos específicos
"""

import os
import re
import sys
import json
import argparse
from datetime import datetime
from collections import defaultdict, Counter
from pathlib import Path

# ── Configuración ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR  = os.path.join(BASE_DIR, 'logs')

# Patrones de parsing
RE_LINE     = re.compile(
    r'^(?P<ts>\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}) \[(?P<level>\w+)\] (?P<msg>.+)$'
)
RE_REQUEST  = re.compile(r'REQUEST:\s+(?P<method>\w+) (?P<path>\S+) from (?P<ip>.+)')
RE_RESPONSE = re.compile(r'RESPONSE:\s+(?P<status>\d{3}) (?P<method>\w+) (?P<path>\S+)')
RE_AZ_OK    = re.compile(r'AZ (?:GET|POST) (?P<url>\S+) -> (?P<status>\d{3})')
RE_AZ_ERR   = re.compile(r'AZ (?:GET|POST) ERROR (?P<url>\S+): (?P<error>.+)')
RE_SCRIPT   = re.compile(r'--- (?P<script>\w+\.py) ---')
RE_STDOUT   = re.compile(r'\[stdout\] (?P<line>.+)')
RE_STDERR   = re.compile(r'\[stderr\] (?P<line>.+)')
RE_INICIO   = re.compile(r'INICIO generacion')
RE_FIN      = re.compile(r'FIN generacion')
RE_PDF      = re.compile(r'PDF generado: .+[\\/](?P<nombre>[^\\/]+\.pdf)')


# ── Colores ANSI ──────────────────────────────────────────────────────────────
class C:
    RESET  = '\033[0m'
    BOLD   = '\033[1m'
    RED    = '\033[91m'
    YELLOW = '\033[93m'
    GREEN  = '\033[92m'
    CYAN   = '\033[96m'
    GRAY   = '\033[90m'
    NAVY   = '\033[34m'


def bold(s):  return f'{C.BOLD}{s}{C.RESET}'
def red(s):   return f'{C.RED}{s}{C.RESET}'
def green(s): return f'{C.GREEN}{s}{C.RESET}'
def yellow(s):return f'{C.YELLOW}{s}{C.RESET}'
def cyan(s):  return f'{C.CYAN}{s}{C.RESET}'
def gray(s):  return f'{C.GRAY}{s}{C.RESET}'


# ── Estructuras de datos ──────────────────────────────────────────────────────
class LogEntry:
    __slots__ = ('ts', 'level', 'msg', 'raw')
    def __init__(self, ts, level, msg, raw=''):
        self.ts    = ts
        self.level = level
        self.msg   = msg
        self.raw   = raw


class LogAnalysis:
    def __init__(self):
        self.total_lines   : int = 0
        self.entries       : list[LogEntry] = []
        self.errors        : list[LogEntry] = []
        self.warnings      : list[LogEntry] = []
        self.requests      : list[dict]     = []
        self.responses     : list[dict]     = []
        self.az_calls      : list[dict]     = []
        self.az_errors     : list[dict]     = []
        self.generaciones  : list[dict]     = []
        self.stderr_lines  : list[str]      = []
        self._gen_current  : dict | None    = None

    def finish(self):
        if self._gen_current:
            self._gen_current['ok'] = False
            self.generaciones.append(self._gen_current)
            self._gen_current = None


# ── Parser ────────────────────────────────────────────────────────────────────
def parse_log_file(path: str) -> LogAnalysis:
    ana = LogAnalysis()
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
    except Exception as e:
        print(red(f'  No se pudo leer {path}: {e}'))
        return ana

    ana.total_lines = len(lines)
    for raw in lines:
        raw = raw.rstrip('\n')
        m = RE_LINE.match(raw)
        if not m:
            continue
        ts_str, level, msg = m.group('ts'), m.group('level'), m.group('msg')
        try:
            ts = datetime.strptime(ts_str, '%d/%m/%Y %H:%M:%S')
        except ValueError:
            ts = datetime.min

        entry = LogEntry(ts, level, msg, raw)
        ana.entries.append(entry)

        if level == 'ERROR':   ana.errors.append(entry)
        if level == 'WARNING': ana.warnings.append(entry)

        # Requests HTTP
        if mr := RE_REQUEST.search(msg):
            ana.requests.append({
                'ts': ts, 'method': mr.group('method'),
                'path': mr.group('path'), 'ip': mr.group('ip'),
            })

        # Responses HTTP
        if mr := RE_RESPONSE.search(msg):
            ana.responses.append({
                'ts': ts, 'status': int(mr.group('status')),
                'method': mr.group('method'), 'path': mr.group('path'),
            })

        # Azure API calls OK
        if mr := RE_AZ_OK.search(msg):
            ana.az_calls.append({
                'ts': ts, 'url': mr.group('url'),
                'status': int(mr.group('status')),
                'ok': int(mr.group('status')) == 200,
            })

        # Azure API errors
        if mr := RE_AZ_ERR.search(msg):
            ana.az_errors.append({'ts': ts, 'url': mr.group('url'), 'error': mr.group('error')})

        # Stderr de scripts
        if mr := RE_STDERR.search(msg):
            ana.stderr_lines.append(mr.group('line'))

        # Generaciones
        if RE_INICIO.search(msg):
            ana._gen_current = {'inicio': ts, 'scripts': [], 'ok': None, 'pdf': None}
        elif RE_FIN.search(msg) and ana._gen_current:
            ana._gen_current['ok'] = True
            ana.generaciones.append(ana._gen_current)
            ana._gen_current = None
        elif RE_SCRIPT.search(msg) and ana._gen_current:
            ana._gen_current['scripts'].append(RE_SCRIPT.search(msg).group('script'))
        elif (mr := RE_PDF.search(msg)) and ana._gen_current:
            ana._gen_current['pdf'] = mr.group('nombre')

    ana.finish()
    return ana


# ── Reportes ──────────────────────────────────────────────────────────────────
def print_separator(char='─', width=70):
    print(gray(char * width))


def print_section(title: str):
    print()
    print(bold(f'  {title}'))
    print_separator()


def report_resumen(anas: dict[str, LogAnalysis]):
    print_section('RESUMEN EJECUTIVO')
    total_req  = sum(len(a.requests)  for a in anas.values())
    total_err  = sum(len(a.errors)    for a in anas.values())
    total_warn = sum(len(a.warnings)  for a in anas.values())
    total_az   = sum(len(a.az_calls)  for a in anas.values())
    az_ok      = sum(sum(1 for c in a.az_calls if c['ok'])  for a in anas.values())
    az_fail    = total_az - az_ok
    total_gen  = sum(len(a.generaciones) for a in anas.values())
    gen_ok     = sum(sum(1 for g in a.generaciones if g['ok']) for a in anas.values())

    print(f'  Archivos analizados   : {bold(len(anas))}')
    print(f'  Requests HTTP         : {bold(total_req)}')
    estado_err = red(str(total_err)) if total_err else green('0')
    print(f'  Errores [ERROR]       : {estado_err}')
    estado_warn = yellow(str(total_warn)) if total_warn else green('0')
    print(f'  Warnings [WARNING]    : {estado_warn}')
    print(f'  Calls Azure DevOps    : {bold(total_az)}  ({green(str(az_ok))} OK / {red(str(az_fail))} fallidos)')
    estado_gen = green(str(gen_ok)) if gen_ok == total_gen else yellow(str(gen_ok))
    print(f'  Generaciones informe  : {bold(total_gen)}  ({estado_gen} exitosas)')


def report_errores(anas: dict[str, LogAnalysis]):
    todos = [(fname, e) for fname, a in anas.items() for e in a.errors]
    if not todos:
        print_section('ERRORES')
        print(f'  {green("✓ Sin errores registrados")}')
        return

    print_section(f'ERRORES ({len(todos)} total)')
    # Agrupar por mensaje (primeras 80 chars)
    grupos = Counter(e.msg[:80] for _, e in todos)
    for msg, cnt in grupos.most_common(10):
        print(f'  {red("●")} [{bold(cnt)}×] {msg}')

    # Mostrar últimos 5 con contexto
    print()
    print(f'  {bold("Últimos errores con contexto:")}')
    for fname, entry in todos[-5:]:
        fn = os.path.basename(fname)
        print(f'  {gray(entry.ts.strftime("%d/%m %H:%M:%S"))} {gray(fn)}')
        print(f'  {red("  " + entry.msg)}')


def report_warnings(anas: dict[str, LogAnalysis]):
    todos = [(fname, e) for fname, a in anas.items() for e in a.warnings]
    if not todos:
        return
    print_section(f'WARNINGS ({len(todos)} total)')
    grupos = Counter(e.msg[:80] for _, e in todos)
    for msg, cnt in grupos.most_common(8):
        print(f'  {yellow("▲")} [{bold(cnt)}×] {msg}')


def report_azure(anas: dict[str, LogAnalysis]):
    todos_err = [(fname, e) for fname, a in anas.items() for e in a.az_errors]
    all_calls  = [c for a in anas.values() for c in a.az_calls]
    if not all_calls and not todos_err:
        return

    print_section('AZURE DEVOPS API')
    # Agrupar por org/endpoint
    endpoints = Counter()
    fails_por_url = Counter()
    for c in all_calls:
        # Extraer org del URL: dev.azure.com/ORG/...
        m = re.search(r'dev\.azure\.com/([^/]+)', c['url'])
        org = m.group(1) if m else 'unknown'
        # Tipo de endpoint
        path = re.sub(r'https?://[^/]+', '', c['url'])
        seg  = path.split('/')
        tipo = seg[3] if len(seg) > 3 else path[:40]
        endpoints[f'{org} → {tipo}'] += 1
        if not c['ok']:
            fails_por_url[c['url'][:60]] += 1

    print(f'  {"Endpoint":<45} {"Calls":>6}')
    print_separator('·', 60)
    for ep, cnt in endpoints.most_common(10):
        print(f'  {ep:<45} {bold(cnt):>6}')

    if fails_por_url:
        print()
        print(f'  {red("URLs con fallos:")}')
        for url, cnt in fails_por_url.most_common(5):
            print(f'  {red("✗")} [{cnt}×] {url}')

    if todos_err:
        print()
        print(f'  {red("Errores de conexión Azure:")}'  )
        for _, e in todos_err[-5:]:
            print(f'  {red("  " + e["error"][:80])}')


def report_generaciones(anas: dict[str, LogAnalysis]):
    todas = [(fname, g) for fname, a in anas.items() for g in a.generaciones]
    if not todas:
        return

    print_section(f'GENERACIONES DE INFORME ({len(todas)} total)')
    for fname, g in todas[-10:]:
        fn     = os.path.basename(fname)
        estado = green('✓ OK') if g['ok'] else red('✗ ERROR')
        ts     = g['inicio'].strftime('%d/%m/%Y %H:%M:%S') if g['inicio'] != datetime.min else '--'
        pdf    = gray(g['pdf']) if g['pdf'] else gray('(sin PDF)')
        print(f'  {estado}  {ts}  {pdf}  {gray(fn)}')

    stderr_todos = [l for a in anas.values() for l in a.stderr_lines]
    if stderr_todos:
        print()
        print(f'  {yellow("Salida stderr de scripts:")}')
        for line in stderr_todos[-10:]:
            print(f'  {yellow("  " + line[:100])}')


def report_endpoints(anas: dict[str, LogAnalysis]):
    all_resp = [r for a in anas.values() for r in a.responses]
    if not all_resp:
        return

    print_section('TOP ENDPOINTS (por cantidad de llamadas)')
    paths = Counter(r['path'] for r in all_resp)
    errs  = Counter(r['path'] for r in all_resp if r['status'] >= 400)
    print(f'  {"Endpoint":<40} {"Calls":>6}  {"4xx/5xx":>7}')
    print_separator('·', 65)
    for path, cnt in paths.most_common(12):
        err_cnt = errs.get(path, 0)
        err_s   = red(str(err_cnt)) if err_cnt else gray('0')
        print(f'  {path:<40} {bold(cnt):>6}  {err_s:>7}')


def report_timeline(fname: str, ana: LogAnalysis, n: int = 20):
    if not ana.entries:
        return
    print_section(f'LÍNEA DE TIEMPO — {os.path.basename(fname)} (últimas {n} entradas)')
    for entry in ana.entries[-n:]:
        ts_s = entry.ts.strftime('%H:%M:%S')
        lvl  = entry.level
        if lvl == 'ERROR':   lvl_s = red(f'[{lvl}]')
        elif lvl == 'WARNING': lvl_s = yellow(f'[{lvl}]')
        elif lvl == 'DEBUG':   lvl_s = gray(f'[{lvl}]')
        else:                  lvl_s = cyan(f'[{lvl}]')
        print(f'  {gray(ts_s)} {lvl_s} {entry.msg[:90]}')


def export_html(anas: dict[str, LogAnalysis], output_path: str):
    """Genera un reporte HTML sencillo."""
    rows = []
    for fname, ana in anas.items():
        fn      = os.path.basename(fname)
        n_err   = len(ana.errors)
        n_warn  = len(ana.warnings)
        n_az    = len(ana.az_calls)
        az_fail = sum(1 for c in ana.az_calls if not c['ok'])
        n_gen   = len(ana.generaciones)
        gen_ok  = sum(1 for g in ana.generaciones if g['ok'])
        rows.append(f'''
        <tr>
          <td>{fn}</td>
          <td>{len(ana.entries)}</td>
          <td class="{'err' if n_err else 'ok'}">{n_err}</td>
          <td class="{'warn' if n_warn else 'ok'}">{n_warn}</td>
          <td>{n_az} ({az_fail} fail)</td>
          <td>{n_gen} ({gen_ok} ok)</td>
        </tr>''')

    html = f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Reporte de Logs — Reporte DevOps CFOTech</title>
<style>
  body {{ font-family: 'Segoe UI', sans-serif; background: #F4F6F9; color: #0D1B2A; margin: 0; }}
  .header {{ background: #0B1526; color: #fff; padding: 16px 24px; border-bottom: 3px solid #1C2E48; }}
  .header h1 {{ margin: 0; font-size: 16px; }}
  .header p  {{ margin: 4px 0 0; font-size: 12px; color: #4FD1B2; }}
  .content {{ padding: 24px; max-width: 1100px; margin: 0 auto; }}
  table {{ width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px;
           overflow: hidden; border: 1px solid #D1D9E6; }}
  th {{ background: #0A1F44; color: #fff; padding: 10px 12px; font-size: 11px;
        text-transform: uppercase; letter-spacing: .5px; text-align: left; }}
  td {{ padding: 9px 12px; font-size: 13px; border-top: 1px solid #E8ECF2; }}
  .ok   {{ color: #00875A; font-weight: 600; }}
  .err  {{ color: #C0392B; font-weight: 600; }}
  .warn {{ color: #C96A00; font-weight: 600; }}
  .ts   {{ color: #4A5568; font-size: 11px; }}
</style>
</head>
<body>
<div class="header">
  <h1>CFOTech IT Tools — Análisis de Logs · Reporte DevOps</h1>
  <p>Generado: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')} · {len(anas)} archivos analizados</p>
</div>
<div class="content">
  <h2 style="font-size:15px;color:#0A1F44">Resumen por archivo</h2>
  <table>
    <thead>
      <tr>
        <th>Archivo</th><th>Líneas</th><th>Errores</th><th>Warnings</th>
        <th>Azure Calls</th><th>Generaciones</th>
      </tr>
    </thead>
    <tbody>{''.join(rows)}</tbody>
  </table>
</div>
</body>
</html>'''
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(green(f'\n  Reporte HTML guardado: {output_path}'))


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description='Analizador de logs — Reporte DevOps CFOTech',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('archivos', nargs='*', help='Archivos de log específicos (opcional)')
    parser.add_argument('--ultimo',  action='store_true', help='Analizar solo el log más reciente')
    parser.add_argument('--html',    action='store_true', help='Exportar reporte HTML')
    parser.add_argument('--timeline',action='store_true', help='Mostrar línea de tiempo del último log')
    args = parser.parse_args()

    # ── Resolver archivos ────────────────────────────────────────────────────
    if args.archivos:
        paths = [p for p in args.archivos if os.path.isfile(p)]
    else:
        if not os.path.isdir(LOG_DIR):
            print(red(f'Directorio de logs no encontrado: {LOG_DIR}'))
            sys.exit(1)
        paths = sorted(
            Path(LOG_DIR).glob('Trace_*.log'),
            key=lambda p: p.stat().st_mtime,
        )
        paths = [str(p) for p in paths]

    if args.ultimo and paths:
        paths = [paths[-1]]

    if not paths:
        print(yellow('No se encontraron archivos de log.'))
        sys.exit(0)

    # ── Banner ───────────────────────────────────────────────────────────────
    print()
    print(bold('  ╔══════════════════════════════════════════════════════╗'))
    print(bold('  ║   CFOTech IT Tools — Analizador de Logs              ║'))
    print(bold('  ╚══════════════════════════════════════════════════════╝'))
    print(f'  Analizando {bold(len(paths))} archivo(s) en {gray(LOG_DIR)}')

    # ── Parsear ──────────────────────────────────────────────────────────────
    anas: dict[str, LogAnalysis] = {}
    for path in paths:
        anas[path] = parse_log_file(path)
        fn = os.path.basename(path)
        n_err = len(anas[path].errors)
        indicator = red('✗') if n_err else green('✓')
        print(f'  {indicator} {fn}  {gray(str(len(anas[path].entries)) + " entradas")}')

    # ── Reportes ─────────────────────────────────────────────────────────────
    report_resumen(anas)
    report_errores(anas)
    report_warnings(anas)
    report_azure(anas)
    report_generaciones(anas)
    report_endpoints(anas)

    if args.timeline and paths:
        ultimo = paths[-1]
        report_timeline(ultimo, anas[ultimo])

    if args.html:
        html_path = os.path.join(LOG_DIR, f'reporte_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.html')
        export_html(anas, html_path)

    print()
    print_separator('═')
    total_err = sum(len(a.errors) for a in anas.values())
    if total_err == 0:
        print(green(f'  ✓ Análisis completado sin errores críticos'))
    else:
        print(red(f'  ✗ Análisis completado — {total_err} error(es) encontrado(s)'))
    print_separator('═')
    print()


if __name__ == '__main__':
    main()
