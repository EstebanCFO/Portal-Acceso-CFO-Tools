using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace BandasSalariales.Web.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UploadController(IWebHostEnvironment env) : ControllerBase
{
    /// POST /api/upload   multipart/form-data  campo: excel
    [HttpPost]
    [RequestSizeLimit(50_000_000)]   // 50 MB
    public async Task<IActionResult> Upload(IFormFile? excel)
    {
        if (excel is null || excel.Length == 0)
            return BadRequest(new { message = "No se recibió archivo." });

        if (!excel.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "El archivo debe ser .xlsx" });

        // Guardar en db/_tmp/
        var root   = env.ContentRootPath;              // …/BandasSalariales.Web
        var tmpDir = Path.GetFullPath(Path.Combine(root, "..", "db", "_tmp"));
        Directory.CreateDirectory(tmpDir);

        var tmpPath = Path.Combine(tmpDir, excel.FileName);
        await using (var fs = System.IO.File.Create(tmpPath))
            await excel.CopyToAsync(fs);

        // Invocar el ETL Python existente
        var scriptsDir = Path.GetFullPath(Path.Combine(root, "..", "scripts"));
        var scriptPath = Path.Combine(scriptsDir, "import_excel.py");

        var psi = new ProcessStartInfo
        {
            FileName               = "python",
            Arguments              = $"\"{scriptPath}\" \"{tmpPath}\"",
            WorkingDirectory       = Path.GetFullPath(Path.Combine(root, "..")),
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
            UseShellExecute        = false,
            CreateNoWindow         = true,
            StandardOutputEncoding = System.Text.Encoding.UTF8,
        };
        psi.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";

        using var proc = Process.Start(psi)!;
        string stdout = await proc.StandardOutput.ReadToEndAsync();
        string stderr = await proc.StandardError.ReadToEndAsync();
        await proc.WaitForExitAsync();

        // Limpiar temp
        try { System.IO.File.Delete(tmpPath); } catch { /* ignorar */ }

        bool exitOk = proc.ExitCode == 0;
        string output = (stdout + stderr).Trim();

        // Detectar "ya existía" por el mensaje del script
        bool yaExistia = output.Contains("ya fue importado") || output.Contains("ya_existia");

        if (!exitOk)
            return StatusCode(500, new { message = output.Length > 0 ? output : "Error al importar." });

        if (yaExistia)
            return Ok(new { status = "ya_existia", message = output });

        return Ok(new { status = "ok", message = output });
    }
}
