# BELTRIX Growth Ingest API

Small dedicated write service for referral/campaign analytics.

## Endpoints
- `GET /healthz`
- `POST /events`

## Required environment
- `DATABASE_URL`
- `BELTRIX_ALLOWED_ORIGINS` — comma-separated frontend origins, e.g. `https://beltrix.trade,https://lianbag49-eng.github.io`
- `PORT` — defaults to 8080
- `BELTRIX_INGEST_KEY` — optional. If set, clients must send `X-Beltrix-Ingest-Key`.

## Build / run
```bash
pip install -r server/requirements.txt
python server/growth_ingest.py
```

Before production:
1. Apply `server/migrations/001_growth_events.sql` through a reviewed DB migration.
2. Put this service behind managed TLS/WAF/rate limits.
3. Configure only exact allowed origins.
4. Never put `DATABASE_URL` in the browser bundle.
5. Configure the frontend `beltrix-growth-endpoint` meta value to the HTTPS `/events` URL.

The endpoint is for attribution/analytics only. It must never receive wallet seeds,
private keys, exchange API secrets, signing payloads, or order credentials.
