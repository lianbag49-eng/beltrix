import httpx
from sqlalchemy import select,func
from app.models import Proposal
from app.config import settings
from app import proposals


def test_bot_draft_is_pending_and_replay_safe(client,db,monkeypatch):
    monkeypatch.setattr(settings,'telegram_webhook_secret','test-secret')
    monkeypatch.setattr(settings,'telegram_bot_token','fake-token')
    sent=[]
    def send(*args,**kwargs):
        sent.append(kwargs['json'])
        return httpx.Response(200,request=httpx.Request('POST','https://example.test'),json={'ok':True})
    monkeypatch.setattr(httpx,'post',send)
    payload={'update_id':902,'message':{'from':{'id':1003},'chat':{'id':1003,'type':'private'},'text':'/draft 1'}}
    headers={'x-telegram-bot-api-secret-token':'test-secret'}
    assert client.post('/telegram/webhook',json=payload,headers=headers).status_code==200
    proposal=db.scalar(select(Proposal))
    assert proposal.status=='pending' and proposal.author_id==3
    assert '검토 대기' in sent[0]['text'] and proposal.body not in sent[0]['text']
    client.post('/telegram/webhook',json=payload,headers=headers)
    assert db.scalar(select(func.count()).select_from(Proposal))==1
