# Current release status — 2026-09-15

**Development preview; release blocked.** This section supersedes historical entries below.

- Existing spot/perpetual Hyperliquid clients, chart/order book, signing, cancellation, leverage and TWAP remain in the deployed bundle. Both mainnet and testnet exist; mainnet can use real funds and still requires explicit acknowledgement and wallet signing. This update adds no mainnet transactions.
- Spot practice starts with 100,000 simulated USDC plus starter tokens. Existing balances are preserved; Add 100,000 spot practice USDC tops up the local practice balance.
- A separate futures practice account starts with 100,000 simulated USDC. BTC/ETH long/short, 1–20x educational isolated margin, explicit review, position close, net PnL and history are implemented. Reset restores this account only.
- Futures practice uses fresh Hyperliquid TESTNET bid/ask. No wallet access or exchange write request. Price unavailability blocks execution; no fallback fabricated quotes. The old spot practice swap still uses fixed reference prices.
- Futures simulation uses a flat 0.05% fee per side, unlimited top-of-book liquidity and capped margin loss on settlement. It does NOT model funding, depth, queue priority, liquidation, partial fills or execution while closed. It is an educational model, not a venue backtest.
- Paper data is browser-local and editable by its owner, not authoritative money or performance records. Clearing browser storage loses it. Do not enter private keys to obtain practice funds.

See [SECURITY-REVIEW.md](SECURITY-REVIEW.md) for the scoped internal review, funded-test procedure and independent-audit handoff. CI also measures public testnet depth and runs selected flows under iPhone WebKit emulation; neither proves actual funded execution or physical iPhone compatibility.

## Release gates still required

1. User-owned funded TESTNET wallet: spot buy/sell and perpetual open/partial-fill/cancel/close, reconciliation after timeouts, leverage and trigger/TWAP checks against actual venue records. Mock signatures do not pass this gate.
2. Liquidity: measure available depth and slippage for intended pairs and sizes; an ALO order option is not capital or guaranteed liquidity. No funds were deposited and no market-making strategy was launched.
3. Independent frontend/wallet security audit, findings remediation and retest. Existing dependency scans and these internal checks are not an independent audit.
4. Actual iPhone wallet compatibility and recovery tests, release monitoring and incident response, product/legal and privacy review.

Internal checks in this update cover paper accounting, invalid inputs, margin reservation, loss cap, state restoration, fresh quotes, confirmation and absence of wallet signing. Full regression is enforced by the deployment workflow. CI results, not this checklist, are the source of truth for test outcomes.

---
## Historical implementation notes (may describe superseded behavior)

# BELTRIX development preview 0.3
This is a simulation frontend, NOT a release-ready DEX.
## Implemented
- Clearly marked sample market, pool and APR values
- Wallet optional paper trades with 0.05% model fee, balance validation
- Confirmation and 30-second expiry, configurable minimum receipt
- Browser storage opt-out, CSV export, confirmed reset/delete
- Read-only injected wallet, verified Base Sepolia chain
- No transaction, approval or signature RPC calls
- Browser regression tests and isolated web deployment artifact
## Release blockers
- Select audited protocol/router and supported chain/token allowlist
- Implement actual testnet quotes, allowances, simulations, transactions, receipts and failure/reorg handling
- Independent contract and frontend security review
- Real liquidity/data feeds and stale-data protection
- External wallet/mobile compatibility, real-device iOS and accessibility testing
- Legal/compliance and brand review, privacy/terms, monitoring, incident response
- No mainnet deployment until explicitly authorized after these gates

## 0.3 implemented
- Hyperliquid public mainnet spot/perpetual market metadata and candle chart with volume
- Candle WebSocket subscription, reconnect, stale-data and failure states
- Market data is separate from paper swap execution; no real orders or liquidity added
- Independent security audit is still outstanding

## 0.4 implementation and remaining verification
- Spot/perpetual trade and L2 book subscriptions; UI refresh every 1 second.
- Candle intervals remain 1 minute or greater, per upstream API. No fabricated 1-second candles.
- Testnet-only SDK signing, GTC/ALO orders, cancellation, balances, open orders and positions.
- Mainnet market display cannot submit orders. Price freshness and precision checked before order review.
- Signing requires an injected user wallet; private keys are never collected or persisted.
- ALO is an order-book liquidity provision option, not an AMM pool or funded liquidity guarantee.
- Dependency audit after version upgrades: zero reported vulnerabilities on 2026-09-14.
- Automated tests use mocked API responses and test signatures. They are not proof of live settlement.
- Pending external verification: funded testnet wallet order/partial-fill/cancel cycle; actual liquidity funding; independent security audit; real iPhone wallet compatibility.
- ERS: Android encrypted record persistence, iOS Keychain record storage, worker entry, search, remediation hints and expanded local device checks.
- ERS public IP/ISP/KYC/login history remain unavailable without a verified external data integration. Official logo endpoints may block requests and must not be described as verified offline logo assets.

## English UI simplification

- Trade is the default page; navigation is Trade, Practice, Settings.
- Live chart and testnet ticket share one screen. Depth/trades expand on demand.
- Removed demo overview/pools and the separate Base Sepolia wallet connector.
- Practice balances/history remain available together; all built-in labels and messages use English.
- Existing market/order safeguards are unchanged. CI covers English navigation, mobile width, simulation, stream freshness and mocked testnet signing.

## Wallet-style navigation

Assets, Trade, Discover, Settings retain BELTRIX branding. Practice remains in Settings.
Assets queries Hyperliquid mainnet/testnet account data by connected or watch-only public address. Spot balances are shown in token units separately from perpetual account value. Invalid responses clear balances; requests cancel on network/address changes.
OKX Wallet can be selected explicitly through its injected browser provider. No private keys, seed phrases, mainnet orders, or multichain sends are handled by this prototype.

References:
- https://web3.okx.com/ — product navigation reference; no affiliation.
- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint — balances, positions and fills.


## Wallet workspace update (2026-09-14)

The earlier read-only Assets/Discover prototype is now incorporated into the expanded Wallet/Explore workspace. It retains Hyperliquid account inspection, watch-only access, app discovery and explicit OKX provider selection. Native/ERC-20 wallet transfers and indexed blockchain history are now implemented; Hyperliquid order execution remains testnet-only. See WALLET-RELEASE.md for implemented features, data coverage and outstanding funded-wallet/audit gates.

