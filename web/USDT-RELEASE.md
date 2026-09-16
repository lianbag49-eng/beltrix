# USDT wallet: eight-network integration

## Implemented scope

Open **USDT wallet** from Wallet, the funding toolbar or the deposit/withdrawal chooser. This is a same-network personal-wallet transfer tool, not a Hyperliquid funding bridge. It never swaps USDT to USDC, creates a custodial account or asks for a seed phrase.

| Network | Registered asset | Native fee currency |
| --- | --- | --- |
| Ethereum | Tether USDT, ERC-20, 6 decimals | ETH |
| BNB Smart Chain | Binance-Peg USDT, BEP-20, 18 decimals | BNB |
| Arbitrum One | USDT0, 6 decimals | ETH |
| Optimism | USDT0, 6 decimals; not legacy bridged USDT | ETH |
| Polygon PoS | USDT0, 6 decimals | POL |
| Avalanche C-Chain | Tether USDT, 6 decimals; not USDT.e | AVAX |
| TRON | Tether USDT, TRC-20, 6 decimals | TRX |
| Solana | Tether USDT, original SPL Token Program, 6 decimals | SOL |

Exact allowlisted contracts/mint and sources are in `usdt-registry.js`. These eight routes are not a claim of supporting every OKX Wallet chain or every bridged USDT representation. The sending and receiving services must support the same chain AND token contract.

## Receive and send

- Receive: connect the correct wallet family or supply a public watch-only address; select a route; copy the address or save/share a labelled QR. Address-only QR works across all eight routes but does not encode a network. Optional exact-amount EIP-681 and Solana Pay requests are provided only on compatible routes.
- Send: select route, connect a signing wallet, enter/import the recipient and amount, inspect network/token/fee details, acknowledge the mainnet review, then approve in the external wallet. Local PNG/JPEG/WebP QR decoding only fills fields; arbitrary calls, chain switches and unsupported token requests are rejected.
- Balances: show per-network balances for explicitly connected EVM, TRON and Solana addresses. A missing RPC result is unavailable, never a fabricated zero.
- History: durable local submission history with read-only status checks plus explicitly limited recent on-chain activity and a full explorer link. A hash or broadcast acknowledgement is not proof of arrival. No automatic resubmission.

## Transfer protections and operating limits

Amounts remain integer atomic units. Reviews are single-use and expire after at most 60 seconds. Account/network/view/expiry, balance, simulation and fees are checked before handing off; separately signed TRON/Solana transactions are byte-checked and signatures verified before app broadcast. EVM wallets perform signing and sending together; an ambiguous handoff remains locked until reconciled. Closing the view cannot cancel an already submitted request.

Same-origin Web Locks and persistent journals prevent overlapping USDT sends and coordinate EVM writes with the existing wallet and USDC funding center. Other wallet apps and sites do not share these locks. Browser storage and Web Locks are required. Unknown outcomes block new requests rather than guessing whether money moved.

EVM sends support directly signing EOAs, not smart/delegated accounts; USDT transfer may return empty bytes, which is accepted only when the simulation itself succeeds. Receipt checks bind sender, recipient, amount, token, nonce and calldata. Two block confirmations are displayed, not a guarantee of Ethereum L1 finality.

TRON supports ordinary owner-controlled accounts, not multisignature or permission-managed accounts. Fee estimation conservatively budgets TRX for Energy with a 30% buffer plus Bandwidth, capped at 300 TRX Energy fee limit. Staked resources and Energy rental discounts are not assumed. Confirmation requires solidified transaction identity and the exact USDT Transfer log.

Solana supports the original Token Program only, ordinary owner addresses or validated existing USDT token accounts. Transfers may create a recipient associated token account; required rent is disclosed. Up to eight source token accounts are combined. The exact signed message, signer, fee payer, blockhash lifetime and finalized transaction are checked. No Token-2022, memo-required exchange flow or arbitrary instructions are supported.

Wallet-provider support is feature-detected: compatible injected EVM wallets, OKX/TronLink TRON and OKX/Phantom Solana providers. A standalone iOS browser without a signing provider cannot send; use the wallet's in-app browser or a supported extension. Watch-only addresses cannot sign.

Public RPCs and explorers can rate-limit, block CORS or be unavailable; this is not a production RPC SLA. The read-only CI probe records metadata connectivity separately from fixture tests. Reliable authenticated infrastructure, physical-device acceptance, a funded end-to-end exercise and independent security audit remain outstanding. No real user signatures or funds are used during automated validation.

## Dependency and validation evidence

SDKs are pinned in the lockfile. The initial candidate SPL helper package was removed because its bigint-buffer dependency had a high-severity unpatched advisory. Narrow original SPL token instruction/account codecs are tested instead. uuid is overridden to 11.1.1. The existing high-severity production audit gate is retained. A moderate stream-json issue in Node-only Jayson remains in the dependency graph; this is NOT described as zero vulnerabilities. The browser build checks its complete input graph and fails if stream-json or bigint-buffer is bundled. The USDT SDK bundle is lazy-loaded; existing wallet and trading boot paths remain lightweight.

Before remote CI: 75 unit tests and 91 Chromium browser tests passed locally, including 29 USDT core/service tests and eight USDT UI tests. Signing fixtures use public deterministic TEST-ONLY keys and mocked transport. The market regression fixture now supplies a deterministic WebSocket order book instead of relying on a live network; its original assertions remain intact. Full configured iPhone WebKit, production package/audit checks and published-site smoke are required separately before claiming deployment verified.

## Primary references reviewed 2026-09-16

- Tether issuer contracts and legacy ERC-20 behavior: https://tether.to/en/supported-protocols/
- USDT0 routes: https://usdt0.to/ecosystem/arbitrum ; https://usdt0.to/ecosystem/optimism ; https://usdt0.to/ecosystem/polygon
- BNB token metadata: https://github.com/trustwallet/assets/blob/master/blockchains/smartchain/assets/0x55d398326f99059fF775485246999027B3197955/info.json
- TRON transaction construction: https://developers.tron.network/reference/triggersmartcontract ; https://developers.tron.network/reference/triggerconstantcontract
- TronLink provider: https://docs.tronlink.org/dapp/getting-started/
- Solana Token Program / ATA: https://www.solana-program.com/docs/token ; https://www.solana-program.com/docs/associated-token-account
- Solana RPC clusters: https://solana.com/docs/references/clusters
- EIP-681: https://eips.ethereum.org/EIPS/eip-681
