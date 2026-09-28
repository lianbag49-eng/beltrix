import {runMarketIntelligenceCycle} from './collector-runner.js';

export const DEFAULT_SCHEDULED_ASSETS=Object.freeze(['BTC','ETH','SOL']);

export async function runMarketIntelligenceBatch({
 assets=DEFAULT_SCHEDULED_ASSETS,
 cycle=runMarketIntelligenceCycle,
 cycleOptions={},
 now=Date.now()
}={}){
 const startedAt=Number(now);
 const rows=[];
 for(const raw of assets){
  const asset=String(raw||'').trim().toUpperCase();
  if(!asset)continue;
  const assetStarted=Date.now();
  try{
   const result=await cycle(asset,cycleOptions);
   rows.push(Object.freeze({
    asset,
    ok:true,
    durationMs:Math.max(0,Date.now()-assetStarted),
    snapshot:result.snapshot,
    alerts:result.alerts,
    bdEvents:result.bdEvents,
    intelligence:result.intelligence,
    persistence:result.persistence??null
   }));
  }catch(error){
   rows.push(Object.freeze({
    asset,
    ok:false,
    durationMs:Math.max(0,Date.now()-assetStarted),
    error:String(error?.message||error)
   }));
  }
 }
 const successful=rows.filter(x=>x.ok).length;
 return Object.freeze({
  version:1,
  startedAt,
  finishedAt:Date.now(),
  assets:Object.freeze([...assets].map(x=>String(x))),
  successful,
  failed:rows.length-successful,
  ok:successful>0,
  rows:Object.freeze(rows)
 });
}
