# BELTRIX Market Intelligence Runtime Deployment

## Current runtime boundary

The Market Intelligence backend is split into five layers:

1. PostgreSQL query client
2. `createPostgresTelemetryAdapter()`
3. `createTelemetryRepository()`
4. `createMarketIntelligenceApi()`
5. dependency-free Node HTTP runtime

`service-runtime.js` composes layers 2–5 once a query-capable PostgreSQL client is provided.

## Required environment

- `MI_DATABASE_URL`
- `MI_API_TOKEN` — minimum 24 characters recommended
- optional `PORT`
- optional `HOST`

Use `runtime-config.js` to fail closed when required configuration is missing.

## Production boot sequence

```text
Postgres/Neon client
  ↓
createMarketIntelligenceService()
  ↓
HTTP server
  ↓
/health
/v1/history
/v1/latest
/v1/collector-health
/v1/open-alerts
/v1/alerts/:id
```

## Security rules

- Never put `MI_DATABASE_URL` in the public GitHub Pages build.
- Never embed `MI_API_TOKEN` in static JavaScript.
- Admin server credentials should be issued for the active internal session only.
- Database writes from the API are currently limited to alert state transitions:
  - open → acknowledged
  - open/acknowledged → resolved
- Order execution and wallet signing are outside this service.

## Driver note

The repository intentionally does not vendor a PostgreSQL protocol client.
The deployment runtime must provide a query-capable client with:

```js
client.query(sql, params)
```

Once the target Neon project is confirmed, install the selected reviewed driver,
connect it with `MI_DATABASE_URL`, and inject the resulting client into
`createMarketIntelligenceService()`.

## Acceptance

Production backend should not be called ready until:

- schema readiness passes,
- two consecutive scheduled collector runs persist,
- latest snapshot is <= 30 minutes old,
- authenticated Admin history loads,
- open alerts load,
- acknowledge/resolve round-trip succeeds,
- public frontend contains no database/API secret,
- restart does not lose persisted telemetry.
