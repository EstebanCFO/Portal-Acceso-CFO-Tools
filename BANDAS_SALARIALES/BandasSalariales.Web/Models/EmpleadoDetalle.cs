namespace BandasSalariales.Web.Models;

public class EmpleadoDetalle
{
    public string? Cuil         { get; set; }
    public string? Dni          { get; set; }
    public string? Apellidos    { get; set; }
    public string? Nombres      { get; set; }
    public string? Ceco         { get; set; }
    public string? FechaIngreso { get; set; }
    public string? Perfil       { get; set; }
    public string? Seniority    { get; set; }
    public List<EmpleadoHistorialRow> Historial { get; set; } = [];
}
