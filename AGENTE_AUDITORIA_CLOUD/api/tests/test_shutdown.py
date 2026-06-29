# AGENTE_AUDITORIA_CLOUD/api/tests/test_shutdown.py
import sys, os
from unittest.mock import patch, MagicMock
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import shutdown


class TestPerformShutdown:
    def test_mata_vite_azurite_inline_y_backend_con_delay(self):
        with patch('shutdown.subprocess.run') as mock_run, \
             patch('shutdown.subprocess.Popen') as mock_popen:
            result = shutdown.perform_shutdown()

        # Vite (:5020) y Azurite (:10000) se matan inline -> subprocess.run
        run_cmds = ' '.join(' '.join(c.args[0]) for c in mock_run.call_args_list)
        assert str(shutdown.VITE_PORT) in run_cmds
        assert str(shutdown.AZURITE_PORT) in run_cmds

        # El backend (self, :7071) se mata con delay en proceso detached -> Popen
        assert mock_popen.call_count == 1
        popen_cmd = ' '.join(mock_popen.call_args.args[0])
        assert str(shutdown.BACKEND_PORT) in popen_cmd

        assert result['ok'] is True
        assert set(result['stopped']) == {shutdown.VITE_PORT, shutdown.AZURITE_PORT, shutdown.BACKEND_PORT}


class TestIsAzure:
    def test_detecta_azure_por_website_instance_id(self):
        with patch.dict(os.environ, {'WEBSITE_INSTANCE_ID': 'abc123'}):
            assert shutdown.is_azure() is True

    def test_local_sin_website_instance_id(self):
        env = {k: v for k, v in os.environ.items() if k != 'WEBSITE_INSTANCE_ID'}
        with patch.dict(os.environ, env, clear=True):
            assert shutdown.is_azure() is False
