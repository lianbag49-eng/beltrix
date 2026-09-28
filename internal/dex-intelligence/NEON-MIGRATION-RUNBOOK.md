# BELTRIX Market Intelligence — Neon Migration Runbook

## Preconditions
- Exact Neon project ID confirmed.
- Target database/branch confirmed.
- Current backup/snapshot state reviewed.
- No destructive retention cleanup enabled during initial migration.

## Safe migration sequence
1. Run `prepare_database_migration` with `storage/postgres-schema.sql`.
2. On the temporary branch, verify required objects using `storage/schema-readiness.js` read-only queries.
3. Validate:
   - mi_collector_runs
   - mi_snapshots
   - mi_venue_observations
   - mi_alert_events
   - mi_bd_events
   - mi_latest_venue_state
   - mi_collector_health_recent
   - mi_open_alerts
4. Insert one test collector batch on the temporary branch only.
5. Verify snapshot/observation/alert/BD-event counts.
6. Remove/rollback the test data on the temporary branch as part of branch disposal.
7. Ask for explicit approval before applying the prepared migration to the parent branch.
8. Complete migration.
9. Configure GitHub secret `MI_DATABASE_URL`.
10. Manually run `BELTRIX Market Intelligence DB Verify`.
11. Confirm the scheduled collector produces persistent rows across at least two runs.
12. Enable Admin Server history against the authenticated internal API.

## Production acceptance checks
- latest snapshot age <= 30 minutes
- collector run has at least one successful asset
- BTC/ETH/SOL snapshots persist
- venue observations join to snapshots
- open alerts deduplicate across repeated runs
- BD events deduplicate by event_key
- public GitHub Pages artifact contains no database credential
- server history token is not persisted by browser localStorage

## Retention
Initial production collection should start without running manual cleanup. After persistence and backup behavior are verified, activate reviewed retention:
- snapshots: 30 days
- collector runs: 30 days
- resolved alerts: 90 days
- BD events: 180 days

## Rollback
If migration verification fails, do not apply to the parent branch. Discard the temporary migration branch and leave the production database unchanged.
