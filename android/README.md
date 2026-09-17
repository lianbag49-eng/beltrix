# BELTRIX Android 0.1.1 Preview — Black / Gold

Android test-signed preview, not a Play Store or production wallet release.

## UI update

The user approved a shared Spot-like Futures layout in Black / Gold. Both products now use a left order ticket, right price/quantity book, explicit direction tabs and a single primary review action. Futures keeps Open/Close and applied margin/leverage controls. Global navigation appears only at the bottom; Practice and Settings are available from More. The candle chart can fold or open in an expanded view, with VOL/RSI/MACD/MA/EMA/BOLL selection, period settings and visibility memory.

The APK packages the source revision and asset hashes in APK-SOURCE.json. Existing order/signature/nonce protections remain in the web frontend; this UI does not introduce new markets, Spot percentage sizing, attached/OCO TP/SL, or native signing. Market labels and real venue quote currencies remain authoritative over illustrative mockup text.

## What works inside the preview

Existing Spot/Futures Simple and Advanced views, market data, public-address watch/receive tools for the eight-network USDT module, receive QR, and limited on-chain history when public providers respond. Native PNG/CSV Save and Share, confirmed clipboard copy, user-selected PNG/JPEG/WebP QR image import, dialog-first Android Back and system/keyboard insets remain included. Public RPC failures are not represented as zero balances.

## No in-APK signer

The embedded view has NO injected signing wallet, WalletConnect session, seed phrase or private key storage. It cannot sign real orders or sends. The native Wallet menu opens the canonical BELTRIX public DApp in an external wallet browser (OKX, MetaMask, TronLink or Phantom); users connect and review there. These browse links carry no recipient, amount, approval or signing request. Actual installed-wallet acceptance remains a physical-device test, not a CI claim.

APK and wallet-browser data/journals are separate. Returning does not establish a wallet connection, synchronize a transfer or prove payment. No automatic resend, secret transfer or background transaction monitoring is added. Hyperliquid USDC funding remains separate from same-network USDT transfers.

## Install and upgrade limitations

Version 0.1.1-preview, application ID io.beltrix.preview, versionCode 2, min Android 8/API26, target API36. Keep Android System WebView current. Download the new APK from its versioned GitHub prerelease and open it on Android; Android may ask to authorize installation for the browser/file app.

This is DEBUG/TEST signing. A permanent privately managed signing key is not configured. CI builds may have different test certificates, so installation over 0.1.0 may fail and require uninstall/reinstall. Uninstall erases the preview's local records/settings. Preserve any needed records first and do not erase unresolved transaction evidence. No private signing key or keystore is published. Version 0.1.0 remains available and is not overwritten.

## Security and validation scope

Only packaged content at https://appassets.androidplatform.net/assets/beltrix/index.html receives native capabilities, guarded by exact origin and main-frame checks. No addJavascriptInterface, file/universal-file access, mixed content, TLS bypass or broad storage/camera/contact permissions. Native exports are bounded PNG/UTF-8 CSV and require consent; QR imports are size/format/dimension checked and copied through a narrow private-cache FileProvider. External sites do not load inside the privileged view. There is no native signing, native HTTP proxy or arbitrary file-path method.

CI runs the existing frontend unit tests/audit/build, adapter browser tests, Java policy tests, Android 15 emulator tests with actual native QR file IO, lint and APK signature/metadata verification. Consult the actual run/artifacts for results; this document does not assert tests passed. External-wallet intents and document-picker selections are mocked, not live wallet execution. Existing non-fatal lint and moderate Node dependency findings are not a zero-vulnerability claim.

Physical-device testing, installed-wallet handoff acceptance, funded execution, permanent release signing and independent security audit remain outstanding. Use as a UI/watch/receive preview, not an audited self-contained money wallet. No iOS build is included.

## Build

JDK17, Gradle8.13, Android platform36 and build-tools35.0.0:

```sh
npm ci
npm run build
node web/prepare-site.mjs --root
node android/scripts/check-source.mjs
node android/scripts/package-web.mjs
gradle -p android testDebugUnitTest lintDebug assembleDebug
gradle -p android connectedDebugAndroidTest
```

Bundled asset digests and source SHA are recorded in APK-SOURCE.json and android-build.json. SHA256SUMS.txt identifies the exact published APK. Published versions are never intentionally overwritten.
