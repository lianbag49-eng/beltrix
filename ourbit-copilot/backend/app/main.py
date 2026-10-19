import secrets
from datetime import timedelta
from typing import Literal
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from sqlalchemy import select, func, update
from sqlalchemy.exc import IntegrityError
from .config import settings
from .db import get_db
from .models import User, Session, KOL, Proposal, Discovery, LoginLimit, Audit, TelegramUpdate, now
from .security import current_user, reviewer, audit, create_session, digest, verify, utc, DUMMY_HASH, hasher
from . import youtube, proposals, ai_profile
import httpx

app = FastAPI(title='Ourbit BD AI Copilot', version='1.0.0', docs_url='/docs' if settings.app_env != 'production' else None)


@app.exception_handler(RequestValidationError)
async def invalid_input(request, error):
    return JSONResponse({'detail':'입력 형식과 필수 항목을 확인하세요.'},status_code=422)


@app.middleware('http')
async def secure_requests(request, call_next):
    if request.method in ('POST', 'PUT', 'PATCH', 'DELETE') and request.url.path != '/telegram/webhook':
        if request.headers.get('origin') != settings.web_origin:
            return JSONResponse({'detail': '허용되지 않은 요청 출처입니다.'}, status_code=403)
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    return response


class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class SearchInput(BaseModel):
    query: str = Field(min_length=2, max_length=100)


class StaffInput(BaseModel):
    email: str = Field(min_length=3, max_length=254, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=14, max_length=256)
    role: Literal['admin','reviewer','analyst'] = 'analyst'
    telegram_id: int | None = Field(default=None, gt=0)


class BootstrapInput(StaffInput):
    token: str = Field(min_length=1, max_length=256)


def admin_user(user=Depends(current_user)):
    if user.role != 'admin':
        raise HTTPException(403, '관리자 권한이 필요합니다.')
    return user


@app.post('/auth/bootstrap')
def bootstrap(data: BootstrapInput, response: Response, db=Depends(get_db)):
    if not settings.bootstrap_token or not secrets.compare_digest(data.token, settings.bootstrap_token):
        raise HTTPException(403, '초기 설정 코드를 확인하세요.')
    if db.scalar(select(User.id).limit(1)):
        raise HTTPException(409, '초기 계정 설정이 완료된 워크룸입니다.')
    user = User(id=1, email=data.email.strip().lower(), name=data.name, role='admin',
                password_hash=hasher.hash(data.password), telegram_id=data.telegram_id)
    db.add(user)
    try:
        db.flush()
        create_session(db,user,response)
        audit(db,user,'staff.bootstrap',1)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,'초기 계정 설정이 완료되었거나 중복된 정보입니다.') from None
    return public_user(user)


@app.put('/users/{slot}')
def provision(slot:int, data:StaffInput, user=Depends(admin_user), db=Depends(get_db)):
    if slot not in (1,2,3):
        raise HTTPException(422,'직원 계정은 3개까지 등록할 수 있습니다.')
    employee = db.get(User,slot)
    if not employee:
        employee=User(id=slot)
        db.add(employee)
    if slot == user.id and data.role != 'admin':
        raise HTTPException(409,'현재 관리자의 권한은 유지해야 합니다.')
    employee.email,employee.name,employee.role=data.email.strip().lower(),data.name,data.role
    employee.password_hash,employee.telegram_id,employee.active=hasher.hash(data.password),data.telegram_id,True
    for session in db.scalars(select(Session).where(Session.user_id==slot)):
        db.delete(session)
    audit(db,user,'staff.provision',slot)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,'이메일 또는 Telegram ID가 다른 직원과 중복됩니다.') from None
    return public_user(employee)


class KOLInput(BaseModel):
    owner_id: int | None = Field(default=None, ge=1, le=3)
    stage: Literal['new', 'researching', 'contacted', 'negotiating', 'closed']
    notes: str = Field(default='', max_length=5000)


class ReviewInput(BaseModel):
    version: int = Field(ge=1)
    decision: Literal['approved', 'rejected']
    note: str = Field(default='', max_length=1000)


def public_user(user):
    return {'id': user.id, 'name': user.name, 'role': user.role}


def require_kol(db, kol_id):
    kol = db.get(KOL, kol_id)
    if not kol:
        raise HTTPException(404, 'KOL을 찾을 수 없습니다.')
    return kol


def public_kol(kol):
    return {key: getattr(kol, key) for key in ('id','channel_id','title','description','subscribers','source_url',
            'latest_published_at','verified_at','videos','analysis','owner_id','stage','notes')}


def public_proposal(p):
    return {key: getattr(p, key) for key in ('id','kol_id','author_id','body','generator','status','version','reviewed_by','reviewed_at','review_note','created_at')}


@app.get('/healthz')
def health():
    return {'status': 'ok'}


@app.get('/readyz')
def ready(db=Depends(get_db)):
    db.execute(select(User.id).limit(1))
    return {'status': 'ready'}


@app.post('/auth/login')
def login(data: LoginInput, response: Response, db=Depends(get_db)):
    email = data.email.strip().lower()
    key = digest(email)
    # DB-backed throttling survives process restarts. Unknown emails use the same path.
    dialect_insert = __import__('sqlalchemy.dialects.postgresql' if db.bind.dialect.name == 'postgresql' else 'sqlalchemy.dialects.sqlite', fromlist=['insert']).insert
    db.execute(dialect_insert(LoginLimit).values(key=key, attempts=0, resets_at=now()+timedelta(minutes=15)).on_conflict_do_nothing(index_elements=['key']))
    limit = db.scalar(select(LoginLimit).where(LoginLimit.key == key).with_for_update())
    if utc(limit.resets_at) < now():
        limit.attempts, limit.resets_at = 0, now()+timedelta(minutes=15)
    if limit.attempts >= 5:
        db.rollback()
        raise HTTPException(429, '로그인 시도가 많습니다. 15분 후 다시 시도하세요.')
    limit.attempts += 1
    user = db.scalar(select(User).where(User.email == email))
    valid = verify(data.password, user.password_hash if user else DUMMY_HASH)
    if not valid or not user or not user.active:
        db.commit()
        raise HTTPException(401, '이메일 또는 비밀번호를 확인하세요.')
    limit.attempts = 0
    create_session(db, user, response)
    audit(db, user, 'login', user.id)
    db.commit()
    return public_user(user)


@app.post('/auth/logout')
def logout(request: Request, response: Response, db=Depends(get_db)):
    session = db.get(Session, digest(request.cookies.get('ourbit_session', '')))
    if session:
        db.delete(session)
        db.commit()
    response.delete_cookie('ourbit_session', path='/')
    return {'ok': True}


@app.get('/auth/me')
def me(user=Depends(current_user)):
    return public_user(user)


@app.get('/users')
def users(user=Depends(current_user), db=Depends(get_db)):
    return [public_user(u) for u in db.scalars(select(User).where(User.active == True).order_by(User.id))]


@app.get('/integrations')
def integrations(user=Depends(current_user)):
    return {'youtube': bool(settings.youtube_api_key), 'telegram': bool(settings.telegram_bot_token and settings.telegram_webhook_secret),
            'ai': bool(settings.gemini_api_key and settings.gemini_model), 'outbound': 'manual_only'}


@app.post('/discovery')
def discovery(data: SearchInput, user=Depends(current_user), db=Depends(get_db)):
    query = data.query.strip()
    if len(query) < 2:
        raise HTTPException(422, '검색어를 두 글자 이상 입력하세요.')
    # At most one completed discovery per staff member per minute.
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    recent = db.scalar(select(Discovery.id).where(Discovery.created_by == user.id, Discovery.created_at > now()-timedelta(minutes=1)))
    if recent:
        raise HTTPException(429, '잠시 후 다시 발굴하세요. 이전 결과는 목록에서 확인할 수 있습니다.')
    rows = youtube.discover(query)
    created, duplicates, ids = 0, 0, []
    dialect_insert = __import__('sqlalchemy.dialects.postgresql' if db.bind.dialect.name == 'postgresql' else 'sqlalchemy.dialects.sqlite', fromlist=['insert']).insert
    for row in rows:
        values = {**row, 'verified_at': now()}
        inserted = db.execute(dialect_insert(KOL).values(**values, stage='new', notes='').on_conflict_do_nothing(index_elements=['channel_id']).returning(KOL.id)).scalar_one_or_none()
        if inserted is None:
            duplicates += 1
            db.execute(update(KOL).where(KOL.channel_id == row['channel_id']).values(**values))
            inserted = db.scalar(select(KOL.id).where(KOL.channel_id == row['channel_id']))
        else:
            created += 1
        ids.append(inserted)
    result = {'created': created, 'duplicates': duplicates, 'ids': ids, 'scope': '검색 상위 최대 5개 채널; 채널별 공개 업로드 최대 10개'}
    db.add(Discovery(query=query, created_by=user.id, result=result))
    audit(db, user, 'discovery', query)
    db.commit()
    return result


@app.get('/discoveries')
def history(user=Depends(current_user), db=Depends(get_db)):
    return [{'id': d.id, 'query': d.query, 'created_at': d.created_at, 'result': d.result} for d in db.scalars(select(Discovery).order_by(Discovery.id.desc()).limit(20))]


@app.get('/kols')
def list_kols(q: str = '', offset: int = 0, user=Depends(current_user), db=Depends(get_db)):
    stmt = select(KOL).order_by(KOL.verified_at.desc()).offset(max(0, offset)).limit(100)
    if q:
        stmt = stmt.where(KOL.title.ilike('%' + q[:100].replace('%', '').replace('_', '') + '%'))
    return [public_kol(k) for k in db.scalars(stmt)]


@app.get('/kols/{kol_id}')
def kol_detail(kol_id: int, user=Depends(current_user), db=Depends(get_db)):
    return public_kol(require_kol(db, kol_id))


@app.patch('/kols/{kol_id}')
def update_kol(kol_id: int, data: KOLInput, user=Depends(current_user), db=Depends(get_db)):
    kol = require_kol(db, kol_id)
    if data.owner_id:
        owner = db.get(User, data.owner_id)
        if not owner or not owner.active:
            raise HTTPException(422, '담당자를 확인하세요.')
    for key, value in data.model_dump().items():
        setattr(kol, key, value)
    audit(db, user, 'kol.update', kol_id)
    db.commit()
    return public_kol(kol)


@app.post('/kols/{kol_id}/proposals')
def create_proposal(kol_id: int, user=Depends(current_user), db=Depends(get_db)):
    kol = require_kol(db, kol_id)
    if now() - utc(kol.verified_at) > timedelta(days=30):
        raise HTTPException(409, '출처 확인 후 30일이 지났습니다. 다시 발굴해 최신 정보를 확인하세요.')
    body, generator = proposals.generate(kol)
    p = Proposal(kol_id=kol_id, author_id=user.id, body=body, generator=generator)
    db.add(p)
    db.flush()
    audit(db, user, 'proposal.create', p.id)
    db.commit()
    return public_proposal(p)


@app.post('/kols/{kol_id}/analyze')
def analyze_profile(kol_id:int,user=Depends(current_user),db=Depends(get_db)):
    kol=require_kol(db,kol_id)
    if now()-utc(kol.verified_at)>timedelta(days=30):
        raise HTTPException(409,'공개 출처를 다시 확인한 뒤 AI 분석을 실행하세요.')
    kol.analysis=ai_profile.analyze(kol)
    audit(db,user,'kol.ai_analyze',kol_id)
    db.commit()
    return public_kol(kol)


@app.get('/proposals')
def list_proposals(user=Depends(current_user), db=Depends(get_db)):
    return [public_proposal(p) for p in db.scalars(select(Proposal).order_by(Proposal.id.desc()).limit(100))]


@app.post('/proposals/{proposal_id}/review')
def review(proposal_id: int, data: ReviewInput, user=Depends(reviewer), db=Depends(get_db)):
    p = db.scalar(select(Proposal).where(Proposal.id == proposal_id).with_for_update())
    if not p:
        raise HTTPException(404, '제안문을 찾을 수 없습니다.')
    if p.author_id == user.id:
        raise HTTPException(403, '다른 직원이 작성한 제안문만 검토할 수 있습니다.')
    if p.version != data.version or p.status != 'pending':
        raise HTTPException(409, '이미 처리된 제안문입니다. 목록을 새로고침하세요.')
    if data.decision == 'approved' and not proposals.safe_body(p.body):
        raise HTTPException(422, '확인되지 않은 조건이 포함된 문구는 승인할 수 없습니다.')
    p.status, p.reviewed_by, p.reviewed_at, p.review_note = data.decision, user.id, now(), data.note
    p.version += 1
    audit(db, user, 'proposal.' + data.decision, proposal_id)
    db.commit()
    return public_proposal(p)


@app.post('/proposals/{proposal_id}/copy')
def copy_proposal(proposal_id: int, user=Depends(current_user), db=Depends(get_db)):
    p = db.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(404, '제안문을 찾을 수 없습니다.')
    kol = require_kol(db, p.kol_id)
    if p.status != 'approved' or not proposals.safe_body(p.body):
        raise HTTPException(409, '승인된 문구만 복사할 수 있습니다.')
    if not p.reviewed_at or now()-utc(p.reviewed_at) > timedelta(days=7) or now()-utc(kol.verified_at) > timedelta(days=30):
        raise HTTPException(409, '승인 또는 출처 확인이 오래되었습니다. 새 제안문을 검토하세요.')
    audit(db, user, 'proposal.copy', proposal_id)
    db.commit()
    return {'body': p.body, 'delivery': '직원이 기존 계정에서 직접 발송하세요.'}


@app.get('/audit')
def audits(user=Depends(reviewer), db=Depends(get_db)):
    return [{'id': a.id, 'actor_id': a.actor_id, 'action': a.action, 'target': a.target, 'created_at': a.created_at}
            for a in db.scalars(select(Audit).order_by(Audit.id.desc()).limit(100))]


@app.post('/telegram/webhook')
def telegram(request: Request, payload: dict, db=Depends(get_db)):
    expected = settings.telegram_webhook_secret
    if not expected or not secrets.compare_digest(request.headers.get('x-telegram-bot-api-secret-token', ''), expected):
        raise HTTPException(403, 'Invalid webhook')
    message = payload.get('message', {})
    sender = message.get('from', {})
    chat = message.get('chat', {})
    user = db.scalar(select(User).where(User.telegram_id == sender.get('id'), User.active == True)) if sender.get('id') else None
    if not user or sender.get('is_bot') or chat.get('type') != 'private' or chat.get('id') != user.telegram_id:
        return {'ok': True}
    update_id = payload.get('update_id')
    if not isinstance(update_id, int):
        raise HTTPException(422, 'update_id required')
    try:
        db.add(TelegramUpdate(update_id=update_id))
        db.flush()
    except IntegrityError:
        db.rollback()
        return {'ok': True}
    command = message.get('text', '').strip()
    if command == '/pending':
        count = db.scalar(select(func.count()).select_from(Proposal).where(Proposal.status == 'pending'))
        reply = f'검토 대기 제안문: {count}건\n' + settings.web_origin
    elif command.startswith('/kol '):
        term = command[5:105]
        matches = db.scalars(select(KOL).where(KOL.title.ilike('%'+term.replace('%','').replace('_','')+'%')).limit(5)).all()
        reply = '\n\n'.join(k.title + '\n' + k.source_url for k in matches) or '저장된 KOL이 없습니다. 웹 CRM에서 공개 채널을 발굴하세요.'
    else:
        reply = 'Ourbit 내부 도우미\n/kol 검색어 — 저장된 KOL 조회\n/pending — 검토 대기 수\n발굴·제안 생성·승인: ' + settings.web_origin + '\n대외 메시지는 기존 계정에서 직접 발송하세요.'
    if not settings.telegram_bot_token:
        raise HTTPException(503, 'Telegram 연결이 필요합니다.')
    try:
        result = httpx.post(f'https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage',
                            json={'chat_id': user.telegram_id, 'text': reply[:4000], 'link_preview_options': {'is_disabled': True}}, timeout=10)
        result.raise_for_status()
        if not result.json().get('ok'):
            raise ValueError('Telegram rejected message')
    except (httpx.HTTPError, ValueError):
        db.rollback()
        raise HTTPException(502, 'Telegram 응답 실패') from None
    audit(db, user, 'telegram.command', command.split(' ')[0][:30])
    db.commit()
    return {'ok': True}
