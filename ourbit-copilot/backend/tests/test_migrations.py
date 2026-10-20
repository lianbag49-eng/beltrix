import os
from alembic.config import Config
from alembic import command
from sqlalchemy import create_engine,inspect
from app.config import settings


def test_initial_migration_and_idempotency(tmp_path,monkeypatch):
    url='sqlite:///'+str(tmp_path/'migration.db')
    monkeypatch.setattr(settings,'database_url',url)
    monkeypatch.setattr(settings,'database_url_unpooled','')
    command.upgrade(Config('alembic.ini'),'head')
    command.upgrade(Config('alembic.ini'),'head')
    engine=create_engine(url)
    tables=inspect(engine).get_table_names()
    assert {'users','sessions','kols','proposals','discoveries','audit_logs','telegram_updates','login_limits','alembic_version'} <= set(tables)
    assert inspect(engine).get_unique_constraints('kols')[0]['column_names']==['channel_id']
    engine.dispose()
