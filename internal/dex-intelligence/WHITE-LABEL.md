# White-label infrastructure path

BELTRIX public trading stays Hyperliquid-only. White-label work is an internal
business/infrastructure track, not a public venue switcher.

## Candidate paths

### Orderly
Use as the primary turnkey/shared-liquidity white-label research path.
Evaluate:
- branded DEX launch workflow
- custom builder/broker economics
- supported chains
- referral/points/competition modules
- operational controls and admin ownership
- migration/exit path if the provider changes terms

### GMX
Use as the primary open-frontend/protocol integration comparison.
Evaluate:
- deployable GMX frontend versus custom integration
- UI fee receiver economics
- referral ownership
- contract/RPC operational burden
- chain-specific liquidity

### Hyperliquid
Treat HIP-3 as a market-creation path rather than generic white-label.
Evaluate:
- builder-deployed perp market economics
- oracle/market-operation responsibilities
- separation between BELTRIX frontend and market deployer roles

## Architecture rule

A future white-label deployment must use a provider adapter behind BELTRIX
identity, attribution, analytics and compliance services. Provider-specific
credentials/signing must never be embedded in the public analytics layer.

## Exit criteria before launch

- commercial agreement reviewed
- jurisdiction policy approved
- fee/revenue reconciliation tested
- withdrawal/failure procedures documented
- provider dependency and shutdown plan documented
- independent analytics can reconcile provider reports
