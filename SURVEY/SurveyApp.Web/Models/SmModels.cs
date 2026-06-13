// SmModels.cs — DTOs que mapean directamente la respuesta JSON de SurveyMonkey API v3
// Las propiedades usan [JsonPropertyName] para el snake_case de SM.

using System.Text.Json.Serialization;

namespace SurveyApp.Web.Models;

// ── Lista de surveys ─────────────────────────────────────────────────────────

public class SmSurveyListResponse
{
    [JsonPropertyName("data")]
    public List<SmSurveyItem> Data { get; set; } = [];

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("page")]
    public int Page { get; set; }

    [JsonPropertyName("per_page")]
    public int PerPage { get; set; }
}

public class SmSurveyItem
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("href")]
    public string? Href { get; set; }

    [JsonPropertyName("response_count")]
    public int ResponseCount { get; set; }

    [JsonPropertyName("date_created")]
    public string? DateCreated { get; set; }

    [JsonPropertyName("date_modified")]
    public string? DateModified { get; set; }
}

// ── Detalle de survey con preguntas ──────────────────────────────────────────

public class SmSurveyDetail
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("title")]
    public string Title { get; set; } = "";

    [JsonPropertyName("response_count")]
    public int ResponseCount { get; set; }

    [JsonPropertyName("date_created")]
    public string? DateCreated { get; set; }

    [JsonPropertyName("date_modified")]
    public string? DateModified { get; set; }

    [JsonPropertyName("pages")]
    public List<SmPage> Pages { get; set; } = [];
}

public class SmPage
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("questions")]
    public List<SmQuestion> Questions { get; set; } = [];
}

public class SmQuestion
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("heading")]
    public string Heading { get; set; } = "";

    [JsonPropertyName("family")]
    public string Family { get; set; } = "";

    [JsonPropertyName("subtype")]
    public string? Subtype { get; set; }

    [JsonPropertyName("answers")]
    public SmAnswers? Answers { get; set; }
}

public class SmAnswers
{
    [JsonPropertyName("choices")]
    public List<SmChoice>? Choices { get; set; }

    [JsonPropertyName("rows")]
    public List<SmChoice>? Rows { get; set; }
}

public class SmChoice
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("text")]
    public string Text { get; set; } = "";

    [JsonPropertyName("position")]
    public int Position { get; set; }
}

// ── Rollup (agregados por pregunta) ──────────────────────────────────────────

public class SmRollupResponse
{
    [JsonPropertyName("data")]
    public List<SmQuestionRollup> Data { get; set; } = [];
}

public class SmQuestionRollup
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("summary")]
    public List<SmRollupSummary> Summary { get; set; } = [];

    [JsonPropertyName("rollups")]
    public List<SmChoiceRollup>? Rollups { get; set; }
}

public class SmRollupSummary
{
    [JsonPropertyName("answered")]
    public int Answered { get; set; }

    [JsonPropertyName("skipped")]
    public int Skipped { get; set; }
}

public class SmChoiceRollup
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("count")]
    public int Count { get; set; }

    [JsonPropertyName("represented")]
    public string Represented { get; set; } = "0.00%";
}

// ── Collectors ───────────────────────────────────────────────────────────────

public class SmCollectorListResponse
{
    [JsonPropertyName("data")]
    public List<SmCollector> Data { get; set; } = [];

    [JsonPropertyName("total")]
    public int Total { get; set; }
}

public class SmCollector
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    // "email" | "weblink" | "offline"
    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    // "open" | "closed"
    [JsonPropertyName("status")]
    public string Status { get; set; } = "";

    // Disponibles al usar ?include=sent,responded
    [JsonPropertyName("sent")]
    public int Sent { get; set; }

    [JsonPropertyName("responded")]
    public int Responded { get; set; }
}

// ── Recipients ───────────────────────────────────────────────────────────────

public class SmRecipientPageResponse
{
    [JsonPropertyName("data")]
    public List<SmRecipient> Data { get; set; } = [];

    [JsonPropertyName("total")]
    public int Total { get; set; }
}

public class SmRecipient
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("email")]
    public string Email { get; set; } = "";

    // "sent" | "started" | "completed" | "bounced" | "opted_out" | "removed"
    [JsonPropertyName("status")]
    public string Status { get; set; } = "";
}
