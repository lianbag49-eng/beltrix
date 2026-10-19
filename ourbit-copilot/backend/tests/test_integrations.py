from datetime import timedelta
import httpx
import pytest
from fastapi import HTTPException
from app import youtube,proposals
from app.models import KOL,now
from app.config import settings


def test_youtube_evidence_uses_uploads_date_and_hidden_subscribers(monkeypatch):
    calls=[]
    real_client=httpx.Client
    published=(now()-timedelta(days=1)).isoformat()
    def handler(request):
        calls.append(request)
        resource=request.url.path.split('/')[-1]
        payload={
          'search':{'items':[{'id':{'channelId':'UC_TEST'}},{'id':{'channelId':'UC_TEST'}}]},
          'channels':{'items':[{'id':'UC_TEST','snippet':{'title':'검증용','description':'비트코인'},'statistics':{'hiddenSubscriberCount':True,'subscriberCount':'999'},'contentDetails':{'relatedPlaylists':{'uploads':'UU_TEST'}}}]},
          'playlistItems':{'items':[{'snippet':{'title':'교육'},'contentDetails':{'videoId':'video1','videoPublishedAt':published}}]}
        }[resource]
        return httpx.Response(200,json=payload)
    monkeypatch.setattr(settings,'youtube_api_key','fake-youtube-key')
    monkeypatch.setattr(youtube.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    rows=youtube.discover('비트코인')
    assert len(rows)==1 and rows[0]['subscribers'] is None
    assert rows[0]['latest_published_at'].isoformat()==published
    assert rows[0]['videos'][0]['url']=='https://www.youtube.com/watch?v=video1'
    assert calls[2].url.params['playlistId']=='UU_TEST'
    assert calls[0].url.params['type']=='channel'


def test_youtube_provider_errors_do_not_leak_key(monkeypatch):
    real_client=httpx.Client
    monkeypatch.setattr(settings,'youtube_api_key','NEVER_RETURN_THIS')
    monkeypatch.setattr(youtube.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(lambda r:httpx.Response(403)),**kwargs))
    with pytest.raises(HTTPException) as error:
        youtube.discover('test')
    assert 'NEVER_RETURN_THIS' not in error.value.detail


def test_ai_output_constrained_to_verified_sentence_ids(db,monkeypatch):
    monkeypatch.setattr(settings,'gemini_api_key','fake-gemini-key')
    monkeypatch.setattr(settings,'gemini_model','test-model')
    monkeypatch.setattr(proposals.httpx,'post',lambda *args,**kwargs:httpx.Response(200,request=httpx.Request('POST','https://example.test'),json={'candidates':[{'content':{'parts':[{'text':'education'}]}}]}))
    body,generator=proposals.generate(db.get(KOL,1))
    assert proposals.safe_body(body) and generator=='gemini-intent-v1'


def test_ai_invented_promotion_is_rejected(db,monkeypatch):
    monkeypatch.setattr(settings,'gemini_api_key','fake-gemini-key')
    monkeypatch.setattr(settings,'gemini_model','test-model')
    monkeypatch.setattr(proposals.httpx,'post',lambda *args,**kwargs:httpx.Response(200,request=httpx.Request('POST','https://example.test'),json={'candidates':[{'content':{'parts':[{'text':'30% guaranteed return'}]}}]}))
    with pytest.raises(HTTPException):
        proposals.generate(db.get(KOL,1))


def test_bot_private_allowlist_secret_and_replay(client,monkeypatch):
    sent=[]
    monkeypatch.setattr(settings,'telegram_webhook_secret','test-secret')
    monkeypatch.setattr(settings,'telegram_bot_token','fake-bot-token')
    def send(*args,**kwargs):
        sent.append(kwargs['json'])
        return httpx.Response(200,request=httpx.Request('POST','https://example.test'),json={'ok':True})
    monkeypatch.setattr(httpx,'post',send)
    payload={'update_id':123,'message':{'from':{'id':1003},'chat':{'id':1003,'type':'private'},'text':'/pending'}}
    assert client.post('/telegram/webhook',json=payload).status_code==403
    headers={'x-telegram-bot-api-secret-token':'test-secret'}
    assert client.post('/telegram/webhook',headers=headers,json=payload).status_code==200
    assert len(sent)==1 and sent[0]['chat_id']==1003
    client.post('/telegram/webhook',headers=headers,json=payload)
    assert len(sent)==1
    payload['update_id']=124;payload['message']['chat']={'id':-100,'type':'group'}
    client.post('/telegram/webhook',headers=headers,json=payload)
    assert len(sent)==1
    payload['message']['from']['id']=999
    payload['message']['chat']={'id':999,'type':'private'}
    client.post('/telegram/webhook',headers=headers,json=payload)
    assert len(sent)==1
