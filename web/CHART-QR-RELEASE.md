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

## Resumed scroll verification

The independent futures run 36824190134 reported one scroll assertion failure, although the release pipeline passed. Its trace shows document scroll offsets moving from 536 to 406 and then 586 as the first order-book layout update overlaps a 180 px wheel gesture. The input moves upward in the viewport; comparing only the document offset misclassifies that movement.

The regression now checks the input's actual viewport displacement, retaining the existing greater-than-100-pixel threshold. It also verifies the input remains focused and its value stays `0.5`. The typing position tolerance remains 2 px. No production behavior, funds, signing or order controls change.

The corrected assertion passed six consecutive local runs. A direct page-level wheel-blocking control failed with 0 px movement as expected; that temporary control was removed. The final branch must pass the existing complete Chromium and iPhone WebKit workflows before merge and publication.

## Mark price continuity

The follow-up screenshot exposed a separate defect: the top ETH Mark remained available, but the order-book center replaced the same Mark with `—` whenever the book missed its five-second freshness window. A deterministic regression reproduced that mismatch. A second regression reproduced a delayed REST context rolling a newer streamed Mark back from 2700 to 2400. Both failed before the product fix and passed afterward.

- Both Mark displays now share the actual asset context and its own freshness state. Order-book status has its own label; order and sizing locks still depend on a fresh book.
- Mark updates render as they arrive. Five seconds without a valid streamed context activates a bounded, single-flight REST fallback. Fifteen seconds without a valid context resubscribes only that channel, preserving healthy book traffic. Returning online or to the foreground also refreshes context.
- An older REST request cannot overwrite a context received while it was pending. Generation checks and cancellation isolate coin/network changes; invalid, nonpositive and wrong-coin Marks are rejected.
- Refreshing or changing chart interval/book depth for the same market preserves the last real Mark. A real outage retains that value with the time since receipt and a reconnecting/stale label; it never invents a price or resets freshness without data.
- Coverage includes a healthy Mark with a stalled book, live/REST races, silent-channel recovery, refresh continuity, a 95-second outage and recovery, and old/invalid data across market changes. All 29 focused Chromium chart, futures and desktop/mobile checks and 118 unit checks passed locally.
- The published-site smoke now samples both Mark displays every second for 30 seconds against actual public venue data, checking matching values and ongoing fresh receipts without connecting a wallet.

The normal full Chromium and iPhone WebKit release gates remain required. Network availability cannot be guaranteed by a browser application; last-known values are identified and stale-book trading locks remain intact.

The first full PC run caught a funding regression: retaining the entire context across a same-market refresh also retained a funding rate after that refresh failed. Retention now applies only to Mark; funding/statistics keep their separate refresh timestamp and unavailable behavior. The original funding assertion is preserved and now also verifies that both Mark displays remain populated.
