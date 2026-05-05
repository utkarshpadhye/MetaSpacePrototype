from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings


settings = get_settings()


class Base(DeclarativeBase):
    pass


try:
    engine = create_engine(settings.database_url, future=True)
except ModuleNotFoundError:
    # Allow local/unit workflows without psycopg by falling back to sqlite.
    engine = create_engine('sqlite+pysqlite:///./metaspace_local.db', future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
