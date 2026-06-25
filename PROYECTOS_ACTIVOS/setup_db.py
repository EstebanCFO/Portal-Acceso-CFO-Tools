"""
setup_db.py — Crea la base de datos y aplica el schema.

Uso (una sola vez, después de instalar PostgreSQL):
    python setup_db.py
    python setup_db.py --password MiPassword123

Requiere que PostgreSQL esté instalado y el servicio corriendo.
"""
import argparse
import subprocess
import sys
import os

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
SCHEMA_SQL = os.path.join(BASE_DIR, 'schema.sql')
ENV_FILE   = os.path.join(BASE_DIR, 'backend', '.env')

def find_psql() -> str:
    """Busca psql.exe en las ubicaciones típicas de instalación."""
    candidates = []
    for ver in ['16', '15', '14', '13']:
        for base in [r'C:\Program Files\PostgreSQL', r'C:\PostgreSQL']:
            p = os.path.join(base, ver, 'bin', 'psql.exe')
            candidates.append(p)
    candidates += ['psql']  # si está en PATH

    for path in candidates:
        try:
            result = subprocess.run([path, '--version'], capture_output=True, timeout=5)
            if result.returncode == 0:
                return path
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    return None


def run_psql(psql: str, password: str, cmd: str, db: str = 'postgres') -> bool:
    env = os.environ.copy()
    env['PGPASSWORD'] = password
    result = subprocess.run(
        [psql, '-U', 'postgres', '-d', db, '-c', cmd],
        capture_output=True, text=True, env=env
    )
    if result.returncode != 0 and 'already exists' not in result.stderr:
        print(f'  Error: {result.stderr.strip()}')
        return False
    return True


def run_psql_file(psql: str, password: str, db: str, sql_file: str) -> bool:
    env = os.environ.copy()
    env['PGPASSWORD'] = password
    result = subprocess.run(
        [psql, '-U', 'postgres', '-d', db, '-f', sql_file],
        capture_output=True, text=True, env=env
    )
    if result.returncode != 0:
        print(f'  Error aplicando schema:\n{result.stderr}')
        return False
    return True


def write_env(password: str, port: int = 5010):
    content = f"""# Backend Proyectos Activos — generado por setup_db.py
DATABASE_URL=postgresql://postgres:{password}@localhost:5432/proyectos_activos
PORT={port}
CORS_ORIGINS=http://localhost:5011,http://localhost:5174
"""
    with open(ENV_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  .env escrito en: {ENV_FILE}')


def main():
    parser = argparse.ArgumentParser(description='Setup inicial de PostgreSQL para Proyectos Activos')
    parser.add_argument('--password', '-p', default='postgres',
                        help='Contraseña del usuario postgres (default: postgres)')
    parser.add_argument('--port', type=int, default=5010,
                        help='Puerto del backend FastAPI (default: 5010)')
    args = parser.parse_args()

    pw   = args.password
    port = args.port

    print('\n=== Setup Proyectos Activos — Base de Datos ===\n')

    # 1. Encontrar psql
    print('[1/4] Buscando psql...')
    psql = find_psql()
    if not psql:
        print('\n❌ psql no encontrado.')
        print('   Instalá PostgreSQL 16 con:')
        print('   winget install -e --id PostgreSQL.PostgreSQL.16')
        print('   Luego volvé a correr este script.')
        sys.exit(1)
    print(f'  psql encontrado: {psql}')

    # 2. Crear la base de datos
    print('\n[2/4] Creando base de datos...')
    ok = run_psql(psql, pw, 'CREATE DATABASE proyectos_activos;')
    if ok:
        print('  ✅ Base de datos "proyectos_activos" lista.')
    else:
        print('  ⚠  Puede que ya exista — continuando.')

    # 3. Aplicar schema
    print('\n[3/4] Aplicando schema.sql...')
    if not os.path.exists(SCHEMA_SQL):
        print(f'  ❌ No se encontró schema.sql en {SCHEMA_SQL}')
        sys.exit(1)
    ok = run_psql_file(psql, pw, 'proyectos_activos', SCHEMA_SQL)
    if ok:
        print('  ✅ Schema aplicado (tablas, índices, vistas, datos de referencia).')
    else:
        print('  ❌ Error al aplicar schema. Ver errores arriba.')
        sys.exit(1)

    # 4. Escribir .env del backend
    print('\n[4/4] Escribiendo backend/.env...')
    write_env(pw, port)

    print('\n✅ Setup completado.\n')
    print('Próximos pasos:')
    print(f'  1. Cargar datos del Excel:')
    print(f'     cd PROYECTOS_ACTIVOS\\etl')
    print(f'     python ingest.py --file "..\\Proyectos Activos 2026.xlsx"')
    print(f'  2. Levantar el backend:')
    print(f'     cd PROYECTOS_ACTIVOS\\backend')
    print(f'     python app.py')
    print(f'  3. Verificar: http://localhost:{port}/docs\n')


if __name__ == '__main__':
    main()
