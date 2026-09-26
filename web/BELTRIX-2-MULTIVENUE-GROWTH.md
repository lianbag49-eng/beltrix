# BELTRIX 2.2 multi-venue + growth foundation

This branch extends the existing BELTRIX 2 venue foundation without changing funded-order execution.

## Added
- GMX read-only venue adapter and normalization.
- Paradex read-only venue adapter plus onboarding attribution mapping.
- Region/feature policy engine for product gating.
- Russia/CIS and Chinese-speaking growth channel/KPI definitions.
- Unit tests for all new modules.

## Safety boundaries
- No new funded-order path is enabled.
- No geo bypass logic is added.
- Russia and Mainland China default to restricted execution/campaign policies.
- Hong Kong defaults to view/connect only until local product approval is explicit.
- No wash-trading, self-trading, or artificial-volume feature is implemented.

## Next integration
1. Register GMX/Paradex adapters in a shared venue registry used by market UI.
2. Add backend persistence for referral/campaign events.
3. Add admin analytics for creator CAC, retained traders, fee revenue and net contribution.
4. Add server-controlled country/feature policy overrides.
5. Add Orderly live comparison behind a feature flag.
