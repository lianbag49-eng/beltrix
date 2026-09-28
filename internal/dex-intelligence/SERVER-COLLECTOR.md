# BELTRIX Market Intelligence — Server Collector Readiness

Phase 5 prepares the internal Market Intelligence system for a server-side
scheduled collector without changing the public BELTRIX execution product.

## What is ready

- normalized telemetry snapshot format
- reusable `runMarketIntelligenceCycle()`
- storage repository interface
- PostgreSQL schema
- injected Postgres adapter
- venue health alert engine
- Market Intelligence → BD follow-up event mapping
- browser trend visualization for current local history

## What is not yet live

The repository does **not** currently claim a 24/7 server collector.

The PostgreSQL schema under:

`internal/dex-intelligence/storage/postgres-schema.sql`

has not been automatically applied to a production database.

No database credentials are embedded in the static public site.

## Intended production flow

```text
Scheduler / Worker
       |
       v
runMarketIntelligenceCycle(asset)
       |
       +--> Market collectors
       +--> Liquidity / capacity normalization
       +--> Funding / OI / volume normalization
       +--> Venue health alerts
       +--> BD follow-up events
       |
       v
Telemetry Repository
       |
       v
PostgreSQL / Neon
       |
       v
Internal Admin API
       |
       v
BELTRIX Market Intelligence
```

## Database tables

### mi_snapshots
One normalized collector cycle per asset and timestamp.

### mi_venue_observations
Per-venue operational and market metrics linked to a snapshot.

### mi_alert_events
Open / acknowledged / resolved health conditions.

### mi_bd_events
Internal commercial / partnership follow-up signals derived from operational
research. These events do not mean outreach has occurred.

## Security boundary

The static GitHub Pages frontend must never receive a privileged
`DATABASE_URL`.

Database writes should run in a backend worker / function with secrets stored in
that runtime's environment.

The browser should read historical data only through a scoped authenticated
internal API.

## Neon deployment path

A future Neon deployment should:

1. apply the schema through a reviewed migration,
2. create a backend collector runtime,
3. store `DATABASE_URL` only in the backend environment,
4. run collector cycles on a defined schedule,
5. expose authenticated read endpoints to the internal Admin,
6. test retention, alert deduplication and failure recovery before calling the
   system 24/7 production monitoring.

Until that deployment is completed, the current browser-local 7-day history
remains the active history store.


## Phase 6 — scheduled collection evidence

The repository now includes a scheduled GitHub Actions collector as an interim
24/7 collection layer.

- workflow: `.github/workflows/market-intelligence-collector.yml`
- cadence: every 15 minutes
- default assets: BTC, ETH, SOL
- output: normalized JSON artifact
- retention: 14 days
- per-asset failure isolation: enabled
- all-assets-failed condition: workflow fails

This scheduled layer is **collection evidence, not the final production history
store**. GitHub Actions artifacts are intentionally temporary and are not used
as the long-term source of truth for Admin analytics.

The next persistence step is:

```text
Scheduled collector
      ↓
Postgres telemetry adapter
      ↓
Neon / PostgreSQL
      ↓
Authenticated internal read API
      ↓
BELTRIX Admin history / alerts
```

The collector never receives wallet signing material and does not submit trades.


## Phase 7 — authenticated internal history API

The repository now includes a runtime-neutral authenticated read API contract:

- `server-api.js`
- `server-history-client.js`
- `INTERNAL-API.md`

The API exposes only:

- public liveness health
- authenticated normalized history reads
- authenticated latest-snapshot reads

It does not expose database credentials, signing material or execution actions.

The internal browser client is optional. If no server endpoint is configured,
the existing browser-local telemetry path remains the fallback.

A production deployment should put the API behind short-lived authenticated
Admin sessions or an authenticated reverse proxy. A permanent bearer token
must not be embedded in the public BELTRIX frontend.
