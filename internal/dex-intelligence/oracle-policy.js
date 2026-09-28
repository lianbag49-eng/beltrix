const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export const DEFAULT_ORACLE_POLICY=Object.freeze({
 minSources:2,
 maxAgeMs:30000,
 maxDeviationBps:100
});

export function evaluateOracleObservations(observations=[],{
 now=Date.now(),
 policy=DEFAULT_ORACLE_POLICY
}={}){
 const rows=(observations||[]).map(x=>({
  source:String(x?.source||''),
  price:finite(x?.price)?Number(x.price):null,
  timestamp:Number(x?.timestamp)
 })).filter(x=>x.source&&x.price!==null&&Number.isFinite(x.timestamp)&&x.timestamp>0);
 const fresh=rows.filter(x=>Math.max(0,Number(now)-x.timestamp)<=policy.maxAgeMs);
 if(fresh.length<policy.minSources){
  return Object.freeze({status:'blocked',reason:'insufficient_fresh_sources',sources:fresh.length,price:null,maxDeviationBps:null});
 }
 const sorted=fresh.map(x=>x.price).sort((a,b)=>a-b);
 const mid=sorted[Math.floor(sorted.length/2)];
 const deviations=fresh.map(x=>Math.abs(x.price-mid)/mid*10000);
 const maxDeviationBps=Math.max(...deviations);
 if(maxDeviationBps>policy.maxDeviationBps){
  return Object.freeze({status:'blocked',reason:'source_deviation',sources:fresh.length,price:mid,maxDeviationBps});
 }
 return Object.freeze({status:'valid',reason:'quorum_met',sources:fresh.length,price:mid,maxDeviationBps});
}
