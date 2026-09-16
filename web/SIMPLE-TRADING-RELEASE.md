# Compact Spot and Perps UI

## Product behavior
The default view is Simple. Spot / Perps buttons operate the original market selector; the active product and Mainnet/Testnet selector remain explicit. Advanced view restores the original selectors and extra detail. Only the preferred presentation is remembered, not order values or a wallet authorization.

Simple removes duplicated side/product dropdowns and the generic Review button. Existing large Buy/Sell or Open/Close Long/Short buttons still open the original review. Market/Limit stays upfront; all other order types, TP/SL and slippage fields remain under Settings. The summary shows the actual selected order type or market slippage limit. Selected special order controls are opened on selection; periodic price updates do not force a user-closed drawer open.

Spot hides futures-only Open/Close, leverage, funding/positions tabs and the unusable percentage slider; it opens the existing Balances panel instead. This does not implement spot automatic sizing. Available data that was unknown stays unknown. Perps retains venue-calculated percentage sizing, margin/leverage review, reduce-only semantics and original TP/SL limits. No attached entry brackets or OCO have been added.

Market details are collapsed with a price/change snapshot. The chart interval moves next to the chart. Available funds and order-value/margin estimates stay near the order actions; fees are explicitly excluded from estimates. Network, data/connection errors, unresolved submissions and real-money acknowledgement are not hidden or bypassed.

All original financial inputs are moved, not cloned; their values and event handlers remain intact. No changes to trading.js, signing-guard.js, order-validation.js, futures-sizing.js, funding or USDT transfer logic. No new dependency.

## Validation gates
Existing regression spec source and assertions remain unchanged, running explicitly against the fully supported Advanced view. Nine new default-Simple browser scenarios run in Chromium and the configured iPhone WebKit suite. They exercise both products, form node/value preservation, mainnet review locks, TP/SL payloads with mocked transport, percent sizing, stale-feed locks, viewport width, ticket height and input focus. Build and packaged integrity require the new stylesheet and bundled controls. Public deployment runs both the existing strict scroll/funding/USDT smoke and a separate Simple Spot/Perps check without connecting a wallet.

UI/browser simulation tests are not physical-device, funded-execution or independent security-audit acceptance. The prior funding/USDT route and dependency limitations remain unchanged.
