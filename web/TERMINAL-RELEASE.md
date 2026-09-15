# BELTRIX trading terminal

Adds visible order book depth / spread / cumulative size / click-to-price, live mark and oracle price, daily change and volume, open interest, signed indicative hourly funding, payer direction and next-hour countdown. Statistics show unavailable/stale states, not invented zeros. Fast book subscriptions request 5 levels; deep subscriptions request 20. Rendering ticks each second; source update cadence is controlled by Hyperliquid.

Orders: mainnet and testnet signing with GTC, ALO, IOC, price-bounded market IOC, reduce-only position closes and standalone market-trigger TP/SL for an existing position. Trigger orders are size-specific, not auto-resizing attached brackets or OCO. A TP or SL does not automatically cancel the other; reduce-only prevents opening a reverse position. Slippage bounds may prevent execution. Spot has no leverage, funding or TP/SL in this frontend.

Leverage: per-market API maximum, cross / isolated choice, explicit review and signature, current setting re-read before orders. Market orders bind an exact slippage-limited price and use the venue's lot/tick precision. Changing market, account, form, leverage or review expiry invalidates the order. Unknown submissions persist a lock keyed by account and client order ID; no automatic write retry. Reconciliation requires a matching order from the selected network API.

Account tabs: positions with entry/liquidation/margin/unrealized PnL, open-order cancellation, latest 100 returned fills, recent 7-day funding records capped at 100 displayed entries, perpetual and spot balances. Account refresh runs every 15 seconds; account data is scoped to the connected account and network. Funding direction is per contract; signed USDC history is the account's received/paid amount. Countdown assumes the device clock is correct. Current funding is indicative until the hour settles.

Scope: a BELTRIX frontend to Hyperliquid public API, not a copy of the complete service. Vaults, staking, mainnet deposits/withdrawals and other venue-only services open on the official venue. Scale orders, order amendments, subaccount trading, portfolio margin, builder-deployed perp execution and an independent security audit are not implemented here. Actual funded execution remains a separate validation gate.

Sources:
- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions
- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint
- https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding
- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals


## Mainnet and TWAP update

Mainnet and testnet now use separate transports, signing sources and wallet-network checks. Switching networks disconnects the trading session and clears the pending review. Mainnet orders, leverage changes and TWAP cancellation require a fresh real-funds acknowledgement in the review dialog. Wallet signatures remain mandatory; no keys or trading agents are stored. Existing order locks are scoped by account and network; legacy locks belong only to testnet.

Venue-native TWAP: total quantity, 5–1440 minute duration, randomization, reduce-only, accepted ID persistence, history and cancellation of remaining slices. The pinned SDK currently supports up to 1440 minutes; the broader venue supports longer durations. Minimum TWAP notional is 100 USDC; venue suborders allow up to 3% slippage. Execution continues if the browser closes. No client timer submits slices. An ambiguous TWAP response locks submission; matching history requires explicit manual verification of the exact TWAP ID before unlocking.

This supersedes the earlier mainnet/TWAP exclusions. Scale orders, amendments, subaccounts and portfolio margin are still not included. Real funded execution and independent security audit have not been performed.

## Independent repository

BELTRIX source, dependencies, tests and deployment now live in `lianbag49-eng/beltrix`. GitHub Pages publishes at https://lianbag49-eng.github.io/beltrix/. ERS Android/iOS sources and releases remain in `lianbag49-eng/Exchange-Risk-Scanner-3`. The old ERS-hosted BELTRIX paths redirect to the new address.

Initial source snapshot: ERS commit `7d939155e93dad6512c05ff79f24fb3c53dfc1b2`, with `qorvexa-dex/` relocated to `web/`. Browser storage keeps the same origin and keys; no wallet keys or account data are copied through GitHub.
