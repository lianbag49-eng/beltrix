from datetime import datetime, timezone
import httpx
from fastapi import HTTPException
from .config import settings


def parse_date(value):
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00')) if value else None
    except (ValueError, TypeError):
        return None


def analyze(description, videos, latest):
    corpus = (description + ' ' + ' '.join(v['title'] for v in videos)).lower()
    topics = [word for word in ['비트코인', '이더리움', '트레이딩', 'bitcoin', 'ethereum', 'crypto', 'defi'] if word in corpus]
    age = (datetime.now(timezone.utc) - latest).days if latest else None
    return {'method': '공개 텍스트 키워드 분석', 'topics': topics, 'activity_days': age,
            'freshness': 'unknown' if age is None else 'recent' if age <= 30 else 'inactive',
            'limitations': ['투자 성과·진성 구독자·협업 의향은 확인하지 않았습니다.',
                           '최근 게시일은 공개 업로드 목록의 확인 가능한 영상 기준입니다.']}


def discover(query: str):
    if not settings.youtube_api_key:
        raise HTTPException(503, 'YouTube API 연결이 필요합니다. 관리자에게 요청하세요.')
    with httpx.Client(timeout=12) as client:
        def get(resource, **params):
            try:
                response = client.get(f'https://www.googleapis.com/youtube/v3/{resource}',
                                      params={**params, 'key': settings.youtube_api_key})
                if response.status_code == 403:
                    raise HTTPException(503, 'YouTube 권한 또는 할당량을 확인하세요.')
                response.raise_for_status()
                return response.json()
            except (httpx.HTTPError, ValueError):
                raise HTTPException(502, 'YouTube 조회에 실패했습니다. 잠시 후 재시도하세요.') from None
        hits = get('search', part='snippet', type='channel', q=query, maxResults=5, relevanceLanguage='ko')
        ids = list(dict.fromkeys(item['id']['channelId'] for item in hits.get('items', [])))
        if not ids:
            return []
        channels = get('channels', part='snippet,statistics,contentDetails', id=','.join(ids))
        results = []
        for channel in channels.get('items', []):
            channel_id = channel['id']
            playlist = channel.get('contentDetails', {}).get('relatedPlaylists', {}).get('uploads')
            items = get('playlistItems', part='snippet,contentDetails', playlistId=playlist, maxResults=10).get('items', []) if playlist else []
            videos = []
            for item in items:
                detail = item.get('contentDetails', {})
                date = parse_date(detail.get('videoPublishedAt'))
                if date and date <= datetime.now(timezone.utc) and detail.get('videoId'):
                    videos.append({'title': item['snippet']['title'], 'published_at': date.isoformat(),
                                   'url': 'https://www.youtube.com/watch?v=' + detail['videoId']})
            latest = max((parse_date(v['published_at']) for v in videos), default=None)
            stats = channel.get('statistics', {})
            snippet = channel['snippet']
            description = snippet.get('description', '')[:5000]
            results.append({'channel_id': channel_id, 'title': snippet['title'][:200],
                            'description': description, 'source_url': 'https://www.youtube.com/channel/' + channel_id,
                            'subscribers': None if stats.get('hiddenSubscriberCount') else int(stats['subscriberCount']) if 'subscriberCount' in stats else None,
                            'latest_published_at': latest, 'videos': videos,
                            'analysis': analyze(description, videos, latest)})
        return results
