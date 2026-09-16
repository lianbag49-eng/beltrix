# Funding center v1

## Implemented

- Deposit / Withdraw / Transfer history entry points in the trading terminal and wallet.
- Distinguish wallet receive/send from the Hyperliquid trading account bridge.
- Personal-wallet QR: supported EVM chain selector, native asset / official Arbitrum USDC / verified custom ERC-20 contract, address-only or EIP-681 format, optional exact amount, address/request copy, share details and labelled PNG export.
- Existing Send form can import a raw address or a restricted EIP-681 payment request. Network, asset contract and atomic amount must match the explicitly selected send context. Import cannot execute a call, switch chains or submit a payment. QR image decoding is local and feature-detected; unsupported browsers use pasted text.
- USDC deposit is a reviewed direct ERC-20 transfer to the allowlisted bridge. No allowance or permit request. Minimum 5 USDC. Receive CEX withdrawals in your personal wallet FIRST; a shared bridge transfer credits the sender, not a UID.
- Withdrawal is one user-signed `withdraw3` request with an explicit recipient and environment. Signed account recovery and post-sign account/chain/expiry/balance checks precede the exchange POST.
- The documented 1 USDC withdrawal fee is displayed as an estimate, not a live quote. BELTRIX enforces a 2 USDC minimum so the estimated recipient amount remains positive. Fee changes require review of the integration.
- Persistent per-account/environment history separates wallet hash received, Arbitrum transfer confirmed, trading credit, withdrawal acknowledgement and exact bridge settlement. Unknown outcomes remain locked; reconciliation is read-only and never resubmits.

## Routes reviewed 2026-09-16

| Environment | Chain | Native USDC | Bridge |
| --- | --- | --- | --- |
| Mainnet | Arbitrum One 42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `0x2df1c51e09aecf9cacb7bc98cb1742757f163df7` |
| Testnet | Arbitrum Sepolia 421614 | `0x1baAbB04529D43a73232B713C0FE471f7c7334d5` | `0x08cfc1B6b2dCF36A1480b99353A354AA8AC56f89` |

Primary references:
- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/bridge2
- https://hyperliquid.gitbook.io/Hyperliquid-docs/for-developers/api/exchange-endpoint
- https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/bridge
- https://github.com/hyperliquid-dex/contracts/blob/master/Bridge2.sol
- https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/hyperliquid/utils/signing.py
- https://eips.ethereum.org/EIPS/eip-681

## Safety boundaries

Only connected externally owned accounts are supported for bridge funding. No smart-contract/delegated wallets, agent signatures, vaults or subaccounts. Before writing, the selected route's bridge must be unpaused, its `usdcToken` must match the allowlist, and USDC decimals must be six. A deposit also rechecks balance, native gas, simulation and pending nonce. Review expires after 60 seconds. A durable journal and an exclusive same-origin Web Lock are mandatory. Other wallet apps and sites do not share this lock; the wallet's final prompt must always be reviewed.

Never infer settlement from a balance change or an API acknowledgement. Deposit verification binds the chain transaction, sender, USDC token, bridge, nonce, amount and exact Transfer event; trading credit additionally requires a matching ledger hash/amount. Withdrawal settlement requires a matching official bridge FinalizedWithdrawal event for the account, recipient, withdrawal nonce and expected net amount. The recent log scan is limited to 2,000 blocks; older transactions require a hash. An unmatched or changed fee stays unverified rather than producing a false success.

No new custodial accounts or backend keys are generated. Native Bitcoin, Solana and TRON receive addresses are NOT supported. Only EVM assets are displayed. Spot/perp internal transfers and other bridges remain explicit links to the official venue, not silently simulated functionality. QR images do not guarantee that the sender chose the correct network, particularly in address-only mode.

## Validation

New pure tests exercise strict routes, exact units, malicious QR inputs, receipt/settlement matching, journal corruption and unavailable locks. Service tests use a deterministic public TEST-ONLY key with mocked provider and exchange transport, testing late/changed wallet state and unknown outcomes. Browser tests cover actual QR rendering/download, original send review integration, mainnet/testnet request construction, deposit transfer identity, withdrawals, paused bridge/minimums and duplicate-request locks. No test uses a real signature from the user's wallet or sends real funds.

Automated Chromium and configured iPhone WebKit tests are required before merge, along with the existing complete regression suite. Public deployment smoke only opens funding views and verifies disconnected write locks. Physical-device acceptance, funded execution, an independent security audit and any regulatory review remain outstanding. Do not call this integration independently audited or funded-validated.
