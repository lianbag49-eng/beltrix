# Chart continuity and funding QR · 2026-10-01

User request: keep the chart live on a one-second cadence, fix interruptions, and support QR for deposits and withdrawals while keeping the existing desktop/mobile design.

## Chart

- History loading and the live socket are independent. A failed history request no longer prevents live quotes from connecting.
- Socket errors, silent/stalled books and returning from background/offline recover automatically. Reconnection invalidates quote freshness immediately, retains loaded candles, and refills missed history without resetting the user's chart position.
- Every second the chart applies actual new trade prices to the provisional candle and draws the current data. Authoritative candle messages/backfills supply volume; overlapping trade snapshots are not added twice.
- A late REST response cannot overwrite candles received while it was in flight. Network/market/timeframe changes discard the old session's callbacks.
- Unchanged order draft events no longer redraw the chart; canvas backing storage is resized only when dimensions change. The hidden watchlist is no longer rebuilt for every order book message.
- Existing stale-book order checks and explicit signing/review remain in force.

## Deposit / withdrawal QR

- Personal deposit QR, network/token selection, copying, downloading and sharing remain available under Deposit → Wallet deposit QR. Existing USDT receive QRs cover the supported EVM, TRON and Solana routes.
- Wallet send, trading USDC withdrawal and USDT send now expose camera scanning and local PNG/JPEG/WebP image decoding. The decoder does not depend on BarcodeDetector, including on iPhone/WebKit.
- Camera denial/unavailability leaves image import available. Missing video frames time out after ten seconds. Camera tracks stop on success, Stop, collapse, dialog close, view removal or backgrounding, including a permission request resolved after the dialog closes.
- Scan results fill payment details only. Network/token checks, recipient checks, normal review and wallet approval remain required. No arbitrary URLs or QR contract calls are executed.

## Verification

- 118 unit tests passed.
- Focused coverage: reconnect/history preservation, silent socket recovery, one-second cadence, trade-price projection, delayed snapshot race, timeframe isolation; QR image decoding without BarcodeDetector, Arbitrum network validation, preserving scanned addresses when connecting, camera denial fallback, delayed permission cleanup, QR pixel decoding and stalled video cleanup.
- Existing deposit/withdrawal, chart interaction and USDT tests exercised locally; full desktop and iPhone WebKit gates run in GitHub Actions before release.
- Official API reference: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions and /timeouts-and-heartbeats.

Live prices require incoming venue data. During an actual outage, retained prices are marked stale and new orders remain locked; no fabricated prices are generated. Camera tests use synthetic local streams and do not access a user's physical camera or real funds. Chromium exercises canvas.captureStream; Linux WebKit uses a deterministic media-frame adapter to deliver real QR pixels to the same scan loop because its synthetic capture stream did not deliver frames in CI.
