const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const clone=v=>JSON.parse(JSON.stringify(v));
export const DEFAULT_HISTORY_KEY='beltrix.dex-intelligence.telemetry.v1';

export function makeTelemetrySnapshot({asset,bookRows=[],gmxState=null,metricRows=[],timestamp=Date.now()}={}){
 const metrics=Object.fromEntries((metricRows||[]).map(x=>[x.venue,x]));
 const venues={};
 for(const row of bookRows||[]){
  venues[row.venue]={
   ok:Boolean(row.ok),
   latencyMs:finite(row.latencyMs)?Number(row.latencyMs):null,
   health:row.health?.status||'unavailable',
   spreadBps:finite(row.snapshot?.book?.spreadBps)?Number(row.snapshot.book.spreadBps):null,
   depth25Usd:finite(row.snapshot?.depth?.[25]?.total)?Number(row.snapshot.depth[25].total):null,
   minFillRatio:finite(Math.min(row.buy?.fillRatio??0,row.sell?.fillRatio??0))?Math.min(row.buy?.fillRatio??0,row.sell?.fillRatio??0):null,
   metric:metrics[row.venue]||null
  };
 }
 if(gmxState){
  venues.gmx={
   ok:Boolean(gmxState.ok),
   latencyMs:finite(gmxState.latencyMs)?Number(gmxState.latencyMs):null,
   health:gmxState.ok?'live':'unavailable',
   spreadBps:null,
   depth25Usd:null,
   minFillRatio:null,
   capacityLongUsd:finite(gmxState.capacity?.long?.availableLiquidityUsd)?Number(gmxState.capacity.long.availableLiquidityUsd):null,
   capacityShortUsd:finite(gmxState.capacity?.short?.availableLiquidityUsd)?Number(gmxState.capacity.short.availableLiquidityUsd):null,
   metric:metrics.gmx||null
  };
 }
 for(const metric of metricRows||[]){
  if(!venues[metric.venue]){
   venues[metric.venue]={
    ok:Boolean(metric.ok),latencyMs:finite(metric.latencyMs)?Number(metric.latencyMs):null,
    health:metric.ok?'live':'unavailable',spreadBps:null,depth25Usd:null,minFillRatio:null,metric
   };
  }
 }
 return Object.freeze({version:1,asset:String(asset||''),timestamp:Number(timestamp),venues:Object.freeze(clone(venues))});
}

export function appendTelemetry(history,snapshot,{maxEntries=720,maxAgeMs=7*24*60*60*1000,now=Date.now()}={}){
 const rows=Array.isArray(history)?history.filter(Boolean).map(clone):[];
 rows.push(clone(snapshot));
 const cutoff=Number(now)-Number(maxAgeMs);
 const filtered=rows.filter(x=>Number(x.timestamp)>=cutoff).sort((a,b)=>Number(a.timestamp)-Number(b.timestamp));
 return Object.freeze(filtered.slice(-Math.max(1,Number(maxEntries)||720)));
}

export function loadTelemetry(storage,{key=DEFAULT_HISTORY_KEY}={}){
 try{
  const raw=storage?.getItem?.(key);
  const parsed=raw?JSON.parse(raw):[];
  return Array.isArray(parsed)?parsed:[];
 }catch{return []}
}

export function saveTelemetry(storage,snapshot,{key=DEFAULT_HISTORY_KEY,maxEntries=720,maxAgeMs,now=Date.now()}={}){
 const next=appendTelemetry(loadTelemetry(storage,{key}),snapshot,{maxEntries,maxAgeMs,now});
 storage?.setItem?.(key,JSON.stringify(next));
 return next;
}

export function telemetryForAsset(history,asset){
 return (Array.isArray(history)?history:[]).filter(x=>x?.asset===asset).sort((a,b)=>a.timestamp-b.timestamp);
}

export function apiHealthSummary(history,asset){
 const rows=telemetryForAsset(history,asset);
 const venues={};
 for(const snap of rows){
  for(const [venue,state] of Object.entries(snap.venues||{})){
   const v=venues[venue]||(venues[venue]={samples:0,ok:0,latencies:[],lastStatus:null,lastSeen:null});
   v.samples+=1;if(state?.ok)v.ok+=1;
   if(finite(state?.latencyMs))v.latencies.push(Number(state.latencyMs));
   v.lastStatus=state?.health||null;v.lastSeen=snap.timestamp;
  }
 }
 return Object.freeze(Object.fromEntries(Object.entries(venues).map(([venue,v])=>{
  const sorted=[...v.latencies].sort((a,b)=>a-b);
  const avg=sorted.length?sorted.reduce((a,b)=>a+b,0)/sorted.length:null;
  const p95=sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*0.95))]:null;
  return [venue,Object.freeze({
   samples:v.samples,
   successRatio:v.samples?v.ok/v.samples:0,
   avgLatencyMs:avg,
   p95LatencyMs:p95,
   lastStatus:v.lastStatus,
   lastSeen:v.lastSeen
  })];
 })));
}
