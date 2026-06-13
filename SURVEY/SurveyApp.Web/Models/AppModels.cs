// AppModels.cs — DTOs propios que exponemos al frontend React.
// Se serializan en camelCase automáticamente por Program.cs.

namespace SurveyApp.Web.Models;

// ── Lista de surveys (GET /api/surveys) ──────────────────────────────────────

public record SurveyListResponse(
    List<SurveyItem> Surveys,
    int Total
);

public record SurveyItem(
    string Id,
    string Title,
    int ResponseCount,
    string? DateCreated,
    string? DateModified
);

// ── Detalle de survey con preguntas (GET /api/surveys/{id}) ──────────────────

public record SurveyDetailResponse(
    string Id,
    string Title,
    int ResponseCount,
    string? DateCreated,
    string? DateModified,
    List<QuestionInfo> Questions
);

public record QuestionInfo(
    string Id,
    string Heading,
    string Family,
    string? Subtype,
    List<ChoiceInfo>? Choices
);

public record ChoiceInfo(
    string Id,
    string Text,
    int Position
);

// ── Analytics de un survey (GET /api/surveys/{id}/analytics) ─────────────────

public record SurveyAnalyticsResponse(
    string SurveyId,
    string SurveyTitle,
    int TotalResponses,
    List<QuestionAnalytics> Questions
);

public record QuestionAnalytics(
    string QuestionId,
    string Heading,
    string Family,
    string? Subtype,
    int Answered,
    int Skipped,
    List<ChoiceResult>? Choices
);

public record ChoiceResult(
    string Id,
    string Text,
    int Count,
    double Percentage,
    string RepresentedLabel
);

// ── Survey year selector (GET /api/surveys/for-year) ─────────────────────────

public record SurveyForYearItem(string Id, string Title, string DateModified);

public record SurveyForYearResponse(List<SurveyForYearItem> Surveys, int Year);

// ── Survey report (GET /api/surveys/{id}/report) ──────────────────────────────

public record PendingRecipient(string Email, string Status);

public record CollectorReport(
    string CollectorId,
    string CollectorName,
    string CollectorType,   // "email" | "weblink"
    string TypeLabel,       // "Mensual" | "Quincenal" | "Weblink" | "Email"
    int Sent,
    int Responded,
    List<PendingRecipient> Pending
);

public record SurveyReportResponse(
    string SurveyId,
    string Title,
    string DateModified,
    List<CollectorReport> Collectors,
    int TotalSent,
    int TotalResponded,
    int TotalPending
);

// ── Health ────────────────────────────────────────────────────────────────────

public record HealthResponse(bool Ok, string Message = "Survey API running");
