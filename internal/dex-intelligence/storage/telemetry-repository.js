export function normalizeServerSnapshot(snapshot={}){
 const asset=String(snapshot.asset||'').trim().toUpperCase();
 const capturedAt=new Date(Number(snapshot.timestamp)||Date.now()).toISOString();
 const observations=[];
 for(const [venue,state] of Object.entries(snapshot.venues||{})){
  const metric=state?.metric||{};
  observations.push(Object.freeze({
   venue,
   ok:Boolean(state?.ok),
   health:state?.health||null,
   latencyMs:Number.isFinite(Number(state?.latencyMs))?Number(state.latencyMs):null,
   spreadBps:Number.isFinite(Number(state?.spreadBps))?Number(state.spreadBps):null,
   depth25Usd:Number.isFinite(Number(state?.depth25Usd))?Number(state.depth25Usd):null,
   minFillRatio:Number.isFinite(Number(state?.minFillRatio))?Number(state.minFillRatio):null,
   fundingRate:Number.isFinite(Number(metric?.fundingRate))?Number(metric.fundingRate):null,
   openInterest:Number.isFinite(Number(metric?.openInterest))?Number(metric.openInterest):null,
   openInterestUsd:Number.isFinite(Number(metric?.openInterestUsd))?Number(metric.openInterestUsd):null,
   openInterestUnit:metric?.openInterestUnit||null,
   volume24h:Number.isFinite(Number(metric?.volume24h))?Number(metric.volume24h):null,
   volume24hUsd:Number.isFinite(Number(metric?.volume24hUsd))?Number(metric.volume24hUsd):null,
   volume24hUnit:metric?.volume24hUnit||null,
   capacityLongUsd:Number.isFinite(Number(state?.capacityLongUsd))?Number(state.capacityLongUsd):null,
   capacityShortUsd:Number.isFinite(Number(state?.capacityShortUsd))?Number(state.capacityShortUsd):null,
   flags:Array.isArray(state?.flags)?[...state.flags]:[]
  }));
 }
 return Object.freeze({
  asset,
  capturedAt,
  payload:snapshot,
  observations:Object.freeze(observations)
 });
}

export function createTelemetryRepository(adapter){
 if(!adapter||typeof adapter.insertSnapshot!=='function'||typeof adapter.querySnapshots!=='function'){
  throw Error('Telemetry repository adapter requires insertSnapshot and querySnapshots');
 }
 return Object.freeze({
  async save(snapshot){
   return adapter.insertSnapshot(normalizeServerSnapshot(snapshot));
  },
  async history({asset,since,limit=1000}={}){
   return adapter.querySnapshots({
    asset:String(asset||'').trim().toUpperCase(),
    since:since?new Date(since).toISOString():null,
    limit:Math.max(1,Math.min(10000,Number(limit)||1000))
   });
  },
  async collectorHealth({limit=100}={}){
   if(typeof adapter.queryCollectorHealth!=='function')return [];
   return adapter.queryCollectorHealth({limit:Math.max(1,Math.min(500,Number(limit)||100))});
  },
  async openAlerts({limit=200}={}){
   if(typeof adapter.queryOpenAlerts!=='function')return [];
   return adapter.queryOpenAlerts({limit:Math.max(1,Math.min(1000,Number(limit)||200))});
  }
 });
}
