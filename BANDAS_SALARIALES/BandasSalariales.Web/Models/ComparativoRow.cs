namespace BandasSalariales.Web.Models;

public class ComparativoRow
{
    public string? Cuil         { get; set; }
    public string? Apellidos    { get; set; }
    public string? Nombres      { get; set; }
    public string? Perfil       { get; set; }
    public string? Seniority    { get; set; }
    public double? RemA         { get; set; }
    public double? RemB         { get; set; }
    public string? EstadoA      { get; set; }
    public string? EstadoB      { get; set; }
    public string? VarPctA      { get; set; }
    public string? VarPctB      { get; set; }
    public string  Movimiento   { get; set; } = "continua";
    public double? VariacionPct { get; set; }
}
