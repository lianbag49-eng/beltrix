import os
os.environ['APP_ENV']='development'
os.environ['DATABASE_URL']='sqlite://'
os.environ['DATABASE_URL_UNPOOLED']=''
os.environ['WEB_ORIGIN']='http://localhost:3000'

import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base,get_db
from app.models import User,KOL,now
from app.security import hasher
from app.config import settings

PASSWORD='test-only-password-12345'


@pytest.fixture
def db():
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with sessionmaker(engine,expire_on_commit=False)() as session:
        for slot,role in [(1,'admin'),(2,'reviewer'),(3,'analyst')]:
            session.add(User(id=slot,email=f'test{slot}@example.test',name=f'Fixture {slot}',role=role,
                             password_hash=hasher.hash(PASSWORD),telegram_id=1000+slot))
        session.add(KOL(channel_id='UC_FIXTURE',title='테스트 전용 채널',description='비트코인 교육',subscribers=None,
                        source_url='https://www.youtube.com/channel/UC_FIXTURE',videos=[],verified_at=now(),
                        analysis={'topics':['비트코인'],'freshness':'unknown','method':'공개 텍스트 키워드 분석','limitations':[]}))
        session.commit()
        yield session
    engine.dispose()


@pytest.fixture
def client(db,monkeypatch):
    app.dependency_overrides[get_db]=lambda:db
    monkeypatch.setattr(settings,'gemini_api_key','')
    monkeypatch.setattr(settings,'gemini_model','')
    monkeypatch.setattr(settings,'youtube_api_key','')
    with TestClient(app,headers={'origin':'http://localhost:3000'}) as client:
        yield client
    app.dependency_overrides.clear()


def login(client,slot):
    response=client.post('/auth/login',json={'email':f'test{slot}@example.test','password':PASSWORD})
    assert response.status_code==200,response.text
