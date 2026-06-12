namespace BandasSalariales.Web.Models;

public class Importacion
{
    public int    Id              { get; set; }
    public string Periodo         { get; set; } = "";
    public string FechaCarga      { get; set; } = "";
    public int    TotalRegistros  { get; set; }
    public string ArchivoFuente   { get; set; } = "";
}
