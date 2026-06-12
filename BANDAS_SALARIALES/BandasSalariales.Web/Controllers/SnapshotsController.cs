using Microsoft.AspNetCore.Mvc;
using BandasSalariales.Web.Services;

namespace BandasSalariales.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SnapshotsController(BandasDbService db) : ControllerBase
{
    /// GET /api/snapshots
    [HttpGet]
    public IActionResult GetAll() => Ok(db.GetSnapshots());

    /// GET /api/snapshots/{id}/empleados
    [HttpGet("{id:int}/empleados")]
    public IActionResult GetEmpleados(int id) => Ok(db.GetEmpleadosPorSnapshot(id));

    /// DELETE /api/snapshots/{id}  — borra importación + empleados del período
    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id)
    {
        var deleted = db.DeleteSnapshot(id);
        if (!deleted) return NotFound(new { message = $"Snapshot {id} no encontrado." });
        return Ok(new { message = $"Snapshot {id} eliminado correctamente." });
    }
}
