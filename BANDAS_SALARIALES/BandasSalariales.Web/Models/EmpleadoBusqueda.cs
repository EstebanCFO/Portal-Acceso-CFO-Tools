namespace BandasSalariales.Web.Models;

public class EmpleadoBusqueda
{
    public string  Cuil      { get; set; } = "";
    public string? Apellidos { get; set; }
    public string? Nombres   { get; set; }
    public string? Perfil    { get; set; }
    public string? Seniority { get; set; }
}
