export const SETTLEMENT_ADAPTERS=Object.freeze({
 hyperliquid:Object.freeze({
  id:'hyperliquid',
  status:'bootstrap-active',
  model:'external-venue-settlement',
  executionAdapter:'hypercore',
  notes:'Current BELTRIX bootstrap execution/settlement venue. Kept behind adapter boundary.'
 }),
 orderly:Object.freeze({id:'orderly',status:'research-only',model:'external-venue-settlement',executionAdapter:'venue-orderly'}),
 gmx:Object.freeze({id:'gmx',status:'research-only',model:'onchain-contract-settlement',executionAdapter:'venue-gmx'}),
 paradex:Object.freeze({id:'paradex',status:'research-only',model:'external-appchain-settlement',executionAdapter:'venue-paradex'}),
 dydx:Object.freeze({id:'dydx',status:'research-only',model:'chain-settlement',executionAdapter:'venue-dydx'})
});

export function settlementAdapter(id){
 const row=SETTLEMENT_ADAPTERS[String(id||'')];
 if(!row)throw Error('Unknown settlement adapter: '+id);
 return row;
}

export function activeSettlementAdapters(){
 return Object.freeze(Object.values(SETTLEMENT_ADAPTERS).filter(x=>x.status==='bootstrap-active'));
}
