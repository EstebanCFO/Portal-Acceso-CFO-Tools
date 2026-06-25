"""database.py — Engine SQLAlchemy + session factory."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    """FastAPI dependency: sesión de base de datos por request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
