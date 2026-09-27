import {canonicalTradeIntent,validateIntentFreshness} from './intent.js';
import {oracleConsensus} from './oracle.js';
import {assessIntentRisk} from './risk.js';

function selectSettlement(intent,market,settlementRegistry){
 const allowed=new Set(market.settlementIds);
 const preferences=intent.settlementPreferences||[];
 const ordered=preferences.length?preferences:market.settlementIds;
 for(const id of ordered){
  if(!allowed.has(id))continue;
  const adapter=settlementRegistry.get(id);
  if(adapter.status==='live'||adapter.status==='test')return adapter;
 }
 throw Error('No user-permitted live settlement is available for '+market.id);
}

export function prepareBeltrixTrade({
 intent,
 marketRegistry,
 settlementRegistry,
 oracleObservations,
 marketState={},
 settlementContextById={},
 now=Date.now()
}={}){
 const i=canonicalTradeIntent(intent);
 validateIntentFreshness(i,now);
 const market=marketRegistry.get(i.market);
 if(market.status!=='active')throw Error('BELTRIX market is not active: '+market.id);

 const oracle=oracleConsensus(oracleObservations,{
  now,
  minSources:market.oraclePolicy.minSources,
  maxAgeMs:market.oraclePolicy.maxAgeMs,
  maxDeviationBps:market.oraclePolicy.maxDeviationBps
 });
 const risk=assessIntentRisk(i,{policy:market.riskPolicy,oracle,marketState});
 if(!oracle.ok||!risk.allowed){
  return Object.freeze({
   ok:false,
   intent:i,
   market,
   oracle,
   risk,
   settlement:null,
   prepared:null,
   reasons:Object.freeze([...new Set([...(oracle.reasons||[]),...(risk.reasons||[])])])
  });
 }

 const settlement=selectSettlement(i,market,settlementRegistry);
 const context=settlementContextById[settlement.id]||{};
 const prepared=settlement.prepareIntent(i,{...context,now,protocolMarket:market});
 return Object.freeze({
  ok:true,
  intent:i,
  market,
  oracle,
  risk,
  settlement:Object.freeze({id:settlement.id,label:settlement.label,status:settlement.status}),
  prepared,
  reasons:Object.freeze([])
 });
}
