using Microsoft.AspNetCore.Mvc;
using SurveyApp.Web.Models;

namespace SurveyApp.Web.Controllers;

[ApiController]
[Route("api")]
public class HealthController : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health() =>
        Ok(new HealthResponse(Ok: true));
}
