# BELTRIX Android 0.1.0 Preview

**Android first; this is a test-signed preview, not a Play Store or production wallet release.**

## What is in this APK

- The existing Spot / Perps Simple and Advanced views, market data, order book, and practice tools packaged from the exact source revision. No additional trading-screen redesign and no iOS project changes.
- Eight-network USDT receive/watch UI, address-only QR and existing payment-request options, public balances and limited on-chain history when the public providers respond.
- Native PNG/CSV Save and Share, native clipboard confirmation, system image picker for QR imports, Android Back closes a dialog before changing pages, status/navigation/keyboard insets, and no reload on return from another app.
- An explicit **Wallet** handoff to the BELTRIX public website inside OKX Wallet, MetaMask, TronLink or Phantom. These links only open a DApp; they contain no recipient, amount, private data, signing request or approval.

## Important distinction: installation is not native wallet signing

The APK's embedded view has **no injected signing provider, WalletConnect session, seed phrase storage or custody keys**. It can watch public addresses and generate receive QR. It cannot sign a real order or send a transfer inside the embedded view. Use **Wallet** to open the public BELTRIX DApp in a supported wallet and connect there. Wallet availability and deep-link behavior depend on the installed wallet version and still require real-device acceptance.

APK and wallet-browser storage are separate. Nothing copies a pending order/transfer into another app. Returning to the APK does not establish a connection, synchronize a transaction journal, or prove payment. The web DApp's existing confirmation, signing and unknown-submission protections still apply where the wallet provider actually runs. The Hyperliquid USDC funding route remains separate from same-network USDT transfers.

Do not treat this as a self-contained wallet or an audited real-money app. Physical-device checks, external-wallet acceptance, funded end-to-end execution and an independent security audit remain outstanding. No real user signature or funds are used by CI. Public RPCs can rate-limit; a missing balance is not zero. There is no background transaction monitoring.

## Install

Minimum OS: Android 8.0 (API 26), with an up-to-date Android System WebView. The build targets API 36. Download the APK from the repository's Android preview release and open it on Android. Android may require permission for that browser/file app to install unknown apps. This is not an iOS package.

The first version uses a generated **debug/test signing key** and application ID `io.beltrix.preview`. A permanent privately managed signing key has not been configured. Subsequent builds may require uninstall/reinstall until release signing is established; uninstall erases this preview's local data. Do not erase transaction records while an outcome is unresolved. No keystore or private signing material is published.

## Security and build notes

Only bundled assets at `https://appassets.androidplatform.net/assets/beltrix/index.html` can use the native message endpoint. Exact origin and main-frame checks apply, with no `addJavascriptInterface`, no file/universal file access, no mixed content, and no TLS-error bypass. External pages never load in the privileged WebView; HTTPS links require confirmation. Native wallet schemes are constructed only for fixed DApp browsing destinations. Cleartext traffic and backups are disabled. No storage, camera, microphone, contacts or broad app-discovery permission is requested.

QR input uses a user-selected image, checks PNG/JPEG/WebP magic and dimensions, caps size, and copies to a narrow app-private cache provider. Export accepts only bounded PNG and UTF-8 CSV. Exports require native consent and use the system document/share chooser. There is no arbitrary native file path, native HTTP proxy, address-signing method or transaction API. Explicit exchange/broadcast endpoints are blocked inside the preview.

The existing frontend dependency audit gate is retained, including previously documented moderate Node-only transitive findings. This is not a zero-vulnerability claim. The native bridge/browser adapter, packaging manifest, Java unit tests and Android emulator suite are separate checks; see the Actions run and attached validation artifacts for actual results. Emulator tests are not physical-device tests.

Build with JDK 17, Gradle 8.13, Android platform 36 and Build Tools 35.0.0:

```sh
npm ci
npm run build
node web/prepare-site.mjs --root
node android/scripts/check-source.mjs
node android/scripts/package-web.mjs
gradle -p android testDebugUnitTest lintDebug assembleDebug
# With a running Android device/emulator:
gradle -p android connectedDebugAndroidTest
```

The generated asset directory is not committed; APK-SOURCE.json binds bundled files to the source SHA and SHA-256 digests. SHA256SUMS.txt identifies the exact published APK. A published preview version is never overwritten.

Primary integration references reviewed for this implementation:
- Android bundled WebView content: https://developer.android.com/develop/ui/views/layout/webapps/load-local-content
- Native-bridge origin risks: https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges
- Android WebView message API: https://developer.android.com/reference/androidx/webkit/WebViewCompat
- AGP/Gradle/JDK compatibility: https://developer.android.com/build/releases/agp-8-13-0-release-notes
- OKX DApp browse link reference in the official TRON adapter project: https://github.com/tronprotocol/tronwallet-adapter/issues/47
- TronLink browse links: https://docs.tronlink.org/mobile/deeplink/
- Phantom browse links: https://docs.phantom.com/phantom-deeplinks/other-methods/browse
- MetaMask DApp links: https://metamask.github.io/metamask-deeplinks/
