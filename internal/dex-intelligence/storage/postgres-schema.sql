
create table if not exists mi_collector_runs (
  id bigserial primary key,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  successful_assets integer not null check (successful_assets >= 0),
  failed_assets integer not null check (failed_assets >= 0),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists mi_collector_runs_finished_idx
  on mi_collector_runs (finished_at desc);

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
  event_key text,
  asset text,
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

create unique index if not exists mi_bd_events_event_key_idx
  on mi_bd_events (event_key)
  where event_key is not null;


create or replace view mi_latest_venue_state as
select distinct on (s.asset,o.venue)
  s.asset,
  o.venue,
  s.captured_at,
  o.ok,
  o.health,
  o.latency_ms,
  o.spread_bps,
  o.depth_25_usd,
  o.min_fill_ratio,
  o.funding_rate,
  o.open_interest,
  o.open_interest_usd,
  o.open_interest_unit,
  o.volume_24h,
  o.volume_24h_usd,
  o.volume_24h_unit,
  o.capacity_long_usd,
  o.capacity_short_usd,
  o.flags
from mi_snapshots s
join mi_venue_observations o on o.snapshot_id=s.id
order by s.asset,o.venue,s.captured_at desc;

create or replace view mi_collector_health_recent as
select
  finished_at,
  successful_assets,
  failed_assets,
  (failed_assets=0) as healthy
from mi_collector_runs
order by finished_at desc
limit 200;

create or replace view mi_open_alerts as
select
  id,asset,venue,alert_key,severity,status,message,evidence,
  opened_at,last_seen_at
from mi_alert_events
where status in ('open','acknowledged')
order by
  case severity when 'critical' then 0 when 'warning' then 1 else 2 end,
  last_seen_at desc;
