from alembic import context
from sqlalchemy import create_engine, text
from app.config import settings, db_url
from app.db import Base
from app import models

url = db_url(settings.database_url_unpooled or settings.database_url)
if '-pooler.' in url:
    raise RuntimeError('Migrations require DATABASE_URL_UNPOOLED')
if context.is_offline_mode():
    context.configure(url=url, target_metadata=Base.metadata, literal_binds=True,
                      version_table_schema=settings.database_schema if url.startswith('postgresql') else None)
    with context.begin_transaction():
        if url.startswith('postgresql'):
            context.execute('CREATE SCHEMA IF NOT EXISTS "' + settings.database_schema + '"')
            context.execute('SET search_path TO "' + settings.database_schema + '"')
        context.run_migrations()
else:
    with create_engine(url).connect() as connection:
        if url.startswith('postgresql'):
            connection.execute(text('CREATE SCHEMA IF NOT EXISTS "' + settings.database_schema + '"'))
            connection.execute(text('SET search_path TO "' + settings.database_schema + '"'))
            connection.commit()
        context.configure(connection=connection, target_metadata=Base.metadata,
                          version_table_schema=settings.database_schema if url.startswith('postgresql') else None)
        with context.begin_transaction():
            context.run_migrations()
