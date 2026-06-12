using Microsoft.AspNetCore.Mvc;
using SurveyApp.Web.Services;

namespace SurveyApp.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SurveysController : ControllerBase
{
    private readonly SurveyMonkeyService _sm;
    private readonly ILogger<SurveysController> _log;

    public SurveysController(SurveyMonkeyService sm, ILogger<SurveysController> log)
    {
        _sm  = sm;
        _log = log;
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
