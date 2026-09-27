# BELTRIX Internal DEX Intelligence

This directory is **internal research/admin infrastructure**.

The public BELTRIX trading product remains **Hyperliquid-only**. Nothing under
`internal/dex-intelligence/` is copied by `web/prepare-site.mjs`.

## Scope

1. Competitive DEX data comparison
2. BD partnership review
3. Fees / liquidity comparison
4. Future white-label infrastructure research
5. Internal Admin / Market Intelligence
6. Optional future execution venue evaluation

## Initial venue set

- Hyperliquid — baseline/public BELTRIX execution venue
- Orderly — white-label/shared-liquidity candidate
- GMX — custom frontend + UI fee/referral candidate
- Paradex — CLOB/API/reference attribution candidate
- dYdX — indexer/CLOB/institutional API candidate
- Drift — Solana/hybrid-liquidity watchlist

## Data principles

- Every live measurement must carry a timestamp.
- Never mix historical documentation with live measurements without labeling.
- An unsupported venue metric is `null`, not zero.
- GMX is not represented as a fake CLOB; its liquidity model is compared separately.
- This internal module never submits orders or signs transactions.
