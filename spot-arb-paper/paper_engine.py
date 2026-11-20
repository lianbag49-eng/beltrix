"""Hypothetical paper fills only; no brokerage credentials or order APIs."""
import datetime, json, os, sqlite3
from decimal import Decimal as D

COOLDOWN=int(os.getenv("PAPER_ROUTE_COOLDOWN_SECONDS","3600"))
START=D("10000")
MAX_BUY=D("5000")
def apply_paper(report,db_path):
    now=datetime.datetime.now(datetime.timezone.utc)
    with sqlite3.connect(db_path,timeout=15) as con:
        con.execute("create table if not exists paper_fills (id integer primary key autoincrement, ts text not null, pair text not null, fingerprint text not null, trade_json text not null, net_usdt text not null)")
        con.execute("create index if not exists idx_paper_fills_pair_ts on paper_fills(pair,ts)")
        prev=con.execute("select coalesce(sum(cast(net_usdt as real)),0),count(*) from paper_fills").fetchone()
        realized=D(str(prev[0]))
        count=int(prev[1])
        executed=None
        for candidate in report["opportunities"]:
            cost=D(candidate["buy_cost"])
            net=D(candidate["net"])
            # 5,000 USDT maximum buy side; other 5,000 represents pre-positioned spot inventory
            # Profit is not available for additional trading unless balances are reconciled.
            if cost<=0 or cost>MAX_BUY or net<=0: continue
            if D(candidate["sell_proceeds"]) > D("6000"): continue
            pair=f'{candidate["coin"]}:{candidate["buy"]}:{candidate["sell"]}'
            recent=con.execute("select ts from paper_fills where pair=? order by ts desc limit 1",(pair,)).fetchone()
            if recent:
                seconds=(now-datetime.datetime.fromisoformat(recent[0])).total_seconds()
                if seconds < COOLDOWN:continue
            # The identical opportunity from another scan must never be counted again during cooldown.
            fingerprint=f'{pair}:{candidate["best_ask"]}:{candidate["best_bid"]}'
            stamp=now.isoformat()
            executed={**candidate,"fill_time_utc":stamp,"mode":"ASSUMED_PREPOSITIONED_SPOT_FILL","verification":"UNVERIFIED_NETWORK_INVENTORY_AND_REBALANCE","capital_assumption":"USD 5k for buy + USD 5k prepositioned sell-side token; synthetic rebalance assumed; no actual transfers"}
            con.execute("insert into paper_fills(ts,pair,fingerprint,trade_json,net_usdt) values(?,?,?,?,?)",(stamp,pair,fingerprint,json.dumps(executed),str(net)))
            realized+=net;count+=1
            break
        recent_fills=[json.loads(x[0]) for x in con.execute("select trade_json from paper_fills order by id desc limit 20")]
        con.commit()
        return {"assumed_fills_total":count,"assumed_realized_usdt":str(realized),"assumed_equity_usdt":str(START+realized),"verified_fills":0,"verified_realized_usdt":"0","new_paper_fill":executed,"recent_paper_fills":recent_fills,"ledger_warning":"Synthetic spot fills and rebalance are assumptions, not live trades. Local SQLite on Render free service can reset on restart."}
