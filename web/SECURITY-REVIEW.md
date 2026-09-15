# Internal review and independent-audit handoff — 2026-09-15

Status: development preview; NOT an independent audit or release approval.

## Scope and changes

Reviewed the Hyperliquid signature/submission boundary, network/account guards, order freshness, unresolved-order handling and new practice accounting. This is a scoped source review, not proof that the whole wallet or all dependencies are secure.

Finding B-01: the session was checked before invoking the SDK, but an account/network change while the wallet signature prompt remained open needed a second check before the SDK could submit that signature. The guarded wallet adapter now checks the session both before and after signing, including session generation and a 30-second deadline. A rejected post-sign check withholds the signature. An unresolved submission lock may remain conservatively set; do not clear it and resubmit without checking venue status. Unit tests exercise session drift, disconnected accounts and expired signatures; existing browser integration verifies SDK submission.

Finding B-02: freshness checks now require finite numeric timestamps and reject future local receive times. Missing market metadata is not treated as a valid feed.

Production dependency audit is a deployment gate (high/critical fail). A zero-advisory result does not cover unpublished vulnerabilities, business logic, compromised extensions or malicious RPCs.

## Independent auditor package

- Scope: `web/trading.js`, `order-validation.js`, `terminal-core.js`, `signing-guard.js`, wallet modules and all browser persistence, RPC boundaries, service worker and dependency lockfile.
- Trust boundaries: user-controlled wallet provider; external Hyperliquid/RPC/indexer responses; untrusted browser storage; GitHub build/deployment supply chain.
- Required review: signing-domain/network isolation, delayed signature changes, replay/nonce/expiry, amount precision, allowance/transfer recipient integrity, unknown submission recovery, DOM injection, account cross-contamination, storage corruption, dependency/bundle integrity and iOS wallet switching.
- Evidence: CI unit/browser traces, dependency audit logs, public `release-evidence.json` snapshot. Mocked wallet signatures are not live funded trade evidence.
- Deliverables to request: commit-scoped findings with severity and reproduction, remediation review, retest and signed final report. No auditor has been engaged or paid, and no report has been issued by an external party.

## Funded TESTNET acceptance procedure

Use a user-owned test wallet; never send its seed/private key in chat. The operator obtains test funds through the official venue process. Use Testnet, verify wallet/address/network in the review, then approve each signature personally.

1. Record baseline spot holdings, perpetual equity, positions and open orders.
2. Spot: buy a minimum-size supported pair with bounded IOC; compare returned order ID to fills and the resulting token/fee changes. Place a non-crossing ALO order, confirm it rests, then cancel and verify terminal status and release of held funds.
3. Perpetual: explicitly set low leverage, open a minimum-size position, compare size/entry/fees, then reduce-only close and verify final size zero and equity reconciliation. Test a separate unfilled limit/cancel cycle.
4. Verify partial fills and reconnect/unknown submissions by matching the exact order ID/client ID, network, coin and account. Do not fabricate a partial fill or blindly retry a timed-out write.
5. Test trigger and TWAP lifecycle separately, including cancellations. Do not leave live orders running after the test.
6. Preserve timestamp, network, address, order IDs, fills, fees, before/after balances and exceptions in a private test report. Never publish keys or sensitive account data into public CI logs.

These steps have NOT been executed with a funded wallet in this task. Public API data and mock execution are insufficient to mark them passed.

## iPhone and operational gates

CI adds iPhone 13 viewport/touch emulation in WebKit for practice, order signing mocks and navigation. This is not physical iOS, an OKX/MetaMask in-app browser, Face ID, app switching or a real signing sheet. Those require a physical device and its owner.

Before release: independent audit and remediation; real-device acceptance; funded execution evidence; approved liquidity pairs/size limits; reviewed terms/privacy and operating jurisdiction; an owner for support/incident response. On suspected compromise stop new signatures, inform users, preserve evidence, and redeploy the last known safe commit after review. A rollback does not cancel venue orders or erase wallet approvals.
