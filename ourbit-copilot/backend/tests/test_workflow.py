from datetime import timedelta
from sqlalchemy import select
from app.models import User,KOL,Proposal,Discovery,Audit,now
from app.config import settings
from app import youtube
from app.proposals import safe_body
from conftest import login,PASSWORD


def test_auth_and_csrf(client):
    assert client.get('/kols').status_code==401
    assert client.post('/auth/login',headers={'origin':'https://evil.example'},json={'email':'a@b.c','password':'x'}).status_code==403
    login(client,3)
    assert client.get('/auth/me').json()['role']=='analyst'
    assert client.get('/audit').status_code==403
    assert client.post('/auth/logout').status_code==200
    assert client.get('/kols').status_code==401


def test_login_limit_and_secret_redaction(client):
    for _ in range(5):
        assert client.post('/auth/login',json={'email':'unknown@example.test','password':'bad'}).status_code==401
    assert client.post('/auth/login',json={'email':'unknown@example.test','password':'bad'}).status_code==429
    result=client.post('/auth/bootstrap',json={'token':'SENSITIVE_TOKEN','password':'SECRET'})
    assert result.status_code==422
    assert 'SENSITIVE_TOKEN' not in result.text and 'SECRET' not in result.text


def test_review_requires_another_staff_and_role(client):
    login(client,3)
    proposal=client.post('/kols/1/proposals').json()
    assert 'AI 미연결' in proposal['generator']
    pid=proposal['id']
    assert client.post(f'/proposals/{pid}/copy').status_code==409
    assert client.post(f'/proposals/{pid}/review',json={'version':1,'decision':'approved'}).status_code==403
    login(client,2)
    assert client.post(f'/proposals/{pid}/review',json={'version':1,'decision':'approved'}).status_code==200
    assert client.post(f'/proposals/{pid}/review',json={'version':1,'decision':'approved'}).status_code==409
    response=client.post(f'/proposals/{pid}/copy')
    assert response.status_code==200
    assert safe_body(response.json()['body'])


def test_admin_cannot_self_approve(client):
    login(client,1)
    pid=client.post('/kols/1/proposals').json()['id']
    assert client.post(f'/proposals/{pid}/review',json={'version':1,'decision':'approved'}).status_code==403


def test_unapproved_claims_and_old_sources_blocked(client,db):
    login(client,3)
    pid=client.post('/kols/1/proposals').json()['id']
    p=db.get(Proposal,pid)
    p.body='확정 수익 30%, 내일 상장됩니다.'
    db.commit()
    login(client,2)
    assert client.post(f'/proposals/{pid}/review',json={'version':1,'decision':'approved'}).status_code==422
    db.get(KOL,1).verified_at=now()-timedelta(days=31)
    db.commit()
    assert client.post('/kols/1/proposals').status_code==409


def test_expired_approval_cannot_copy(client,db):
    login(client,3)
    pid=client.post('/kols/1/proposals').json()['id']
    login(client,2)
    client.post(f'/proposals/{pid}/review',json={'version':1,'decision':'approved'})
    db.get(Proposal,pid).reviewed_at=now()-timedelta(days=8)
    db.commit()
    assert client.post(f'/proposals/{pid}/copy').status_code==409


def test_discovery_duplicate_refresh_preserves_crm(client,db,monkeypatch):
    row={'channel_id':'UC_FIXTURE','title':'갱신 채널','description':'bitcoin','subscribers':None,
         'source_url':'https://www.youtube.com/channel/UC_FIXTURE','latest_published_at':None,
         'videos':[],'analysis':{'topics':['bitcoin'],'freshness':'unknown'}}
    monkeypatch.setattr(youtube,'discover',lambda query:[row])
    login(client,3)
    client.patch('/kols/1',json={'owner_id':3,'stage':'researching','notes':'검토 유지'})
    result=client.post('/discovery',json={'query':'비트코인'})
    assert result.status_code==200,result.text
    assert result.json()['duplicates']==1 and result.json()['created']==0
    kol=client.get('/kols/1').json()
    assert kol['subscribers'] is None and kol['notes']=='검토 유지' and kol['owner_id']==3
    assert client.post('/discovery',json={'query':'비트코인'}).status_code==429
    assert len(client.get('/discoveries').json())==1


def test_missing_youtube_is_explicit(client):
    login(client,3)
    assert client.post('/discovery',json={'query':'비트코인'}).status_code==503


def test_new_channel_insert(client,monkeypatch):
    monkeypatch.setattr(youtube,'discover',lambda query:[{'channel_id':'UC_NEW','title':'새 후보','description':'',
        'subscribers':3,'source_url':'https://www.youtube.com/channel/UC_NEW','latest_published_at':None,'videos':[],
        'analysis':{'topics':[],'freshness':'unknown'}}])
    login(client,1)
    result=client.post('/discovery',json={'query':'교육'})
    assert result.status_code==200,result.text
    assert result.json()['created']==1
    assert len(client.get('/kols').json())==2


def test_provision_roles_slots_and_session_revocation(client,db):
    data={'email':'replacement@example.test','name':'직원','password':PASSWORD,'role':'reviewer'}
    login(client,3)
    assert client.put('/users/2',json=data).status_code==403
    login(client,1)
    assert client.put('/users/4',json=data).status_code==422
    assert client.put('/users/2',json=data).status_code==200
    assert db.get(User,2).email==data['email']
    assert client.put('/users/1',json={**data,'email':'test1@example.test','role':'analyst'}).status_code==409


def test_bootstrap_once_and_no_default_credentials(client,db,monkeypatch):
    monkeypatch.setattr(settings,'bootstrap_token','a-test-only-bootstrap-token')
    data={'email':'first@example.test','name':'관리자','password':PASSWORD,'token':'a-test-only-bootstrap-token'}
    assert client.post('/auth/bootstrap',json=data).status_code==409
    assert client.post('/auth/bootstrap',json={**data,'token':'wrong'}).status_code==403


def test_copy_is_audited(client,db):
    login(client,3)
    pid=client.post('/kols/1/proposals').json()['id']
    login(client,1)
    client.post(f'/proposals/{pid}/review',json={'version':1,'decision':'approved'})
    client.post(f'/proposals/{pid}/copy')
    assert db.scalar(select(Audit).where(Audit.action=='proposal.copy')).target==str(pid)
