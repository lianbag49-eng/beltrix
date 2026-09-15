# BELTRIX wallet + terminal update

## Product direction
Keep the existing Hyperliquid transport/signing safety model while simplifying navigation into a wallet-first shell and a dedicated trading terminal.

## Wallet home
- Portfolio total and per-network balances at the top.
- Primary actions: Send, Receive, Swap/Trade entry, History.
- Compact asset list with search and network badge.
- Network/account selector remains explicit; switching either invalidates pending trading review.
- Never imply custody: connected-wallet signatures remain required for mainnet actions.

## Trading terminal
- Dedicated Spot / Perps switch.
- Market header: mark/last, 24h change, volume, open interest and funding where applicable.
- Chart remains separate from order book and order ticket so mobile layouts can collapse cleanly.
- Order book keeps depth, spread, cumulative size and click-to-price.
- Ticket keeps market/limit, GTC/ALO/IOC where supported, leverage, cross/isolated, reduce-only and explicit review.
- Positions, open orders, fills, funding and balances live in a bottom account panel on desktop and tabs on mobile.

## Validation and release gates
- Preserve account/network/expiry rechecks after signing and ambiguous-submission locks.
- Testnet is the default validation environment for order-write exercises.
- Mainnet requires explicit real-funds acknowledgement and wallet signature.
- Do not describe real-funded execution as validated until a separately documented funded exercise is completed.
- Independent security audit remains a release gate, not a completed claim.
- Run build, unit/browser tests and dependency audit before merging.

## Deferred
Vaults, staking, portfolio margin, subaccount trading, scale orders and venue-only deposit/withdrawal flows remain outside this frontend unless separately implemented and tested.
