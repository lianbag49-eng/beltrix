# BELTRIX Black / Gold — approved UI implementation

The user approved the Spot-like Futures mockup and requested Black / Gold colors. This updates PR 11 from design-only status to implementation, subject to passing the release checks.

Both products use a left order ticket, right two-column price/size order book and one primary review action determined by explicit Buy/Sell or Long/Short tabs. Futures retains Open/Close and the existing margin/leverage drawer. In Close mode, Long selects a SELL reduce-only action and Short selects a BUY reduce-only action; existing availability/position guards still decide whether the original review button is enabled. The presentation layer never signs, submits, constructs orders, changes balances, or bypasses a disabled control. Advanced restores the original full interface and both review buttons.

Global navigation appears once at the bottom. Practice and Settings remain available through More. Secondary informational notes move into Order details; mainnet acknowledgement, unknown submission reconciliation, status/error messages, order type, network and wallet approval are not removed. Real venue market labels remain intact (including USDC); the mockup's illustrative USDT pair labels do not create new markets. Spot percentage sizing and attached/OCO TP/SL are not introduced by this UI update.

The candle chart uses the prior review branch's real Hyperliquid data implementation: fold/restore, expanded modal, timeframe changes, candle readout, zoom/pan, VOL/RSI/MACD/MA/EMA/BOLL, individual and master visibility and local preferences. No synthetic fallback in production. Price up/down colors are kept distinct as data cues; the shell, selection, main controls and chart controls use Black / Gold.

Validation adds common layout/primary-action and desktop/mobile chart-return checks, extends reduce-only direction review checks and updates old navigation tests to use the new visible More menu without dropping their assertions. Screenshots are labeled test data, not real account or filled trade evidence. Release success must be checked in the actual Actions run, not inferred from this document.

Android packaging will publish a new test-signed 0.1.1-preview without overwriting 0.1.0. The embedded Android view remains watch/receive-only with external wallet-browser handoff; there is no new in-APK signer or WalletConnect. Physical-device, funded transaction, installed-wallet acceptance, permanent release signing and independent audit remain outstanding.
