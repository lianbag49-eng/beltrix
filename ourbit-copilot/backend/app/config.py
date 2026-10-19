from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str = 'sqlite:///./ourbit.db'
    database_url_unpooled: str = ''
    app_env: str = 'development'
    web_origin: str = 'http://localhost:3000'
    youtube_api_key: str = ''
    telegram_bot_token: str = ''
    telegram_webhook_secret: str = ''
    gemini_api_key: str = ''
    gemini_model: str = ''
    bootstrap_token: str = ''
    database_schema: str = 'ourbit'


settings = Settings()
import re
if not re.fullmatch(r'[a-z][a-z0-9_]{0,40}', settings.database_schema):
    raise RuntimeError('Invalid DATABASE_SCHEMA')
if settings.app_env == 'production':
    if not settings.database_url.startswith(('postgresql://', 'postgresql+psycopg://')):
        raise RuntimeError('Production requires PostgreSQL')
    if not settings.web_origin.startswith('https://'):
        raise RuntimeError('Production requires HTTPS WEB_ORIGIN')


def db_url(value: str) -> str:
    return value.replace('postgresql://', 'postgresql+psycopg://', 1)
