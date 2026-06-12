using Microsoft.Data.Sqlite;
using BandasSalariales.Web.Models;

namespace BandasSalariales.Web.Services;

/// <summary>
/// Acceso directo a SQLite — sin ORM, vanilla ADO.NET.
/// La BD se crea/mantiene por los scripts Python existentes.
/// </summary>
public class BandasDbService
{
    private readonly string _connStr;

    public BandasDbService(IConfiguration cfg, IWebHostEnvironment env)
    {
        // La BD está un nivel arriba del proyecto .NET: ../db/bandas_salariales.db
        var root    = env.ContentRootPath;
        var dbPath  = cfg["DbPath"]
                      ?? Path.GetFullPath(Path.Combine(root, "..", "db", "bandas_salariales.db"));
        _connStr = $"Data Source={dbPath}";
    }

    private SqliteConnection Open()
    {
        var conn = new SqliteConnection(_connStr);
        conn.Open();
        // Necesario para FULL OUTER JOIN (emulado via UNION en SQLite)
        using var prag = conn.CreateCommand();
        prag.CommandText = "PRAGMA foreign_keys = ON;";
        prag.ExecuteNonQuery();
        return conn;
    }

    // ── Snapshots ────────────────────────────────────────────────────────────

    public bool DeleteSnapshot(int id)
    {
        using var conn = Open();
        using var tx   = conn.BeginTransaction();
        // Borrar primero los empleados (FK) y luego la importación
        using var delBandas = conn.CreateCommand();
        delBandas.Transaction  = tx;
        delBandas.CommandText  = "DELETE FROM bandas_salariales WHERE import_id = $id";
        delBandas.Parameters.AddWithValue("$id", id);
        delBandas.ExecuteNonQuery();

        using var delImport = conn.CreateCommand();
        delImport.Transaction = tx;
        delImport.CommandText = "DELETE FROM importaciones WHERE id = $id";
        delImport.Parameters.AddWithValue("$id", id);
        var rows = delImport.ExecuteNonQuery();

        tx.Commit();
        return rows > 0;   // false si el id no existía
    }

    public List<Importacion> GetSnapshots()
    {
        using var conn = Open();
        using var cmd  = conn.CreateCommand();
        cmd.CommandText = """
            SELECT id, periodo, fecha_carga, total_registros, archivo_fuente
            FROM   importaciones
            ORDER  BY id DESC
            """;
        using var r = cmd.ExecuteReader();
        var list = new List<Importacion>();
        while (r.Read())
            list.Add(new Importacion
            {
                Id             = r.GetInt32(0),
                Periodo        = r.GetString(1),
                FechaCarga     = r.GetString(2),
                TotalRegistros = r.IsDBNull(3) ? 0 : r.GetInt32(3),
                ArchivoFuente  = r.IsDBNull(4) ? "" : r.GetString(4),
            });
        return list;
    }

    // ── Dashboard KPIs ───────────────────────────────────────────────────────

    public DashboardKpis? GetDashboardKpis()
    {
        using var conn = Open();

        // Último snapshot
        using var cmdU = conn.CreateCommand();
        cmdU.CommandText = "SELECT id, periodo, fecha_carga FROM importaciones ORDER BY id DESC LIMIT 1";
        using var rU = cmdU.ExecuteReader();
        if (!rU.Read()) return null;

        int    iid       = rU.GetInt32(0);
        string periodo   = rU.GetString(1);
        string fechaCarga = rU.GetString(2);
        rU.Close();

        using var cmdK = conn.CreateCommand();
        cmdK.CommandText = """
            SELECT
                COUNT(*)                                               AS total,
                COUNT(*) FILTER (WHERE estado_vs_inf = 'OK')          AS ok,
                COUNT(*) FILTER (WHERE estado_vs_inf = 'REVISAR')     AS revisar,
                COUNT(*) FILTER (WHERE estado_vs_inf IS NULL)         AS sin_banda,
                AVG(remuneracion)                                      AS rem_avg,
                MAX(remuneracion)                                      AS rem_max,
                MIN(remuneracion) FILTER (WHERE remuneracion > 0)     AS rem_min
            FROM bandas_salariales
            WHERE import_id = $id
            """;
        cmdK.Parameters.AddWithValue("$id", iid);
        using var rK = cmdK.ExecuteReader();
        if (!rK.Read()) return null;

        int total   = rK.GetInt32(0);
        int ok      = rK.GetInt32(1);
        int revisar = rK.GetInt32(2);
        int sinB    = rK.GetInt32(3);
        double safe = total > 0 ? total : 1;

        return new DashboardKpis
        {
            Periodo    = periodo,
            FechaCarga = fechaCarga,
            Total      = total,
            Ok         = ok,
            Revisar    = revisar,
            SinBanda   = sinB,
            PctOk      = Math.Round(ok      / safe * 100, 1),
            PctRevisar = Math.Round(revisar  / safe * 100, 1),
            PctSin     = Math.Round(sinB     / safe * 100, 1),
            RemAvg     = rK.IsDBNull(4) ? null : rK.GetDouble(4),
            RemMax     = rK.IsDBNull(5) ? null : rK.GetDouble(5),
            RemMin     = rK.IsDBNull(6) ? null : rK.GetDouble(6),
        };
    }

    // ── Tabla empleados por snapshot ─────────────────────────────────────────

    public List<BandaSalarial> GetEmpleadosPorSnapshot(int importId)
    {
        using var conn = Open();
        using var cmd  = conn.CreateCommand();
        cmd.CommandText = """
            SELECT cuil, apellidos, nombres, ceco, perfil, seniority,
                   salario_bruto, internet, fact_cash, remuneracion,
                   lim_inferior, lim_superior,
                   estado_vs_inf, estado_vs_sup, var_monto, var_pct, gerencia
            FROM   bandas_salariales
            WHERE  import_id = $id
            ORDER  BY apellidos
            """;
        cmd.Parameters.AddWithValue("$id", importId);
        using var r = cmd.ExecuteReader();
        var list = new List<BandaSalarial>();
        while (r.Read())
            list.Add(new BandaSalarial
            {
                Cuil         = r.GetString(0),
                Apellidos    = r.IsDBNull(1)  ? null : r.GetString(1),
                Nombres      = r.IsDBNull(2)  ? null : r.GetString(2),
                Ceco         = r.IsDBNull(3)  ? null : r.GetString(3),
                Perfil       = r.IsDBNull(4)  ? null : r.GetString(4),
                Seniority    = r.IsDBNull(5)  ? null : r.GetString(5),
                SalarioBruto = r.IsDBNull(6)  ? null : r.GetDouble(6),
                Internet     = r.IsDBNull(7)  ? null : r.GetDouble(7),
                FactCash     = r.IsDBNull(8)  ? null : r.GetDouble(8),
                Remuneracion = r.IsDBNull(9)  ? null : r.GetDouble(9),
                LimInferior  = r.IsDBNull(10) ? null : r.GetDouble(10),
                LimSuperior  = r.IsDBNull(11) ? null : r.GetDouble(11),
                EstadoVsInf  = r.IsDBNull(12) ? null : r.GetString(12),
                EstadoVsSup  = r.IsDBNull(13) ? null : r.GetString(13),
                VarMonto     = r.IsDBNull(14) ? null : r.GetString(14),
                VarPct       = r.IsDBNull(15) ? null : r.GetString(15),
                Gerencia     = r.IsDBNull(16) ? null : r.GetString(16),
            });
        return list;
    }

    // ── Empleado: detalle + historial ────────────────────────────────────────

    public EmpleadoDetalle? GetEmpleadoDetalle(string cuil)
    {
        using var conn = Open();

        // Datos más recientes
        using var cmdD = conn.CreateCommand();
        cmdD.CommandText = """
            SELECT b.cuil, b.dni, b.apellidos, b.nombres,
                   b.ceco, b.fecha_ingreso, b.perfil, b.seniority
            FROM   bandas_salariales b
            JOIN   importaciones i ON b.import_id = i.id
            WHERE  b.cuil = $cuil
            ORDER  BY i.id DESC LIMIT 1
            """;
        cmdD.Parameters.AddWithValue("$cuil", cuil);
        using var rD = cmdD.ExecuteReader();
        if (!rD.Read()) return null;

        var detalle = new EmpleadoDetalle
        {
            Cuil        = rD.GetString(0),
            Dni         = rD.IsDBNull(1) ? null : rD.GetString(1),
            Apellidos   = rD.IsDBNull(2) ? null : rD.GetString(2),
            Nombres     = rD.IsDBNull(3) ? null : rD.GetString(3),
            Ceco        = rD.IsDBNull(4) ? null : rD.GetString(4),
            FechaIngreso = rD.IsDBNull(5) ? null : rD.GetString(5),
            Perfil      = rD.IsDBNull(6) ? null : rD.GetString(6),
            Seniority   = rD.IsDBNull(7) ? null : rD.GetString(7),
        };
        rD.Close();

        // Historial
        using var cmdH = conn.CreateCommand();
        cmdH.CommandText = """
            SELECT i.fecha_carga, i.periodo,
                   b.perfil, b.seniority, b.ceco,
                   b.remuneracion, b.salario_bruto, b.internet, b.fact_cash,
                   b.lim_inferior, b.lim_superior,
                   b.estado_vs_inf, b.estado_vs_sup, b.var_monto, b.var_pct
            FROM   bandas_salariales b
            JOIN   importaciones i ON b.import_id = i.id
            WHERE  b.cuil = $cuil
            ORDER  BY i.fecha_carga ASC
            """;
        cmdH.Parameters.AddWithValue("$cuil", cuil);
        using var rH = cmdH.ExecuteReader();
        while (rH.Read())
            detalle.Historial.Add(new EmpleadoHistorialRow
            {
                FechaCarga   = rH.IsDBNull(0)  ? null : rH.GetString(0),
                Periodo      = rH.IsDBNull(1)  ? null : rH.GetString(1),
                Perfil       = rH.IsDBNull(2)  ? null : rH.GetString(2),
                Seniority    = rH.IsDBNull(3)  ? null : rH.GetString(3),
                Ceco         = rH.IsDBNull(4)  ? null : rH.GetString(4),
                Remuneracion = rH.IsDBNull(5)  ? null : rH.GetDouble(5),
                SalarioBruto = rH.IsDBNull(6)  ? null : rH.GetDouble(6),
                Internet     = rH.IsDBNull(7)  ? null : rH.GetDouble(7),
                FactCash     = rH.IsDBNull(8)  ? null : rH.GetDouble(8),
                LimInferior  = rH.IsDBNull(9)  ? null : rH.GetDouble(9),
                LimSuperior  = rH.IsDBNull(10) ? null : rH.GetDouble(10),
                EstadoVsInf  = rH.IsDBNull(11) ? null : rH.GetString(11),
                EstadoVsSup  = rH.IsDBNull(12) ? null : rH.GetString(12),
                VarMonto     = rH.IsDBNull(13) ? null : rH.GetString(13),
                VarPct       = rH.IsDBNull(14) ? null : rH.GetString(14),
            });

        return detalle;
    }

    // ── Búsqueda autocomplete ────────────────────────────────────────────────

    public List<EmpleadoBusqueda> BuscarEmpleados(string q)
    {
        using var conn = Open();
        using var cmd  = conn.CreateCommand();
        string like = $"%{q.ToUpperInvariant()}%";
        cmd.CommandText = """
            SELECT DISTINCT b.cuil, b.apellidos, b.nombres, b.perfil, b.seniority
            FROM   bandas_salariales b
            JOIN   importaciones i ON b.import_id = i.id
            WHERE  i.id = (SELECT MAX(id) FROM importaciones)
              AND  (UPPER(b.apellidos) LIKE $q OR UPPER(b.nombres) LIKE $q OR b.cuil LIKE $q)
            ORDER  BY b.apellidos
            LIMIT  10
            """;
        cmd.Parameters.AddWithValue("$q", like);
        using var r = cmd.ExecuteReader();
        var list = new List<EmpleadoBusqueda>();
        while (r.Read())
            list.Add(new EmpleadoBusqueda
            {
                Cuil      = r.GetString(0),
                Apellidos = r.IsDBNull(1) ? null : r.GetString(1),
                Nombres   = r.IsDBNull(2) ? null : r.GetString(2),
                Perfil    = r.IsDBNull(3) ? null : r.GetString(3),
                Seniority = r.IsDBNull(4) ? null : r.GetString(4),
            });
        return list;
    }

    // ── Comparativo entre dos snapshots ─────────────────────────────────────

    public List<ComparativoRow> GetComparativo(int idA, int idB)
    {
        // SQLite soporta FULL OUTER JOIN desde 3.39 (2022).
        // Para máxima compatibilidad, emulamos con UNION.
        using var conn = Open();
        using var cmd  = conn.CreateCommand();
        cmd.CommandText = """
            SELECT
                COALESCE(a.cuil, b.cuil)            AS cuil,
                COALESCE(a.apellidos, b.apellidos)   AS apellidos,
                COALESCE(a.nombres, b.nombres)       AS nombres,
                COALESCE(a.perfil, b.perfil)         AS perfil,
                COALESCE(a.seniority, b.seniority)   AS seniority,
                a.remuneracion                       AS rem_a,
                b.remuneracion                       AS rem_b,
                a.estado_vs_inf                      AS estado_a,
                b.estado_vs_inf                      AS estado_b,
                a.var_pct                            AS var_pct_a,
                b.var_pct                            AS var_pct_b,
                CASE
                    WHEN a.cuil IS NULL THEN 'ingreso'
                    WHEN b.cuil IS NULL THEN 'egreso'
                    ELSE 'continua'
                END AS movimiento
            FROM
                (SELECT * FROM bandas_salariales WHERE import_id = $a) a
                LEFT JOIN
                (SELECT * FROM bandas_salariales WHERE import_id = $b) b
                ON a.cuil = b.cuil

            UNION

            SELECT
                b.cuil,
                b.apellidos, b.nombres, b.perfil, b.seniority,
                NULL, b.remuneracion,
                NULL, b.estado_vs_inf,
                NULL, b.var_pct,
                'ingreso'
            FROM (SELECT * FROM bandas_salariales WHERE import_id = $b) b
            WHERE b.cuil NOT IN (SELECT cuil FROM bandas_salariales WHERE import_id = $a)

            ORDER BY apellidos
            """;
        cmd.Parameters.AddWithValue("$a", idA);
        cmd.Parameters.AddWithValue("$b", idB);

        using var r   = cmd.ExecuteReader();
        var list = new List<ComparativoRow>();
        while (r.Read())
        {
            double? remA = r.IsDBNull(5) ? null : r.GetDouble(5);
            double? remB = r.IsDBNull(6) ? null : r.GetDouble(6);
            double? varP = null;
            if (remA is > 0 && remB.HasValue)
                varP = Math.Round((remB.Value - remA.Value) / remA.Value * 100, 1);

            list.Add(new ComparativoRow
            {
                Cuil         = r.IsDBNull(0)  ? null : r.GetString(0),
                Apellidos    = r.IsDBNull(1)  ? null : r.GetString(1),
                Nombres      = r.IsDBNull(2)  ? null : r.GetString(2),
                Perfil       = r.IsDBNull(3)  ? null : r.GetString(3),
                Seniority    = r.IsDBNull(4)  ? null : r.GetString(4),
                RemA         = remA,
                RemB         = remB,
                EstadoA      = r.IsDBNull(7)  ? null : r.GetString(7),
                EstadoB      = r.IsDBNull(8)  ? null : r.GetString(8),
                VarPctA      = r.IsDBNull(9)  ? null : r.GetString(9),
                VarPctB      = r.IsDBNull(10) ? null : r.GetString(10),
                Movimiento   = r.IsDBNull(11) ? "continua" : r.GetString(11),
                VariacionPct = varP,
            });
        }
        return list;
    }
}
