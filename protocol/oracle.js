const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export function normalizeOracleObservation(input={}){
 const source=String(input.source||'').trim().toLowerCase();
 const price=Number(input.price),timestamp=Number(input.timestamp);
 if(!source)throw Error('Oracle source is required');
 if(!finite(price)||price<=0)throw Error('Oracle price must be positive');
 if(!Number.isFinite(timestamp)||timestamp<=0)throw Error('Oracle timestamp is required');
 const confidenceBps=input.confidenceBps==null?null:Number(input.confidenceBps);
 if(confidenceBps!==null&&(!finite(confidenceBps)||confidenceBps<0))throw Error('Invalid oracle confidence');
 return Object.freeze({source,price,timestamp,confidenceBps});
}

function median(values){
 const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);
 return a.length%2?a[m]:(a[m-1]+a[m])/2;
}

export function oracleConsensus(observations,{now=Date.now(),maxAgeMs=15000,minSources=2,maxDeviationBps=100}={}){
 const latest=new Map();
 for(const raw of observations||[]){
  const row=normalizeOracleObservation(raw);
  const prior=latest.get(row.source);
  if(!prior||row.timestamp>prior.timestamp)latest.set(row.source,row);
 }
 const fresh=[...latest.values()].filter(x=>Number(now)-x.timestamp<=Number(maxAgeMs));
 if(fresh.length<Number(minSources)){
  return Object.freeze({ok:false,price:null,sources:fresh,reasons:Object.freeze(['insufficient-fresh-sources'])});
 }
 const px=median(fresh.map(x=>x.price));
 const deviations=fresh.map(x=>Math.abs(x.price-px)/px*10000);
 const worst=Math.max(...deviations);
 const reasons=[];
 if(worst>Number(maxDeviationBps))reasons.push('oracle-deviation');
 return Object.freeze({
  ok:reasons.length===0,
  price:px,
  sources:Object.freeze(fresh),
  worstDeviationBps:worst,
  reasons:Object.freeze(reasons)
 });
}
