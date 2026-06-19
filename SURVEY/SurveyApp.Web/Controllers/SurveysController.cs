using Microsoft.AspNetCore.Mvc;
using SurveyApp.Web.Services;

namespace SurveyApp.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SurveysController : ControllerBase
{
    private readonly SurveyMonkeyService _sm;
    private readonly ILogger<SurveysController> _log;
    private readonly IConfiguration _config;

    public SurveysController(
        SurveyMonkeyService sm,
        ILogger<SurveysController> log,
        IConfiguration config)
    {
        _sm     = sm;
        _log    = log;
        _config = config;
    }

    // GET /api/surveys/years
    // Devuelve los años configurados en SurveyMonkey:Years (appsettings.json)
    [HttpGet("years")]
    public IActionResult GetYears()
    {
        var years = _config
            .GetSection("SurveyMonkey:Years")
            .Get<List<int>>()
            ?? [DateTime.Now.Year];
        return Ok(years);
    }

    // GET /api/surveys/for-year?year=2026
    // Devuelve las encuestas OPEN con actividad en el año indicado
    [HttpGet("for-year")]
    public async Task<IActionResult> GetSurveysForYear(
        [FromQuery] int year, CancellationToken ct)
    {
        if (year < 2000 || year > 2100)
            return BadRequest(new { error = "Año inválido." });
        try
        {
            var result = await _sm.GetOpenSurveysForYearAsync(year, ct);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            _log.LogError(ex, "Error obteniendo encuestas para {Year}", year);
            return ex.StatusCode switch
            {
                System.Net.HttpStatusCode.Unauthorized =>
                    Unauthorized(new { error = "Token de SurveyMonkey inválido o vencido. Verificá appsettings.json." }),
                System.Net.HttpStatusCode.TooManyRequests =>
                    StatusCode(429, new { error = "Límite de requests alcanzado. Intentar en unos minutos." }),
                System.Net.HttpStatusCode.BadRequest =>
                    StatusCode(502, new { error = $"SurveyMonkey rechazó la solicitud (400 Bad Request). {ex.Message}" }),
                System.Net.HttpStatusCode.Forbidden =>
                    StatusCode(502, new { error = "SurveyMonkey rechazó el token (403 Forbidden). Verificá los permisos de la app en developer.surveymonkey.com." }),
                null =>
                    StatusCode(502, new { error = $"No se pudo conectar con SurveyMonkey (error de red). {ex.Message}" }),
                _ => StatusCode(502, new { error = $"Error de SurveyMonkey (HTTP {(int?)ex.StatusCode}: {ex.StatusCode}). {ex.Message}" })
            };
        }
    }

    // GET /api/surveys/{id}/report
    // Devuelve collectors + enviados/respondidos/pendientes de una encuesta
    [HttpGet("{id}/report")]
    public async Task<IActionResult> GetReport(string id, CancellationToken ct)
    {
        try
        {
            var result = await _sm.GetSurveyReportAsync(id, ct);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            _log.LogError(ex, "Error generando reporte para survey {Id}", id);
            return ex.StatusCode switch
            {
                System.Net.HttpStatusCode.Unauthorized =>
                    Unauthorized(new { error = "Token de SurveyMonkey inválido o vencido." }),
                System.Net.HttpStatusCode.NotFound =>
                    NotFound(new { error = $"Survey {id} no encontrado." }),
                System.Net.HttpStatusCode.TooManyRequests =>
                    StatusCode(429, new { error = "Límite de requests alcanzado. Intentar en unos minutos." }),
                _ => StatusCode(502, new { error = $"Error de SurveyMonkey: {ex.StatusCode}" })
            };
        }
    }

    // GET /api/surveys
    [HttpGet]
    public async Task<IActionResult> GetSurveys(CancellationToken ct)
    {
        try
        {
            var result = await _sm.GetSurveysAsync(ct: ct);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            _log.LogError(ex, "Error llamando a SurveyMonkey /surveys");
            return ex.StatusCode switch
            {
                System.Net.HttpStatusCode.Unauthorized =>
                    Unauthorized(new { error = "Token de SurveyMonkey invalido o vencido." }),
                System.Net.HttpStatusCode.TooManyRequests =>
                    StatusCode(429, new { error = "Limite de requests de SurveyMonkey alcanzado. Intentar en unos minutos." }),
                _ => StatusCode(502, new { error = $"Error de SurveyMonkey: {ex.StatusCode}" })
            };
        }
    }

    // GET /api/surveys/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetSurveyDetail(string id, CancellationToken ct)
    {
        try
        {
            var result = await _sm.GetSurveyDetailAsync(id, ct);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            _log.LogError(ex, "Error llamando a SurveyMonkey /surveys/{Id}/details", id);
            return ex.StatusCode switch
            {
                System.Net.HttpStatusCode.Unauthorized =>
                    Unauthorized(new { error = "Token de SurveyMonkey invalido o vencido." }),
                System.Net.HttpStatusCode.NotFound =>
                    NotFound(new { error = $"Survey {id} no encontrado." }),
                _ => StatusCode(502, new { error = $"Error de SurveyMonkey: {ex.StatusCode}" })
            };
        }
    }

    // GET /api/surveys/{id}/analytics
    [HttpGet("{id}/analytics")]
    public async Task<IActionResult> GetAnalytics(string id, CancellationToken ct)
    {
        try
        {
            var result = await _sm.GetAnalyticsAsync(id, ct);
            return Ok(result);
        }
        catch (HttpRequestException ex)
        {
            _log.LogError(ex, "Error calculando analytics para survey {Id}", id);
            return ex.StatusCode switch
            {
                System.Net.HttpStatusCode.Unauthorized =>
                    Unauthorized(new { error = "Token de SurveyMonkey invalido o vencido." }),
                System.Net.HttpStatusCode.NotFound =>
                    NotFound(new { error = $"Survey {id} no encontrado." }),
                _ => StatusCode(502, new { error = $"Error de SurveyMonkey: {ex.StatusCode}" })
            };
        }
    }

    // POST /api/surveys/shutdown
    // Apaga el servidor ASP.NET Core (usado por el portal para stop limpio)
    [HttpPost("/api/shutdown")]
    public IActionResult Shutdown([FromServices] IHostApplicationLifetime lifetime)
    {
        _log.LogInformation("Shutdown solicitado desde el frontend.");
        Task.Delay(300).ContinueWith(_ => lifetime.StopApplication());
        return Ok(new { ok = true });
    }
}
