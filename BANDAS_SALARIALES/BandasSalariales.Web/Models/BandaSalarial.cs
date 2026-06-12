namespace BandasSalariales.Web.Models;

public class BandaSalarial
{
    public int     ImportId      { get; set; }
    public string  Cuil          { get; set; } = "";
    public string? Dni           { get; set; }
    public string? Apellidos     { get; set; }
    public string? Nombres       { get; set; }
    public string? Ceco          { get; set; }
    public string? FechaIngreso  { get; set; }
    public string? Perfil        { get; set; }
    public string? Seniority     { get; set; }
    public double? SalarioBruto  { get; set; }
    public double? Internet      { get; set; }
    public double? FactCash      { get; set; }
    public double? Remuneracion  { get; set; }
    public string? Verif         { get; set; }
    public double? LimInferior   { get; set; }
    public double? LimSuperior   { get; set; }
    public string? EstadoVsInf   { get; set; }
    public string? EstadoVsSup   { get; set; }
    public string? VarMonto      { get; set; }
    public string? VarPct        { get; set; }
    public string? Gerencia      { get; set; }
}
