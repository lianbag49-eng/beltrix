# BELTRIX 2 venue + growth foundation

This branch introduces a low-risk foundation without changing funded-order behavior.

## Added
- `venue-adapter.js`: normalized venue registry/capability model.
- `hyperliquid-venue.js`: Hyperliquid endpoints, market normalization, and builder-fee validation.
- `orderly-venue.js`: read-only Orderly market POC using `/v1/public/info`.
- `attribution-core.js`: first-touch referral + last-touch campaign attribution with secret-field filtering.
- Unit tests for each new module.

## Deliberately not enabled yet
- No builder address or builder fee is hard-coded.
- No existing order payload is changed.
- No Orderly order signing or funded execution.
- No geo bypass. Region gating belongs in the future compliance gateway.
- No self-trading/wash-volume feature.

## Next integration
1. Switch `market.js` Hyperliquid endpoint/market normalization to the adapter.
2. Add explicit user-approved Hyperliquid builder-fee configuration.
3. Persist attribution events to a backend instead of local-only state.
4. Add admin reporting for referral → active trader → fee revenue.
5. Add Orderly live market comparison behind a feature flag.
