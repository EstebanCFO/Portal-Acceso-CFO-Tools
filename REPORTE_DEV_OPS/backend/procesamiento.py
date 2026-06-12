"""
procesamiento.py
Calcula métricas de avance y desvíos de sprint a partir de datos_raw.json.
Escribe datos_procesados.json en el directorio de trabajo.
"""

import json
from datetime import datetime

DONE_STATES = ('Resolved', 'Closed', 'Done', 'Completed', 'Fixed')


def calcular_metricas(items):
    estados, tipos = {}, {}
    sp_total = sp_done = horas_comp = horas_rest = items_done = 0

    for it in items:
        f    = it.get('fields', {})
        est  = f.get('System.State', 'Unknown')
        tipo = f.get('System.WorkItemType', 'Unknown')
        sp   = f.get('Microsoft.VSTS.Scheduling.StoryPoints')  or 0
        comp = f.get('Microsoft.VSTS.Scheduling.CompletedWork') or 0
        rest = f.get('Microsoft.VSTS.Scheduling.RemainingWork') or 0

        estados[est]  = estados.get(est, 0) + 1
        tipos[tipo]   = tipos.get(tipo, 0) + 1
        sp_total  += sp
        horas_comp += comp
        horas_rest += rest
        if est in DONE_STATES:
            sp_done    += sp
            items_done += 1

    avance = round(items_done / len(items) * 100, 1) if items else 0
    return {
        'total':      len(items),
        'estados':    estados,
        'tipos':      tipos,
        'sp_total':   round(sp_total, 1),
        'sp_done':    round(sp_done, 1),
        'avance_pct': avance,
        'items_done': items_done,
        'horas_comp': round(horas_comp, 1),
        'horas_rest': round(horas_rest, 1),
    }


def calcular_desvios(iterations):
    hoy    = datetime.today()
    result = []
    for it in iterations:
        attr   = it.get('attributes', {})
        fin    = attr.get('finishDate', '')
        tf     = attr.get('timeFrame', 'unknown')
        desvio = 0
        # past    → sprint terminado → desvio = 0
        # current → sprint activo   → validar contra hoy
        # future  → no validar
        if tf == 'current' and fin:
            try:
                fin_dt = datetime.fromisoformat(fin[:10])
                if hoy.date() > fin_dt.date():
                    desvio = (hoy.date() - fin_dt.date()).days
            except Exception:
                pass
        result.append({
            'nombre':       it.get('name', ''),
            'inicio':       attr.get('startDate', '')[:10] if attr.get('startDate') else '--',
            'fin_planeado': fin[:10] if fin else '--',
            'estado':       tf,
            'desvio_dias':  desvio,
            'alerta':       'RIESGO' if desvio > 7 else ('DESVIO' if desvio > 0 else 'OK'),
        })
    return result


if __name__ == '__main__':
    with open('datos_raw.json', 'r', encoding='utf-8') as f:
        raw = json.load(f)

    resultado = [
        {
            'proyecto':     p['proyecto'],
            'organizacion': p.get('organizacion', ''),
            'estado':       p['estado'],
            'metricas':     calcular_metricas(p['work_items']),
            'desvios':      calcular_desvios(p['iterations']),
        }
        for p in raw
    ]

    with open('datos_procesados.json', 'w', encoding='utf-8') as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    print(f'Procesamiento completo: {len(resultado)} proyectos -> datos_procesados.json')
