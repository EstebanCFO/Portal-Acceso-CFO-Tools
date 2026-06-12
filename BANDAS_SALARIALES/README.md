# Bandas Salariales DC — Base de Datos Local

Base de datos SQLite con historial de snapshots mensuales de bandas salariales.
Cada vez que se carga un nuevo Excel, los datos se **agregan** (no reemplazan)
identificados con la fecha **AÑO-MES-DIA** de la carga.

---

## Estructura de archivos

```
Bandas Salariales\
├── db\
│   └── bandas_salariales.db    ← base de datos SQLite (se crea al primer import)
├── scripts\
│   ├── init_db.py              ← crea el schema (idempotente)
│   ├── import_excel.py         ← importa un Excel a la BD
│   └── requirements.txt        ← dependencias Python
├── README.md                   ← este archivo
└── Bandas Salariales *.xlsx    ← archivos fuente
```

---

## Instalación (primera vez)

```powershell
# Instalar dependencia
pip install openpyxl

# Inicializar la base de datos (opcional, import_excel.py lo hace solo)
python scripts/init_db.py
```

---

## Importar un Excel

```powershell
# Desde la carpeta "Bandas Salariales":
python scripts/import_excel.py "Bandas Salariales Junio 2026 - DC.xlsx"
```

El período (ej. `2026-06`) se extrae automáticamente del nombre del archivo.
La fecha de carga es la del sistema (`date.today()`).

### Opciones avanzadas

```powershell
# Indicar período manualmente
python scripts/import_excel.py "archivo.xlsx" --periodo 2026-07

# Indicar fecha de carga manualmente
python scripts/import_excel.py "archivo.xlsx" --fecha 2026-07-01

# Forzar re-importación (si ya se importó ese archivo hoy)
python scripts/import_excel.py "archivo.xlsx" --forzar
```

---

## Tablas de la base de datos

### `importaciones`
Registro de cada carga realizada.

| Campo          | Tipo    | Descripción                         |
|---------------|---------|-------------------------------------|
| id            | INTEGER | PK autoincremental                  |
| periodo       | TEXT    | `2026-06`                           |
| anio          | INTEGER | `2026`                              |
| mes           | INTEGER | `6`                                 |
| dia           | INTEGER | día del sistema al momento de cargar|
| fecha_carga   | TEXT    | `2026-06-09` (YYYY-MM-DD)           |
| archivo_fuente| TEXT    | nombre del archivo Excel            |
| total_registros| INTEGER| cantidad de empleados importados    |

### `bandas_salariales`
Snapshot completo de empleados. Una fila por empleado por import.

| Campo         | Tipo | Descripción                         |
|--------------|------|-------------------------------------|
| import_id    | FK   | → importaciones.id                  |
| cuil         | TEXT | ID único del empleado               |
| dni          | TEXT |                                     |
| apellidos    | TEXT |                                     |
| nombres      | TEXT |                                     |
| ceco         | TEXT | Centro de costo                     |
| fecha_ingreso| TEXT | Fecha de ingreso                    |
| perfil       | TEXT | Rol técnico                         |
| seniority    | TEXT | JR / SSR / SR                       |
| salario_bruto| REAL |                                     |
| internet     | REAL | Adicional internet                  |
| fact_cash    | REAL | Facturación / Cash                  |
| remuneracion | REAL | Total (bruto + internet + fact_cash)|
| lim_inferior | REAL | Límite inferior de la banda         |
| lim_superior | REAL | Límite superior de la banda         |
| estado_vs_inf| TEXT | OK / REVISAR                        |
| estado_vs_sup| TEXT | OK / REVISAR                        |
| var_monto    | TEXT | EN BANDA / monto numérico           |
| var_pct      | TEXT | EN BANDA / porcentaje               |
| gerencia     | TEXT | Área de gerencia                    |

---

## Vistas disponibles

```sql
-- Última carga (período más reciente)
SELECT * FROM v_ultima_carga;

-- Historial completo de todos los empleados ordenado por fecha
SELECT * FROM v_historial_empleado;
```

---

## Consultas útiles

```sql
-- ¿Cuántas cargas hay y cuándo?
SELECT id, periodo, fecha_carga, total_registros FROM importaciones;

-- Evolución salarial de un empleado
SELECT fecha_carga, apellidos, nombres, remuneracion, estado_vs_inf
FROM   v_historial_empleado
WHERE  cuil = '20430817044';

-- Empleados en estado REVISAR en la última carga
SELECT apellidos, nombres, perfil, seniority, remuneracion, lim_inferior, var_pct
FROM   v_ultima_carga
WHERE  estado_vs_inf = 'REVISAR'
ORDER  BY var_pct;

-- Empleados que mejoraron de REVISAR a OK entre la primera y última carga
SELECT a.cuil, a.apellidos, a.nombres,
       a.estado_vs_inf AS estado_anterior,
       b.estado_vs_inf AS estado_nuevo
FROM   bandas_salariales a
JOIN   bandas_salariales b  ON a.cuil = b.cuil
JOIN   importaciones ia     ON a.import_id = ia.id
JOIN   importaciones ib     ON b.import_id = ib.id
WHERE  a.estado_vs_inf = 'REVISAR'
AND    b.estado_vs_inf = 'OK'
AND    ia.id < ib.id;

-- Total de empleados REVISAR por período
SELECT i.periodo, i.fecha_carga,
       COUNT(*) FILTER (WHERE b.estado_vs_inf = 'REVISAR') AS revisar,
       COUNT(*) FILTER (WHERE b.estado_vs_inf = 'OK')      AS ok,
       COUNT(*)                                              AS total
FROM   bandas_salariales b
JOIN   importaciones i ON b.import_id = i.id
GROUP  BY i.id
ORDER  BY i.fecha_carga;
```

---

## Visor recomendado

**DB Browser for SQLite** — gratuito, interfaz gráfica.
Descarga: https://sqlitebrowser.org/dl/

Abrir el archivo: `db\bandas_salariales.db`
