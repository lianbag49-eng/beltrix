import hashlib
import secrets
from datetime import timedelta, timezone
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from .db import get_db
from .models import Session, User, Audit, now
from .config import settings

hasher = PasswordHasher()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def verify(password, encoded):
    try:
        return hasher.verify(encoded, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def current_user(request: Request, db=Depends(get_db)):
    session = db.get(Session, digest(request.cookies.get('ourbit_session', '')))
    if not session or utc(session.expires_at) <= now():
        raise HTTPException(401, '로그인이 필요합니다.')
    user = db.get(User, session.user_id)
    if not user or not user.active:
        raise HTTPException(401, '계정이 비활성 상태입니다.')
    return user


def reviewer(user=Depends(current_user)):
    if user.role not in ('admin', 'reviewer'):
        raise HTTPException(403, '검토자 권한이 필요합니다.')
    return user


def audit(db, user, action, target):
    db.add(Audit(actor_id=user.id if user else None, action=action, target=str(target)))


def create_session(db, user, response):
    token = secrets.token_urlsafe(48)
    db.add(Session(token_hash=digest(token), user_id=user.id, expires_at=now()+timedelta(hours=8)))
    response.set_cookie('ourbit_session', token, httponly=True, secure=settings.app_env == 'production',
                        samesite='strict', max_age=28800, path='/')
