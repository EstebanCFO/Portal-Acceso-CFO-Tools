// Program.cs — Survey App ASP.NET Core 8
// API que expone datos de SurveyMonkey al frontend React en :5176

using System.Text.Json;
using SurveyApp.Web.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Servicios ─────────────────────────────────────────────────────────────────

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        // camelCase para el frontend JS/TS
        o.JsonSerializerOptions.PropertyNamingPolicy        = JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DictionaryKeyPolicy         = JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DefaultIgnoreCondition      =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddHttpClient();  // IHttpClientFactory
builder.Services.AddScoped<SurveyMonkeyService>();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Orígenes permitidos leídos desde appsettings.json → "AllowedOrigins" (CSV).
// En entornos hosteados, sobreescribir en appsettings.Production.json o variable de entorno.
// Valor por defecto (local dev): "http://localhost:5176,http://localhost:5174"
var allowedOrigins = (
    builder.Configuration.GetValue<string>("AllowedOrigins")
    ?? "http://localhost:5176,http://localhost:5174"
).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// ── Middleware ────────────────────────────────────────────────────────────────

// Quitar X-Frame-Options para que el portal pueda embeber en iframe
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers.Remove("X-Frame-Options");
    await next();
});

app.UseCors();
app.MapControllers();

app.Run();
