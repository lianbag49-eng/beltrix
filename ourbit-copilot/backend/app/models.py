from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, BigInteger, DateTime, ForeignKey, JSON, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = 'users'
    __table_args__ = (CheckConstraint('id BETWEEN 1 AND 3'), CheckConstraint("role IN ('admin','reviewer','analyst')"))
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(default=True)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)


class Session(Base):
    __tablename__ = 'sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LoginLimit(Base):
    __tablename__ = 'login_limits'
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    attempts: Mapped[int] = mapped_column(default=0)
    resets_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class KOL(Base):
    __tablename__ = 'kols'
    id: Mapped[int] = mapped_column(primary_key=True)
    channel_id: Mapped[str] = mapped_column(String(64), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    subscribers: Mapped[int | None] = mapped_column(BigInteger)
    source_url: Mapped[str] = mapped_column(Text)
    latest_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    videos: Mapped[list] = mapped_column(JSON)
    analysis: Mapped[dict] = mapped_column(JSON)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'))
    stage: Mapped[str] = mapped_column(String(20), default='new')
    notes: Mapped[str] = mapped_column(Text, default='')


class Discovery(Base):
    __tablename__ = 'discoveries'
    id: Mapped[int] = mapped_column(primary_key=True)
    query: Mapped[str] = mapped_column(String(100))
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    result: Mapped[dict] = mapped_column(JSON)


class Proposal(Base):
    __tablename__ = 'proposals'
    id: Mapped[int] = mapped_column(primary_key=True)
    kol_id: Mapped[int] = mapped_column(ForeignKey('kols.id'))
    author_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    body: Mapped[str] = mapped_column(Text)
    generator: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), default='pending')
    version: Mapped[int] = mapped_column(default=1)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey('users.id'))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_note: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Audit(Base):
    __tablename__ = 'audit_logs'
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey('users.id'))
    action: Mapped[str] = mapped_column(String(80))
    target: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class TelegramUpdate(Base):
    __tablename__ = 'telegram_updates'
    update_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
