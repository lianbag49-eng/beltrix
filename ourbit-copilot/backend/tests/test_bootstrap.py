from sqlalchemy import delete
from app.models import User,KOL
from app.config import settings
from conftest import PASSWORD


def test_first_admin_can_register_and_registration_then_closes(client,db,monkeypatch):
    # Only the isolated test database is cleared; no production connection is used.
    db.execute(delete(KOL));db.execute(delete(User));db.commit()
    monkeypatch.setattr(settings,'bootstrap_token','test-only-initial-setup-code')
    payload={'email':'FIRST@example.test','name':'첫 관리자','password':PASSWORD,
             'token':'test-only-initial-setup-code','role':'analyst'}
    response=client.post('/auth/bootstrap',json=payload)
    assert response.status_code==200,response.text
    assert response.json()['role']=='admin'
    assert client.get('/auth/me').json()['role']=='admin'
    assert db.get(User,1).email=='first@example.test'
    assert 'HttpOnly' in response.headers['set-cookie']
    assert PASSWORD not in response.text and payload['token'] not in response.text
    assert client.post('/auth/bootstrap',json=payload).status_code==409


def test_unconfigured_setup_is_distinct_from_wrong_code(client,monkeypatch):
    payload={'email':'first@example.test','name':'첫 관리자','password':PASSWORD,'token':'wrong'}
    monkeypatch.setattr(settings,'bootstrap_token','')
    response=client.post('/auth/bootstrap',json=payload)
    assert response.status_code==503
    assert '서버에 초기 설정 코드' in response.json()['detail']
    monkeypatch.setattr(settings,'bootstrap_token','test-only-initial-setup-code')
    response=client.post('/auth/bootstrap',json=payload)
    assert response.status_code==403
    assert '일치하지 않습니다' in response.json()['detail']
