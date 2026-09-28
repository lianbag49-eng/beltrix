# BELTRIX Market Intelligence Internal Read API

## Purpose

This API is the server-side boundary between persisted Market Intelligence telemetry and the internal Admin UI.

It does **not** expose wallet signing, trading keys, order submission or a database connection string.

## Endpoints

### GET /health

Public liveness probe.

Response:

```json
{"ok":true,"service":"beltrix-market-intelligence","time":"..."}
```

### GET /v1/history?asset=BTC&hours=24&limit=500

Requires:

```
Authorization: Bearer <internal token>
```

Returns normalized persisted telemetry snapshots for one canonical asset.

Constraints:

- asset: uppercase alphanumeric canonical identifier
- hours: 1 hour to 90 days
- limit: maximum 5,000 rows
- cache: disabled

### GET /v1/latest?asset=BTC

Requires the same bearer authorization.

Returns only the newest persisted normalized snapshot for the asset.

## Security boundary

- `DATABASE_URL` stays in the backend runtime only.
- The public BELTRIX GitHub Pages build must never contain the API token.
- A production Admin deployment should use a short-lived authenticated session or reverse-proxy auth rather than embedding a permanent bearer token in JavaScript.
- Read API access does not imply execution permission.

## Runtime integration

The implementation in `server-api.js` is runtime-neutral and receives a telemetry repository through dependency injection.

`server-history-client.js` is an optional internal UI client. When no server base URL is configured it returns `null` and the existing browser-local history remains available.

## Next production step

```text
Scheduled collector
  -> Neon/Postgres
  -> Telemetry repository
  -> Internal read API
  -> Authenticated Admin
```

Before production use:

1. apply the reviewed PostgreSQL schema,
2. configure a backend-only database credential,
3. configure authenticated Admin access,
4. add retention jobs and DB backups,
5. exercise API failure / stale-data behavior,
6. verify the public frontend cannot access privileged history endpoints.
