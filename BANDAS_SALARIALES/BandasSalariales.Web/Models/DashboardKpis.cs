namespace BandasSalariales.Web.Models;

public class DashboardKpis
{
    public string? Periodo     { get; set; }
    public string? FechaCarga  { get; set; }
    public int     Total       { get; set; }
    public int     Ok          { get; set; }
    public int     Revisar     { get; set; }
    public int     SinBanda    { get; set; }
    public double  PctOk       { get; set; }
    public double  PctRevisar  { get; set; }
    public double  PctSin      { get; set; }
    public double? RemAvg      { get; set; }
    public double? RemMax      { get; set; }
    public double? RemMin      { get; set; }
}
