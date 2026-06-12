using Microsoft.AspNetCore.Mvc;
using BandasSalariales.Web.Services;

namespace BandasSalariales.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmpleadosController(BandasDbService db) : ControllerBase
{
    /// GET /api/empleados/buscar?q=gomez
    [HttpGet("buscar")]
    public IActionResult Buscar([FromQuery] string q = "")
    {
        if (q.Length < 2) return Ok(Array.Empty<object>());
        return Ok(db.BuscarEmpleados(q));
    }

    /// GET /api/empleados/{cuil}
    [HttpGet("{cuil}")]
    public IActionResult GetDetalle(string cuil)
    {
        var detalle = db.GetEmpleadoDetalle(cuil);
        if (detalle is null) return NotFound(new { message = $"No se encontró el CUIL {cuil}" });
        return Ok(detalle);
    }

    /// GET /api/empleados/comparativo?a=1&b=2
    [HttpGet("comparativo")]
    public IActionResult Comparativo([FromQuery] int a, [FromQuery] int b)
    {
        if (a == 0 || b == 0) return BadRequest("Parámetros a y b requeridos.");
        if (a == b)           return BadRequest("Los períodos deben ser distintos.");
        return Ok(db.GetComparativo(a, b));
    }
}
