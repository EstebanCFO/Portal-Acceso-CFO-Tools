// SurveyMonkeyService.cs
// Cliente HTTP tipado para la API de SurveyMonkey v3.
// Se registra como Scoped en Program.cs.

using System.Net.Http.Headers;
using System.Text.Json;
using SurveyApp.Web.Models;

namespace SurveyApp.Web.Services;

public class SurveyMonkeyService
{
    private readonly HttpClient _http;
    private readonly string _baseUrl;

    private static readonly JsonSerializerOptions _jsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public SurveyMonkeyService(IHttpClientFactory factory, IConfiguration config)
    {
        _http = factory.CreateClient();

        _baseUrl = config["SurveyMonkey:BaseUrl"]
                   ?? "https://api.surveymonkey.com/v3";

        var token = config["SurveyMonkey:AccessToken"] ?? "";

        if (!string.IsNullOrWhiteSpace(token))
        {
            _http.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", token);
        }

        _http.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));
    }

    // ── Lista de surveys ───────────────────────────────────────────────────────

    public async Task<SurveyListResponse> GetSurveysAsync(
        int page = 1, int perPage = 100, CancellationToken ct = default)
    {
        var url = $"{_baseUrl}/surveys"
                + $"?page={page}&per_page={perPage}"
                + "&include=response_count,date_created,date_modified";

        var resp = await _http.GetAsync(url, ct);
        resp.EnsureSuccessStatusCode();

        var sm = await Deserialize<SmSurveyListResponse>(resp, ct);

        var surveys = sm.Data.Select(s => new SurveyItem(
            Id:            s.Id,
            Title:         s.Title,
            ResponseCount: s.ResponseCount,
            DateCreated:   s.DateCreated,
            DateModified:  s.DateModified
        )).ToList();

        return new SurveyListResponse(surveys, sm.Total);
    }

    // ── Detalle de un survey ───────────────────────────────────────────────────

    public async Task<SurveyDetailResponse> GetSurveyDetailAsync(
        string surveyId, CancellationToken ct = default)
    {
        var url = $"{_baseUrl}/surveys/{surveyId}/details";

        var resp = await _http.GetAsync(url, ct);
        resp.EnsureSuccessStatusCode();

        var sm = await Deserialize<SmSurveyDetail>(resp, ct);

        var questions = sm.Pages
            .SelectMany(p => p.Questions)
            .Select(q => new QuestionInfo(
                Id:      q.Id,
                Heading: q.Heading,
                Family:  q.Family,
                Subtype: q.Subtype,
                Choices: q.Answers?.Choices?.Select(c => new ChoiceInfo(
                    Id:       c.Id,
                    Text:     c.Text,
                    Position: c.Position
                )).ToList()
            ))
            .ToList();

        return new SurveyDetailResponse(
            Id:            sm.Id,
            Title:         sm.Title,
            ResponseCount: sm.ResponseCount,
            DateCreated:   sm.DateCreated,
            DateModified:  sm.DateModified,
            Questions:     questions
        );
    }

    // ── Analytics: rollups por pregunta ───────────────────────────────────────
    // Combina GET /surveys/{id}/details (textos) con GET /surveys/{id}/rollups (conteos)

    public async Task<SurveyAnalyticsResponse> GetAnalyticsAsync(
        string surveyId, CancellationToken ct = default)
    {
        // Llamadas en paralelo para reducir latencia
        var detailTask  = GetSurveyDetailAsync(surveyId, ct);
        var rollupsTask = GetRollupsAsync(surveyId, ct);

        await Task.WhenAll(detailTask, rollupsTask);

        var detail  = await detailTask;
        var rollups = await rollupsTask;

        // Índices: questionId → QuestionInfo, questionId → SmQuestionRollup
        var questionMap = detail.Questions.ToDictionary(q => q.Id);
        var rollupMap   = rollups.ToDictionary(r => r.Id);

        var questionAnalytics = new List<QuestionAnalytics>();

        foreach (var q in detail.Questions)
        {
            rollupMap.TryGetValue(q.Id, out var rollup);

            var summary  = rollup?.Summary.FirstOrDefault();
            var answered = summary?.Answered ?? 0;
            var skipped  = summary?.Skipped  ?? 0;

            List<ChoiceResult>? choices = null;

            if (q.Choices is { Count: > 0 } && rollup?.Rollups is { Count: > 0 })
            {
                var choiceTextMap = q.Choices.ToDictionary(c => c.Id, c => c.Text);

                choices = rollup.Rollups
                    .Where(r => choiceTextMap.ContainsKey(r.Id))
                    .Select(r =>
                    {
                        var pct = answered > 0
                            ? Math.Round((double)r.Count / answered * 100, 1)
                            : 0.0;
                        return new ChoiceResult(
                            Id:               r.Id,
                            Text:             choiceTextMap.GetValueOrDefault(r.Id, r.Id),
                            Count:            r.Count,
                            Percentage:       pct,
                            RepresentedLabel: r.Represented
                        );
                    })
                    .OrderBy(c => q.Choices!.FindIndex(ch => ch.Id == c.Id))
                    .ToList();
            }

            questionAnalytics.Add(new QuestionAnalytics(
                QuestionId: q.Id,
                Heading:    q.Heading,
                Family:     q.Family,
                Subtype:    q.Subtype,
                Answered:   answered,
                Skipped:    skipped,
                Choices:    choices
            ));
        }

        return new SurveyAnalyticsResponse(
            SurveyId:       surveyId,
            SurveyTitle:    detail.Title,
            TotalResponses: detail.ResponseCount,
            Questions:      questionAnalytics
        );
    }

    // ── Privado: rollups raw ───────────────────────────────────────────────────

    private async Task<List<SmQuestionRollup>> GetRollupsAsync(
        string surveyId, CancellationToken ct)
    {
        var url  = $"{_baseUrl}/surveys/{surveyId}/rollups";
        var resp = await _http.GetAsync(url, ct);
        resp.EnsureSuccessStatusCode();

        var sm = await Deserialize<SmRollupResponse>(resp, ct);
        return sm.Data;
    }

    // ── Helper deserialización ─────────────────────────────────────────────────

    private static async Task<T> Deserialize<T>(
        HttpResponseMessage resp, CancellationToken ct) where T : new()
    {
        var stream = await resp.Content.ReadAsStreamAsync(ct);
        return await JsonSerializer.DeserializeAsync<T>(stream, _jsonOpts, ct)
               ?? new T();
    }
}
