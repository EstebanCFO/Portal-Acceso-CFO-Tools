using BandasSalariales.Web.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        // camelCase en JSON
        o.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
        // No incluir nulls (menor payload)
        o.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// CORS: orígenes permitidos leídos desde appsettings.json → "AllowedOrigins" (CSV).
// En entornos hosteados, sobreescribir en appsettings.Production.json o variable de entorno.
// Valor por defecto (local dev): "http://localhost:5173,http://localhost:5174"
var allowedOrigins = (
    builder.Configuration.GetValue<string>("AllowedOrigins")
    ?? "http://localhost:5173,http://localhost:5174"
).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(p =>
        p.WithOrigins(allowedOrigins)
         .AllowAnyHeader()
         .AllowAnyMethod()));

builder.Services.AddSingleton<BandasDbService>();

var app = builder.Build();

app.UseCors();
app.MapControllers();

// Health check — respuesta inmediata sin tocar la BD (usado por el semáforo del frontend)
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

// Índice de rutas disponibles
app.MapGet("/", () => Results.Ok(new
{
    app     = "Bandas Salariales DC — API",
    version = "2.0",
    rutas   = new[]
    {
        "GET  /api/dashboard",
        "GET  /api/snapshots",
        "GET  /api/snapshots/{id}/empleados",
        "GET  /api/empleados/{cuil}",
        "GET  /api/empleados/buscar?q=",
        "GET  /api/empleados/comparativo?a=&b=",
        "POST /api/upload    (multipart: excel)",
        "POST /api/shutdown  (detiene el servidor)",
    }
}));

// Shutdown: detiene el host ASP.NET Core limpiamente.
// El Task.Delay da tiempo para que la respuesta HTTP salga antes de cerrar.
app.MapPost("/api/shutdown", (IHostApplicationLifetime lifetime) =>
{
    _ = Task.Run(async () =>
    {
        await Task.Delay(300);
        lifetime.StopApplication();
    });
    return Results.Ok(new { message = "Cerrando servicios..." });
});

app.Run();
