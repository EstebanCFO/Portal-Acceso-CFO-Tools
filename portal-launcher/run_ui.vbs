' run_ui.vbs — lanza launcher_ui.py sin ventana de consola DOS
' Usado por START.bat para arrancar la UI del portal silenciosamente.
Set sh = CreateObject("WScript.Shell")
Dim dir : dir = CreateObject("Scripting.FileSystemObject") _
    .GetParentFolderName(WScript.ScriptFullName)
sh.Run "pythonw """ & dir & "\launcher_ui.py""", 0, False
