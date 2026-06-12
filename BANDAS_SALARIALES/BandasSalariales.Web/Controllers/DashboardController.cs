using Microsoft.AspNetCore.Mvc;
using BandasSalariales.Web.Services;

namespace BandasSalariales.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController(BandasDbService db) : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        var kpis = db.GetDashboardKpis();
        if (kpis is null) return Ok(null);
        return Ok(kpis);
    }
}
