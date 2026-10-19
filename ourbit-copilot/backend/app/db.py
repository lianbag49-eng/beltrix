from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import settings, db_url

engine = create_engine(db_url(settings.database_url), pool_pre_ping=True,
                       connect_args={'check_same_thread': False} if settings.database_url.startswith('sqlite') else {})
if settings.database_url.startswith('sqlite'):
    @event.listens_for(engine, 'connect')
    def foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
else:
    @event.listens_for(engine, 'connect')
    def search_path(connection, _):
        with connection.cursor() as cursor:
            cursor.execute('SET search_path TO "' + settings.database_schema + '"')
        connection.commit()

SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    with SessionLocal() as session:
        yield session
