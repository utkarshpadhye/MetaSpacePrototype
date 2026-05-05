from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    app_env: str = 'development'
    app_name: str = 'MetaSpace API'
    database_url: str = 'postgresql+psycopg://localhost:5432/metaspace'
    cors_origins: str = 'http://localhost:5173,http://127.0.0.1:5173'
    jwt_secret: str = 'change-me-in-local-env'
    ws_origin: str = 'http://localhost:5173'
    rate_limit_per_minute: int = 240
    rate_limit_burst: int = 60


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
