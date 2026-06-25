"""config.py — Settings desde variables de entorno."""
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DATABASE_URL  = os.environ.get('DATABASE_URL',  'postgresql://postgres:postgres@localhost:5432/proyectos_activos')
PORT          = int(os.environ.get('PORT',       '5010'))
CORS_ORIGINS  = os.environ.get('CORS_ORIGINS',   'http://localhost:5011,http://localhost:5174').split(',')
