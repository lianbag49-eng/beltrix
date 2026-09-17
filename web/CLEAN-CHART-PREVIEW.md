# Clean navigation and interactive chart — design review

This branch is a proposal for the user's review. Do not merge, deploy the site or publish an updated Android APK until the user chooses the design. The published Android 0.1.0-preview remains unchanged.

## UI
One visible bottom navigation. The original duplicate top route bar is hidden, not duplicated in another strip. Practice and Settings stay accessible via More. Flatten the raised DEX tab and label it Trade. Retain product switch, account/network controls, original order inputs, review, mainnet acknowledgement and unknown-submission locks. Simple direction shortcuts move into Settings; original large directional actions still use the same review pathway. Advanced restores shortcuts.

## Chart
Existing Hyperliquid candleSnapshot and candle websocket data drive the original canvas, upgraded with price, volume, RSI, MACD, SMA, EMA and Bollinger overlays/panels. Snapshot history requests 600 intervals, retaining at most 1000 received candles. There is no arbitrary full-history download or third-party chart iframe. Empty/malformed data is never replaced with synthetic production candles.

Tap the chart row to reveal the chart; the header chart icon opens a modal expanded view. The same DOM node is moved and restored; there is no second data subscription. Buttons choose 1m/5m/15m/1h/4h/1d through the original interval control. Chart and indicators can be hidden independently; per-indicator settings and visibility are kept in localStorage. Master Hide all/Show all retains selected indicators. Zoom buttons, horizontal history pan, keyboard/cursor inspection and expanded-view pinch are provided. Period controls are bounded. The latest candle is provisional, not a confirmed signal.

Default: volume + RSI(14). Optional: MACD(12,26,9), SMA(25), EMA(21), BB(20,2). RSI uses Wilder smoothing; EMA uses an SMA seed; BB uses population standard deviation. Warm-up values are null. Flat RSI is explicitly 50. Other vendors can differ due to feed, seed, history length or calculation choices. This is not TradingView's licensed charting engine and makes no prediction or automatic trade.

Primary calculation references:
https://www.tradingview.com/support/solutions/43000502338-relative-strength-index-rsi/
https://www.tradingview.com/support/solutions/43000501840-bollinger-bands-bb/
https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint

## Validation
New pure calculation tests and dedicated Chromium/WebKit chart scenarios are included. Existing order, wallet, funding, navigation and Simple/Advanced regressions must continue to pass. Screenshots use explicitly labeled simulated market data, not a funded user account. No real wallet is connected or signed by chart tests. Browser tests are not physical Android tests, funded execution or an independent security audit. Existing Android external-wallet handoff limits are not changed by this chart proposal.
