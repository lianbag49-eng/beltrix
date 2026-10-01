# Desktop terminal and local wallet capacity — 2026-10-01

Requested by the BELTRIX owner: retain the current Pearl Cobalt UI, separate desktop/mobile composition, and define address creation limits.

## Presentation

- At 1024 CSS px and above: full-width chart, order book and order ticket, with positions/orders/history below. Product navigation remains in the header. Protocol and market intelligence panels remain accessible below the terminal.
- Below 1024 px: compact order entry and book, expandable chart, bottom navigation. Resizing moves the original chart and preserves order fields; it does not duplicate financial controls.
- Existing light/dark colors, wallet flows, order review, mainnet acknowledgement and signature safeguards remain in place. Desktop market statistics are expanded; mobile restores its previous disclosure state.

## Wallet/address policy

- Maximum 10 stored BELTRIX wallets, combining creation and import, per browser profile and site origin. This is a product/storage limit, not an on-chain or person-wide limit.
- Each newly created wallet has an independent recovery phrase, one EVM address shared across supported EVM networks, and one Solana address.
- Ethereum, Arbitrum, Base, Optimism, Polygon and BNB Chain each therefore expose up to 10 EVM addresses, using the same wallet slots. Solana exposes up to 10 addresses from mnemonic wallets. Imported EVM private-key wallets do not add a Solana address.
- Bitcoin/Tron native address creation is not introduced by this change. Existing external-wallet functionality is unchanged.
- Creation stays mnemonic-first: recovery phrase, backup confirmation, local vault password, activation. Recovery material is not sent to a server.
- The vault transaction atomically checks capacity and duplicate EVM addresses before adding a record, including concurrent tabs. Existing records remain readable and updatable even when an older installation already has more than 10.
- Removing a wallet only removes its local encrypted vault, not funds on-chain. The existing password/backup warning flow is preserved.

## Validation

- Local unit suite: 118 passed.
- Chromium 153: 9 targeted tests passed (1024/1366/1920 px desktop, 320/390/768/960 px compact layouts, fullscreen/resize input preservation, native-wallet lifecycle, atomic capacity/duplicates).
- Existing chart/theme/trading regression suite: 41 passed; one live-network-dependent market label check could not load data locally. That UI synchronization test now uses the existing deterministic market fixture and retains all assertions. Public API and published-site network checks remain separate release gates.
- The corrected synchronization case passed on recheck. All five layout cases passed again after the final disclosure/spacing refinement.
- WebKit validation is required in existing GitHub Actions gates. Local WebKit could be downloaded but system library installation is unavailable in this runtime; this is not physical-device validation.
- No real order, signature, funds movement or user-wallet generation occurred during validation. Wallet tests use disposable isolated browser contexts and synthetic data.

Source baseline: `2e9d34e9952a4e599a0276d0292f0d78e27a1e20`. Production release is not implied by this record; GitHub Actions deployment status is authoritative.

## Release dependency repair

The existing production audit gate rejected TronWeb's pinned Axios 1.18.0 dependency. The override and lockfile now resolve Axios 1.20.0, the patched version identified by the upstream advisories (including GHSA-vh66-26gq-q6x8 and GHSA-r4gj-5m52-g5wh). TronWeb remains 6.5.1; the audit gate and financial safeguards are unchanged. Moderate Node-only stream-json findings remain outside the shipped browser bundle, whose build checks already reject that dependency.
