# FEELOOP Partner API Integration Contract

Each exchange integration should implement four independent capabilities:

1. **Referral UID verification** — confirm that a submitted UID is a direct eligible referral under the FEELOOP partner account.
2. **Fee/commission sync** — ingest source records with an exchange-native immutable ID. The backend rejects duplicates by `exchangeId + sourceRecordId`.
3. **Event sync** — import official campaign records into the same event CMS used for operator-created entries.
4. **Payout** — optional. V1 keeps payouts manual; API payout remains disabled until it is separately reviewed.

Never grant withdrawal permission to a read-only affiliate connector key. Store exchange secrets only in the deployment secret manager, never in GitHub.
