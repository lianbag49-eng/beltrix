import httpx
import pytest
from fastapi import HTTPException
from app import ai_profile
from app.models import KOL,now
from app.config import settings


def test_profile_requires_evidence_and_preserves_exact_source(db,monkeypatch):
    kol=db.get(KOL,1)
    kol.videos=[{'title':'비트코인 교육','url':'https://www.youtube.com/watch?v=fixture','published_at':now().isoformat()}]
    monkeypatch.setattr(settings,'gemini_api_key','fake')
    monkeypatch.setattr(settings,'gemini_model','test-model')
    monkeypatch.setattr(httpx,'post',lambda *a,**k:httpx.Response(200,request=httpx.Request('POST','https://example.test'),json={'candidates':[{'content':{'parts':[{'text':'{"category":"education","evidence_video_indices":[0]}'}]}}]}))
    result=ai_profile.analyze(kol)
    assert result['ai']['evidence'][0]['url']==kol.videos[0]['url']
    assert result['ai']['label']=='교육'


def test_profile_invalid_source_index_rejected(db,monkeypatch):
    monkeypatch.setattr(settings,'gemini_api_key','fake')
    monkeypatch.setattr(settings,'gemini_model','test-model')
    monkeypatch.setattr(httpx,'post',lambda *a,**k:httpx.Response(200,request=httpx.Request('POST','https://example.test'),json={'candidates':[{'content':{'parts':[{'text':'{"category":"education","evidence_video_indices":[9]}'}]}}]}))
    with pytest.raises(HTTPException):ai_profile.analyze(db.get(KOL,1))
