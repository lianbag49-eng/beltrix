# BELTRIX

Independent wallet and Hyperliquid trading frontend.

**Live:** https://lianbag49-eng.github.io/beltrix/

Wallet balances, network selection, receive QR, send/history, live spot and perpetual market data, order book, funding countdown, market/limit orders, leverage and venue-native TWAP. Mainnet actions require user wallet signatures; automated tests intercept exchange writes and never place funded orders. See [current scope](web/TERMINAL-RELEASE.md).

## Develop and deploy

```sh
npm ci
npm run build
npm run test:unit
npm test
node web/prepare-site.mjs --root
```

Select GitHub Actions as the GitHub Pages source. Main branch changes run checks and deploy the built `public/` directory at the repository root URL.

ERS Android/iOS is maintained separately in [Exchange-Risk-Scanner-3](https://github.com/lianbag49-eng/Exchange-Risk-Scanner-3).
