# Universal Arbitrage Scanner

Dedicated experimental Render service using public Binance/OKX spot WebSockets. Four notional sizes ($100, $1,000, $2,000, $5,000), Neon persistence, no private keys or trade orders. CEX-to-CEX only, rebate defaults 0; paper estimates are not real executions. Launch: `uvicorn app:app --host 0.0.0.0 --port $PORT` from this folder. Do not assume transfers are instant or CEX fills atomic.
