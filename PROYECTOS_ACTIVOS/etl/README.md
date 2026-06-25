# ETL — Proyectos Activos CFOTech

Ingesta del Excel `Proyectos Activos 2026.xlsx` hacia PostgreSQL.

## Requisitos

```powershell
pip install pandas openpyxl psycopg2-binary python-dotenv
```

## Uso

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\PROYECTOS_ACTIVOS\etl"

# 1. Dry run (sin tocar la DB — solo verifica parseo)
python ingest.py --dry-run

# 2. Con archivo explícito
python ingest.py --file "..\Proyectos Activos 2026.xlsx" --dry-run

# 3. Ingesta real
python ingest.py --file "..\Proyectos Activos 2026.xlsx"
```

## Lógica de negocio (Regla de Ingesta)

```
SEMAFORO GENERAL
  → para cada fila de proyecto
      → buscar solapa "[nombre] REAL"
      → parsear empleados + financiero + historial
      → upsert en DB
```

## Parsers disponibles

| Módulo | Solapa origen | Tablas destino |
|--------|--------------|----------------|
| `parsers/semaforo.py` | SEMAFORO GENERAL | `semaforo_monthly_metrics` |
| `parsers/proyecto_real.py` | `[NOMBRE] REAL` | `clients`, `projects`, `employees`, `resource_monthly_costs`, `project_financials`, `project_monthly_history` |

## Prerequisito: base de datos

```powershell
# Crear la DB (solo la primera vez)
psql -U postgres -c "CREATE DATABASE proyectos_activos;"

# Aplicar el schema
psql -U postgres -d proyectos_activos -f "..\schema.sql"
```

## Variables de entorno

El ETL lee `DATABASE_URL` desde `../backend/.env`:

```
DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/proyectos_activos
```
