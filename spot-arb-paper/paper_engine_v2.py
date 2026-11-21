"""Inventory-constrained *hypothetical* two-exchange spot simulation.

This module cannot place orders, move assets, or receive referral commissions.
It separates economic forecasts from a persistent (until Render /tmp reset)
simulation ledger. Fee cashback is NEVER booked to cash.
"""
import datetime
import json
import os
import sqlite3
from decimal import Decimal as D, getcontext

getcontext().prec = 32
VENUES = ("kucoin", "gate")
INIT_USDT = D("5000")
MAX_NOTIONAL = D(os.getenv("MAX_TRADE_USDT", "5000"))
MIN_ROI = D(os.getenv("MIN_NET_ROI_PCT", "0.15")) / 100
PROVISION = D(os.getenv("REBALANCE_USDT", "2"))
COOLDOWN = int(os.getenv("PAPER_ROUTE_COOLDOWN_SECONDS", "3600"))
# Scenario rates are NOT necessarily available to this trading account.
REBATE_ASSUMPTION = {
    "kucoin": D(os.getenv("PAPER_KUCOIN_REBATE_SCENARIO_PCT", "30")) / 100,
    "gate": D(os.getenv("PAPER_GATE_REBATE_SCENARIO_PCT", "30")) / 100,
}
TAKER = {
    "kucoin": D(os.getenv("PAPER_KUCOIN_TAKER_FEE_PCT", "0.1")) / 100,
    "gate": D(os.getenv("PAPER_GATE_TAKER_FEE_PCT", "0.1")) / 100,
}
DEFAULT_ALLOCATION = "ETH:2500,SOL:1500,LINK:1000"

def dec(x):
    return D(str(x))

def allocation():
    result = {}
    for part in os.getenv("PAPER_GATE_SPOT_ALLOCATIONS_USDT", DEFAULT_ALLOCATION).split(","):
        if not part.strip():
            continue
        ticker, amount = part.strip().upper().split(":")
        amount = dec(amount)
        if amount <= 0 or ticker in result:
            raise ValueError("Invalid initial asset allocation")
        result[ticker] = amount
    if not result or sum(result.values()) != D("5000"):
        raise ValueError("Gate starting spot allocation must sum to 5000 USDT")
    return result

def starting_portfolio(books):
    alloc = allocation()
    portfolio = {"kucoin": {"USDT": str(INIT_USDT)}, "gate": {"USDT": "0"}}
    seed_price = {}
    for ticker, usd in alloc.items():
        book = books.get(("gate", ticker))
        if book is None or not book["bids"]:
            return None, "Missing Gate bid for initial " + ticker + " allocation"
        price = book["bids"][0][0]
        if price <= 0:
            return None, "No valid Gate bid for " + ticker
        portfolio["gate"][ticker] = str(usd / price)
        seed_price[ticker] = str(price)
    return {"balances": portfolio, "starting_usdt": "10000",
            "last_marks": {"gate": seed_price, "kucoin": {}},
            "cash_spread_pnl": "0", "total_fee": "0",
            "rebate_forecast": "0", "provisions": "0",
            "initialized_utc": datetime.datetime.now(datetime.timezone.utc).isoformat()}, None

def simulate_book(coin, buy, sell, buy_book, sell_book, available_usdt, available_token):
    """Walk asks and bids with both actual book depth and simulated balances."""
    if not buy_book or not sell_book:
        return None
    if abs(buy_book["at"] - sell_book["at"]) > 5:
        return None
    if available_usdt <= 0 or available_token <= 0:
        return None
    asks = buy_book["asks"]
    bids = sell_book["bids"]
    i = j = 0
    aq = asks[0][1]
    bq = bids[0][1]
    qty = cost = proceeds = D("0")
    budget = min(MAX_NOTIONAL, available_usdt) / (1 + TAKER[buy])
    best = None
    while i < len(asks) and j < len(bids):
        ask = asks[i][0]
        bid = bids[j][0]
        if ask <= 0 or bid <= 0 or bid <= ask:
            break
        units = min(aq, bq, available_token - qty, (budget - cost) / ask)
        if units <= 0:
            break
        qty += units
        cost += units * ask
        proceeds += units * bid
        buy_fee = cost * TAKER[buy]
        sell_fee = proceeds * TAKER[sell]
        fees = buy_fee + sell_fee
        gross = proceeds - cost
        spread_after_fee = gross - fees
        roi = (spread_after_fee - PROVISION) / cost
        if roi >= MIN_ROI and (best is None or spread_after_fee > dec(best["spread_after_fee_usdt"])):
            rebate = buy_fee * REBATE_ASSUMPTION[buy] + sell_fee * REBATE_ASSUMPTION[sell]
            best = {
                "coin": coin, "buy": buy, "sell": sell,
                "qty": str(qty), "buy_vwap": str(cost / qty),
                "sell_vwap": str(proceeds / qty),
                "best_ask": str(asks[0][0]), "best_bid": str(bids[0][0]),
                "buy_cost": str(cost), "sell_proceeds": str(proceeds),
                "buy_fee": str(buy_fee), "sell_fee": str(sell_fee),
                "fees": str(fees), "gross_spread_usdt": str(gross),
                "spread_after_fee_usdt": str(spread_after_fee),
                "provisional_rebalance_usdt": str(PROVISION),
                "net": str(spread_after_fee - PROVISION),
                "net_roi_pct": str(roi * 100),
                "rebate_scenario_usdt": str(rebate),
                "net_with_rebate_scenario_usdt": str(spread_after_fee - PROVISION + rebate),
                "observed_utc": datetime.datetime.fromtimestamp(
                    max(buy_book["at"], sell_book["at"]), datetime.timezone.utc).isoformat(),
                "status": "HYPOTHETICAL_INVENTORY_CONSTRAINED",
            }
        aq -= units
        bq -= units
        if aq == 0:
            i += 1
            if i < len(asks):
                aq = asks[i][1]
        if bq == 0:
            j += 1
            if j < len(bids):
                bq = bids[j][1]
        if qty >= available_token or cost >= budget:
            break
    return best

def portfolio_mark(portfolio, books):
    total = D("0")
    stale = []
    for ex in VENUES:
        for ticker, value in portfolio["balances"][ex].items():
            qty = dec(value)
            if ticker == "USDT":
                total += qty
                continue
            book = books.get((ex, ticker))
            if book and book["bids"]:
                mark = book["bids"][0][0]
                portfolio["last_marks"][ex][ticker] = str(mark)
            else:
                mark = dec(portfolio["last_marks"][ex].get(ticker, "0"))
                stale.append(ex + ":" + ticker)
            total += qty * mark
    return str(total), stale

def paper_response(p, books, trades, new_trade, blocked):
    balances = p["balances"]
    marked, stale = portfolio_mark(p, books)
    return {
        "paper_model": "INVENTORY_LIMITED_PREPOSITIONED_SPOT_NO_TRANSFERS",
        "paper_initial_allocation": DEFAULT_ALLOCATION,
        "paper_balances": balances,
        "paper_cash_spread_pnl_usdt": p["cash_spread_pnl"],
        "paper_fee_paid_usdt": p["total_fee"],
        "paper_rebate_scenario_total_usdt": p["rebate_forecast"],
        "paper_rebalance_reserves_usdt": p["provisions"],
        "paper_net_after_provisions_usdt": str(dec(p["cash_spread_pnl"]) - dec(p["provisions"])),
        "paper_marked_equity_usdt": marked,
        "paper_marks_stale": stale,
        "assumed_fills_total": len(trades),
        "assumed_realized_usdt": str(dec(p["cash_spread_pnl"]) - dec(p["provisions"])),
        # Gross equity mark differs from spread P&L due to asset price changes.
        "assumed_equity_usdt": marked,
        "verified_fills": 0,
        "verified_realized_usdt": "0",
        "new_paper_fill": new_trade,
        "recent_paper_fills": trades[:20],
        "paper_blocked_reason": blocked,
        "spot_rebate": {
            "kucoin_scenario_pct": str(REBATE_ASSUMPTION["kucoin"] * 100),
            "gate_scenario_pct": str(REBATE_ASSUMPTION["gate"] * 100),
            "credited_to_trading_balance_usdt": "0",
            "affiliate_or_inviter_income_may_not_belong_to_trader": True,
            "scenario_not_verified": True,
            "rule": "Only count actual documented payouts to the relevant economic owner; no self-referral assumptions."
        },
        "ledger_warning": (
            "Initial 5k USDT KuCoin + 5k allocated Gate spot are hypothetical. "
            "No coins or USDT are invented after initialization. No instant rebalance, "
            "on-chain transfer, actual fee tier, exchange symbol identity, or rebate entitlement "
            "is verified. Provisions are estimated, not actual debits. Local SQLite is ephemeral."
        )
    }

def apply_paper(report, db_path, books):
    """One hypothetical fill at most per scan. Both cash and token balances settle."""
    now = datetime.datetime.now(datetime.timezone.utc)
    with sqlite3.connect(db_path, timeout=15) as con:
        con.execute("begin immediate")
        con.execute("create table if not exists inventory_v2_state (k text primary key, state_json text not null)")
        con.execute("create table if not exists inventory_v2_fills (id integer primary key autoincrement, ts text not null, route text not null, trade_json text not null)")
        row = con.execute("select state_json from inventory_v2_state where k='portfolio'").fetchone()
        if row:
            portfolio = json.loads(row[0])
        else:
            portfolio, block = starting_portfolio(books)
            if portfolio is None:
                con.commit()
                return {
                    "assumed_fills_total": 0, "assumed_realized_usdt": "0",
                    "assumed_equity_usdt": "10000", "verified_fills": 0,
                    "recent_paper_fills": [], "new_paper_fill": None,
                    "paper_blocked_reason": block,
                    "paper_model": "INITIAL_ALLOCATION_NOT_AVAILABLE",
                    "ledger_warning": "No paper fills until the starting Gate asset allocation is available.",
                }
        balances = portfolio["balances"]
        candidates = []
        blocked = None
        for ticker in allocation():
            for buy, sell in (("kucoin", "gate"), ("gate", "kucoin")):
                buy_cash = dec(balances[buy].get("USDT", "0"))
                sell_token = dec(balances[sell].get(ticker, "0"))
                candidate = simulate_book(ticker, buy, sell,
                    books.get((buy, ticker)), books.get((sell, ticker)),
                    buy_cash, sell_token)
                if candidate:
                    route = ticker + ":" + buy + ":" + sell
                    previous = con.execute("select ts from inventory_v2_fills where route=? order by id desc limit 1", (route,)).fetchone()
                    if previous and (now - datetime.datetime.fromisoformat(previous[0])).total_seconds() < COOLDOWN:
                        continue
                    candidates.append(candidate)
        candidates.sort(key=lambda x: (
            not (x["buy"] == "kucoin" and x["sell"] == "gate"),
            -dec(x["net"])))
        new_trade = None
        if candidates:
            new_trade = dict(candidates[0])
            buy, sell, ticker = new_trade["buy"], new_trade["sell"], new_trade["coin"]
            qty = dec(new_trade["qty"])
            cost = dec(new_trade["buy_cost"])
            proceeds = dec(new_trade["sell_proceeds"])
            bfee = dec(new_trade["buy_fee"])
            sfee = dec(new_trade["sell_fee"])
            remaining_cash = dec(balances[buy].get("USDT", "0")) - cost - bfee
            remaining_token = dec(balances[sell].get(ticker, "0")) - qty
            # Never borrow, simulate fractional balances only.
            if remaining_cash >= 0 and remaining_token >= 0:
                balances[buy]["USDT"] = str(remaining_cash)
                balances[buy][ticker] = str(dec(balances[buy].get(ticker, "0")) + qty)
                balances[sell]["USDT"] = str(dec(balances[sell].get("USDT", "0")) + proceeds - sfee)
                balances[sell][ticker] = str(remaining_token)
                portfolio["cash_spread_pnl"] = str(dec(portfolio["cash_spread_pnl"]) + dec(new_trade["spread_after_fee_usdt"]))
                portfolio["total_fee"] = str(dec(portfolio["total_fee"]) + dec(new_trade["fees"]))
                portfolio["rebate_forecast"] = str(dec(portfolio["rebate_forecast"]) + dec(new_trade["rebate_scenario_usdt"]))
                portfolio["provisions"] = str(dec(portfolio["provisions"]) + PROVISION)
                new_trade["fill_time_utc"] = now.isoformat()
                new_trade["mode"] = "ASSUMED_PAPER_FILL_NOT_AN_EXECUTED_ORDER"
                new_trade["rebate_credited_usdt"] = "0"
                new_trade["inventory_after"] = {ex: dict(balances[ex]) for ex in VENUES}
                con.execute("insert into inventory_v2_fills(ts,route,trade_json) values (?,?,?)",
                            (now.isoformat(), ticker + ":" + buy + ":" + sell, json.dumps(new_trade)))
            else:
                blocked = "Insufficient paper inventory at settlement"
                new_trade = None
        else:
            blocked = "No fee-and-reserve-positive, inventory-supported route currently available"
        equity, marks_stale = portfolio_mark(portfolio, books)
        con.execute("insert or replace into inventory_v2_state(k,state_json) values ('portfolio', ?)", (json.dumps(portfolio),))
        trades = [json.loads(item[0]) for item in con.execute("select trade_json from inventory_v2_fills order by id desc limit 100")]
        con.commit()
        return paper_response(portfolio, books, trades, new_trade, blocked)
