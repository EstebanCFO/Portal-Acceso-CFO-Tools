# AGENTE_AUDITORIA_CLOUD/api/shutdown.py
"""Apagado del stack local de desarrollo (solo dev — gated en function_app).

El botón "Salir" del frontend pega a /api/shutdown, que llama a perform_shutdown():
mata Vite y Azurite de inmediato, y al propio backend (host de Functions) con un
pequeño delay en un proceso detached, para que la respuesta HTTP alcance a volver
antes de que el puerto :7071 se cierre.

Solo tiene sentido en local. En Azure los servicios son cloud gestionados; el
endpoint queda bloqueado por is_azure().
"""
import os
import subprocess

VITE_PORT    = int(os.environ.get('VITE_PORT', '5020'))
AZURITE_PORT = int(os.environ.get('AZURITE_PORT', '10000'))
BACKEND_PORT = int(os.environ.get('BACKEND_PORT', '7071'))

# Flags Windows para desprender el proceso del padre (sobrevive al kill del backend).
_DETACHED = getattr(subprocess, 'DETACHED_PROCESS', 0) | getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0)


def is_azure() -> bool:
    """True si corremos en Azure (WEBSITE_INSTANCE_ID lo setea el runtime de App Service)."""
    return bool(os.environ.get('WEBSITE_INSTANCE_ID'))


def _kill_ps(port: int) -> str:
    """Snippet PowerShell que mata el proceso que escucha en un puerto."""
    return (
        f"Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue "
        f"| ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}"
    )


def _kill_port(port: int) -> None:
    """Mata el proceso que escucha en el puerto (inline, bloqueante)."""
    subprocess.run(
        ['powershell', '-NoProfile', '-Command', _kill_ps(port)],
        capture_output=True,
    )


def _kill_port_delayed(port: int, delay: int = 2) -> None:
    """Mata el proceso del puerto tras `delay` segundos, en un proceso detached."""
    subprocess.Popen(
        ['powershell', '-NoProfile', '-Command', f"Start-Sleep -Seconds {delay}; {_kill_ps(port)}"],
        creationflags=_DETACHED,
    )


def perform_shutdown() -> dict:
    """Baja todo el stack local. Vite y Azurite ya; el backend (self) con delay."""
    _kill_port(VITE_PORT)
    _kill_port(AZURITE_PORT)
    _kill_port_delayed(BACKEND_PORT, delay=2)
    return {'ok': True, 'stopped': [VITE_PORT, AZURITE_PORT, BACKEND_PORT]}
