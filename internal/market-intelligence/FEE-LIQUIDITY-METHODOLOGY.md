# Fee & Liquidity Comparison Methodology

A venue is not compared on headline taker fee alone.

## Effective trading cost
Effective cost =
- taker/maker fee
- spread
- price impact
- execution/gas fee
- funding for expected holding window
- deposit/withdraw/bridge friction
- failed/partial fill cost

## Liquidity fields
Capture at the same UTC timestamp:
- 24h and 30d perp volume
- open interest
- bid/ask spread for BTC/ETH and target altcoins
- depth within 5 / 10 / 25 / 50 bps
- max size before 10 bps / 25 bps estimated impact
- funding rate
- liquidation/oracle model
- downtime / degraded-data incidents

## Revenue fields
Separately capture:
- referral share
- builder/UI fee
- fee-spread economics
- affiliate payout timing
- user discounts
- minimum balance / volume qualification
- clawback / excluded jurisdictions

## Data confidence
A metric is production-decision ready only when:
1. timestamped,
2. source URL is stored,
3. direct venue/API observation is preferred over aggregator data,
4. two independent observations agree when practical,
5. stale values are automatically marked.

## Current use
The static 2026-09-27 snapshot in venues.js is for BD triage. It is not sufficient by itself for automated venue routing.
