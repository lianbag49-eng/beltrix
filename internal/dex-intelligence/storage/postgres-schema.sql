-- BELTRIX Market Intelligence Phase 5
-- Server-side persistence schema for a future scheduled collector.
-- This file is not applied automatically.

create table if not exists mi_snapshots (
  id bigserial primary key,
  asset text not null,
  captured_at timestamptz not null,
  source text not null default 'collector',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists mi_snapshots_asset_captured_idx
  on mi_snapshots (asset, captured_at desc);

create table if not exists mi_venue_observations (
  id bigserial primary key,
  snapshot_id bigint not null references mi_snapshots(id) on delete cascade,
  venue text not null,
  ok boolean not null,
  health text,
  latency_ms integer,
  spread_bps double precision,
  depth_25_usd double precision,
  min_fill_ratio double precision,
  funding_rate double precision,
  open_interest double precision,
  open_interest_usd double precision,
  open_interest_unit text,
  volume_24h double precision,
  volume_24h_usd double precision,
  volume_24h_unit text,
  capacity_long_usd double precision,
  capacity_short_usd double precision,
  flags jsonb not null default '[]'::jsonb
);

create index if not exists mi_venue_observations_snapshot_idx
  on mi_venue_observations (snapshot_id);

create index if not exists mi_venue_observations_venue_idx
  on mi_venue_observations (venue);

create table if not exists mi_alert_events (
  id bigserial primary key,
  asset text not null,
  venue text not null,
  alert_key text not null,
  severity text not null check (severity in ('info','warning','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  message text not null,
  evidence jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null,
  last_seen_at timestamptz not null,
  resolved_at timestamptz
);

create unique index if not exists mi_alert_events_open_key_idx
  on mi_alert_events (asset, venue, alert_key)
  where status in ('open','acknowledged');

create table if not exists mi_bd_events (
  id bigserial primary key,
  venue text not null,
  event_type text not null,
  source text not null,
  priority text not null check (priority in ('low','medium','high')),
  title text not null,
  detail text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mi_bd_events_venue_created_idx
  on mi_bd_events (venue, created_at desc);
