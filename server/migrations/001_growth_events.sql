-- BELTRIX growth/referral event store.
-- Apply through a reviewed migration in the production database.

create schema if not exists beltrix;

create table if not exists beltrix.growth_events (
  event_id text primary key,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  anonymous_id text,
  user_id text,
  wallet_id text,
  referral_id text,
  creator_id text,
  campaign_id text,
  region text,
  language text,
  source text,
  medium text,
  venue text,
  market text,
  volume_usd numeric,
  fee_revenue_usd numeric,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists growth_events_occurred_at_idx on beltrix.growth_events (occurred_at desc);
create index if not exists growth_events_referral_idx on beltrix.growth_events (referral_id, occurred_at desc);
create index if not exists growth_events_campaign_idx on beltrix.growth_events (campaign_id, occurred_at desc);
create index if not exists growth_events_creator_idx on beltrix.growth_events (creator_id, occurred_at desc);
create index if not exists growth_events_wallet_idx on beltrix.growth_events (wallet_id, occurred_at desc);
