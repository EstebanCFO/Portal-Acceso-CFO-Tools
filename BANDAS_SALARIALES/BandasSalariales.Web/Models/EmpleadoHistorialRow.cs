namespace BandasSalariales.Web.Models;

public class EmpleadoHistorialRow
{
    public string? FechaCarga   { get; set; }
    public string? Periodo      { get; set; }
    public string? Perfil       { get; set; }
    public string? Seniority    { get; set; }
    public string? Ceco         { get; set; }
    public double? Remuneracion { get; set; }
    public double? SalarioBruto { get; set; }
    public double? Internet     { get; set; }
    public double? FactCash     { get; set; }
    public double? LimInferior  { get; set; }
    public double? LimSuperior  { get; set; }
    public string? EstadoVsInf  { get; set; }
    public string? EstadoVsSup  { get; set; }
    public string? VarMonto     { get; set; }
    public string? VarPct       { get; set; }
}
