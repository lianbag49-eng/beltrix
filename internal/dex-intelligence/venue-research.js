export const RESEARCH_STATUSES=Object.freeze([
 'documented','implemented','tested','blocked','unknown'
]);

const item=(status,note,sources=[])=>Object.freeze({
 status:RESEARCH_STATUSES.includes(status)?status:'unknown',
 note:String(note||''),
 sources:Object.freeze([...sources])
});

export const VENUE_RESEARCH=Object.freeze({
 orderly:Object.freeze({
  venue:'orderly',
  checkedAt:'2026-09-27',
  whiteLabel:Object.freeze({
   launch:item('documented','Orderly One exposes DEX creation, custom frontend/domain management and broker graduation workflows.',[
    'https://dex-api.orderly.network/',
    'https://dex.orderly.network/'
   ]),
   economics:item('documented','Builder/broker fee configuration is part of the DEX graduation flow; live commercial terms must still be reconciled before launch.',[
    'https://dex-api.orderly.network/',
    'https://orderly.network/faq'
   ]),
   liquidity:item('documented','Orderly describes a shared orderbook/liquidity model across builders.',[
    'https://orderly.network/',
    'https://dex.orderly.network/'
   ]),
   operationalExit:item('unknown','Migration, shutdown, custody dependency and export procedures still require direct commercial/technical review.')
  }),
  execution:Object.freeze({
   signing:item('unknown','BELTRIX has not implemented Orderly private signing/auth for competitor execution.'),
   orderLifecycle:item('unknown','Public book integration exists; private order lifecycle is not implemented in BELTRIX.'),
   rateLimits:item('unknown','Production private trading limits have not yet been normalized into BELTRIX.'),
   testnetE2E:item('blocked','No funded/testnet BELTRIX E2E has been run; execution remains research-only.')
  })
 }),
 gmx:Object.freeze({
  venue:'gmx',
  checkedAt:'2026-09-27',
  marketModel:Object.freeze({
   capacity:item('documented','GMX exposes JIT-aware per-side trading capacity with base/JIT liquidity, limiting factor and data-status fields.',[
    'https://docs.gmx.io/docs/api/integration-guide/',
    'https://docs.gmx.io/docs/sdk/changelog/'
   ]),
   priceImpact:item('documented','GMX price impact is pool/open-interest based and distinct from slippage; it must not be modeled as CLOB depth.',[
    'https://docs.gmx.io/docs/trading/fees/'
   ]),
   riskControls:item('documented','Market-level reserve factors, open-interest caps, PnL controls and ADL are part of the liquidity/risk model.',[
    'https://docs.gmx.io/docs/providing-liquidity/'
   ])
  }),
  execution:Object.freeze({
   signing:item('unknown','BELTRIX does not yet prepare or sign GMX orders.'),
   orderLifecycle:item('unknown','Order preparation, execution and reconciliation are not implemented in BELTRIX.'),
   capacityValidation:item('implemented','Read-only trading-capacity collection is implemented; request-specific prepare-order validation is not.'),
   testnetE2E:item('blocked','No execution E2E is enabled.')
  })
 }),
 paradex:Object.freeze({
  venue:'paradex',
  checkedAt:'2026-09-27',
  execution:Object.freeze({
   auth:item('documented','Private REST uses short-lived JWT authentication; signed orders include a signature and signature timestamp.',[
    'https://docs.paradex.trade/api/general-information/authentication',
    'https://docs.paradex.trade/api/testnet/orders/new'
   ]),
   orderLifecycle:item('documented','Documented NEW → OPEN/CLOSED lifecycle, cancel queueing and websocket/REST confirmation paths.',[
    'https://docs.paradex.trade/api/testnet/orders/new',
    'https://docs.paradex.trade/api/prod/orders/cancel'
   ]),
   rateLimits:item('documented','Public and private endpoint limits are documented, including account and IP constraints.',[
    'https://docs.paradex.trade/api/general-information/rate-limits/api'
   ]),
   realtime:item('documented','Private account updates use authenticated WebSockets; public WebSocket payloads require SBE as of 2026-09-21.',[
    'https://docs.paradex.trade/ws/general-information/introduction'
   ]),
   testnetE2E:item('blocked','Testnet endpoints are documented but BELTRIX has not executed signed test orders.')
  })
 }),
 dydx:Object.freeze({
  venue:'dydx',
  checkedAt:'2026-09-27',
  execution:Object.freeze({
   architecture:item('documented','Indexer is a read-oriented service while orders are submitted through dYdX Chain node/client flows.',[
    'https://github.com/dydxprotocol/v4-chain',
    'https://github.com/dydxprotocol/v4-clients'
   ]),
   orderLifecycle:item('documented','Official clients expose place-order/cancel transaction types and short-term order examples.',[
    'https://github.com/dydxprotocol/v4-clients/blob/main/v4-client-rs/client/examples/place_order_short_term.rs',
    'https://github.com/dydxprotocol/v4-clients'
   ]),
   realtime:item('documented','Indexer WebSocket supports orderbook and subaccount channels for mainnet/testnet.',[
    'https://github.com/dydxprotocol/v4-chain/blob/main/indexer/README.md'
   ]),
   testnet:item('documented','Official client constants/configuration expose dYdX testnet chain, indexer and validator endpoints.',[
    'https://github.com/dydxprotocol/v4-clients'
   ]),
   testnetE2E:item('blocked','BELTRIX has not submitted/cancelled a signed dYdX testnet order.')
  })
 })
});

export function researchProfile(venue){
 return VENUE_RESEARCH[String(venue||'')]||null;
}

export function flattenResearch(profile){
 if(!profile)return [];
 const rows=[];
 for(const [group,value] of Object.entries(profile)){
  if(['venue','checkedAt'].includes(group)||!value||typeof value!=='object')continue;
  for(const [key,entry] of Object.entries(value)){
   if(!entry||!entry.status)continue;
   rows.push(Object.freeze({
    group,
    key,
    status:entry.status,
    note:entry.note,
    sources:[...(entry.sources||[])]
   }));
  }
 }
 return Object.freeze(rows);
}

export function researchCoverage(venue){
 const rows=flattenResearch(researchProfile(venue));
 if(!rows.length)return Object.freeze({documented:0,implemented:0,tested:0,blocked:0,unknown:0,total:0,knownRatio:0});
 const counts={documented:0,implemented:0,tested:0,blocked:0,unknown:0};
 for(const row of rows)counts[row.status]=(counts[row.status]||0)+1;
 const known=rows.length-(counts.unknown||0);
 return Object.freeze({...counts,total:rows.length,knownRatio:known/rows.length});
}
