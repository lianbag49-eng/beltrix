#!/usr/bin/env python3
"""BELTRIX growth/referral event ingest service.

Environment:
  DATABASE_URL              PostgreSQL connection string (required)
  PORT                      HTTP port (default 8080)
  BELTRIX_ALLOWED_ORIGINS   comma-separated HTTPS origins
  BELTRIX_INGEST_KEY        optional project key; if set, X-Beltrix-Ingest-Key must match

This endpoint accepts analytics/attribution events only. It does not accept wallet
secrets, API credentials, orders, signatures, or private keys.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import psycopg

MAX_BODY = 256 * 1024
MAX_EVENTS = 100
EVENT_ID = re.compile(r"^evt_[0-9a-f]{8,64}$")
EVENT_TYPE = re.compile(r"^[a-z][a-z0-9_]{1,47}$")
SENSITIVE = re.compile(r"(secret|private.?key|api.?key|seed|password|token|cookie|session)", re.I)

def clean_value(value, depth=0):
    if depth > 6:
        return None
    if isinstance(value, dict):
        out = {}
        for key, val in list(value.items())[:100]:
            if SENSITIVE.search(str(key)):
                continue
            out[str(key)[:96]] = clean_value(val, depth + 1)
        return out
    if isinstance(value, list):
        return [clean_value(x, depth + 1) for x in value[:100]]
    if isinstance(value, str):
        return value[:1024]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return str(value)[:1024]

def text(value, limit=96):
    if value is None:
        return None
    value = str(value).strip()
    return value[:limit] or None

def number(value):
    try:
        n = float(value)
        return n if n == n and abs(n) != float("inf") else None
    except (TypeError, ValueError):
        return None

def event_time(value):
    try:
        ms = int(value)
        if ms <= 0:
            raise ValueError
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return datetime.now(timezone.utc)

def normalize_event(raw):
    event = clean_value(raw if isinstance(raw, dict) else {})
    event_id = text(event.get("eventId"), 80)
    event_type = text(event.get("type"), 48)
    if not event_id or not EVENT_ID.fullmatch(event_id):
        raise ValueError("invalid eventId")
    if not event_type or not EVENT_TYPE.fullmatch(event_type):
        raise ValueError("invalid event type")

    attribution = event.get("attribution") if isinstance(event.get("attribution"), dict) else {}
    return {
        "event_id": event_id,
        "event_type": event_type,
        "occurred_at": event_time(event.get("at")),
        "anonymous_id": text(event.get("anonymousId")),
        "user_id": text(event.get("userId")),
        "wallet_id": text(event.get("walletId")),
        "referral_id": text(event.get("referralId") or attribution.get("referral")),
        "creator_id": text(event.get("creatorId")),
        "campaign_id": text(event.get("campaignId") or attribution.get("campaign")),
        "region": text(event.get("region") or attribution.get("region"), 32),
        "language": text(event.get("language") or attribution.get("language"), 16),
        "source": text(event.get("source") or attribution.get("source"), 32),
        "medium": text(event.get("medium") or attribution.get("medium"), 32),
        "venue": text(event.get("venue"), 32),
        "market": text(event.get("market"), 64),
        "volume_usd": number(event.get("volumeUsd") if "volumeUsd" in event else event.get("volume")),
        "fee_revenue_usd": number(event.get("feeRevenueUsd")),
        "payload": event,
    }

INSERT_SQL = """
insert into beltrix.growth_events (
  event_id,event_type,occurred_at,anonymous_id,user_id,wallet_id,
  referral_id,creator_id,campaign_id,region,language,source,medium,
  venue,market,volume_usd,fee_revenue_usd,payload
) values (
  %(event_id)s,%(event_type)s,%(occurred_at)s,%(anonymous_id)s,%(user_id)s,%(wallet_id)s,
  %(referral_id)s,%(creator_id)s,%(campaign_id)s,%(region)s,%(language)s,%(source)s,%(medium)s,
  %(venue)s,%(market)s,%(volume_usd)s,%(fee_revenue_usd)s,%(payload)s::jsonb
)
on conflict (event_id) do nothing
"""

class Handler(BaseHTTPRequestHandler):
    server_version = "BELTRIXGrowth/0.1"

    def log_message(self, fmt, *args):
        # Avoid writing request bodies or credentials to stdout.
        print("%s - %s" % (self.address_string(), fmt % args))

    def _origin(self):
        return self.headers.get("Origin")

    def _origin_allowed(self):
        origin = self._origin()
        if not origin:
            return True
        allowed = self.server.allowed_origins
        return origin in allowed

    def _cors(self):
        origin = self._origin()
        if origin and origin in self.server.allowed_origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Beltrix-Ingest-Key")
            self.send_header("Access-Control-Max-Age", "600")

    def _json(self, status, body):
        payload = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        if not self._origin_allowed():
            return self._json(403, {"error": "origin_not_allowed"})
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if urlparse(self.path).path != "/healthz":
            return self._json(404, {"error": "not_found"})
        try:
            with psycopg.connect(self.server.database_url, connect_timeout=5) as conn:
                with conn.cursor() as cur:
                    cur.execute("select 1")
                    cur.fetchone()
            return self._json(200, {"ok": True})
        except Exception:
            return self._json(503, {"ok": False})

    def do_POST(self):
        if urlparse(self.path).path != "/events":
            return self._json(404, {"error": "not_found"})
        if not self._origin_allowed():
            return self._json(403, {"error": "origin_not_allowed"})
        if self.server.ingest_key:
            supplied = self.headers.get("X-Beltrix-Ingest-Key", "")
            if supplied != self.server.ingest_key:
                return self._json(401, {"error": "invalid_ingest_key"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self._json(400, {"error": "invalid_content_length"})
        if size <= 0 or size > MAX_BODY:
            return self._json(413, {"error": "payload_too_large"})
        try:
            body = json.loads(self.rfile.read(size))
        except Exception:
            return self._json(400, {"error": "invalid_json"})
        if body.get("version") != 1 or not isinstance(body.get("events"), list):
            return self._json(400, {"error": "invalid_envelope"})
        if not body["events"] or len(body["events"]) > MAX_EVENTS:
            return self._json(400, {"error": "invalid_event_count"})
        try:
            events = [normalize_event(x) for x in body["events"]]
        except ValueError as exc:
            return self._json(400, {"error": str(exc)})

        inserted = 0
        try:
            with psycopg.connect(self.server.database_url, connect_timeout=5) as conn:
                with conn.cursor() as cur:
                    for event in events:
                        params = dict(event)
                        params["payload"] = json.dumps(event["payload"], separators=(",", ":"))
                        cur.execute(INSERT_SQL, params)
                        inserted += max(cur.rowcount, 0)
                conn.commit()
        except Exception as exc:
            print("database error:", type(exc).__name__)
            return self._json(503, {"error": "database_unavailable"})
        return self._json(202, {"accepted": len(events), "inserted": inserted})

def allowed_origins():
    raw = os.getenv("BELTRIX_ALLOWED_ORIGINS", "")
    out = set()
    for item in raw.split(","):
        value = item.strip().rstrip("/")
        if not value:
            continue
        parsed = urlparse(value)
        if parsed.scheme == "https" and parsed.netloc:
            out.add(value)
        elif parsed.hostname in {"localhost", "127.0.0.1"}:
            out.add(value)
    return out

def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")
    port = int(os.getenv("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    server.database_url = database_url
    server.allowed_origins = allowed_origins()
    server.ingest_key = os.getenv("BELTRIX_INGEST_KEY", "")
    print(f"BELTRIX growth ingest listening on :{port}; origins={len(server.allowed_origins)}")
    server.serve_forever()

if __name__ == "__main__":
    main()
