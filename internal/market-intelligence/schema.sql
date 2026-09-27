create schema if not exists beltrix_internal;

create table if not exists beltrix_internal.venue_snapshots (
  id bigserial primary key,
  captured_at timestamptz not null,
  venue text not null,
  market_count integer,
  volume_24h_usd numeric,
  open_interest_usd numeric,
  confidence text not null,
  source text,
  payload jsonb not null default '{}'::jsonb
);
create index if not exists venue_snapshots_venue_time_idx on beltrix_internal.venue_snapshots (venue,captured_at desc);

create table if not exists beltrix_internal.bd_pipeline (
  venue text primary key,
  stage text not null,
  workstream text,
  contact_route text,
  contact_name text,
  owner text,
  next_action text,
  next_action_at timestamptz,
  commercial_terms jsonb not null default '{}'::jsonb,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists beltrix_internal.execution_reviews (
  venue text primary key,
  telemetry boolean not null default false,
  api boolean not null default false,
  testnet boolean not null default false,
  reconcile boolean not null default false,
  fees boolean not null default false,
  risk boolean not null default false,
  legal boolean not null default false,
  security boolean not null default false,
  e2e boolean not null default false,
  approved_by text,
  updated_at timestamptz not null default now()
);

create table if not exists beltrix_internal.change_watch (
  id bigserial primary key,
  venue text not null,
  category text not null,
  observed_at timestamptz not null default now(),
  source_url text not null,
  previous_value jsonb,
  current_value jsonb,
  reviewed boolean not null default false
);
