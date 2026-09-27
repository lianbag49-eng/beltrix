const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export const TREND_METRICS=Object.freeze({
 funding:Object.freeze({label:'Funding',path:['metric','fundingRate'],scale:100,unit:'%'}),
 openInterestUsd:Object.freeze({label:'Open Interest USD',path:['metric','openInterestUsd'],scale:1,unit:'USD'}),
 volume24hUsd:Object.freeze({label:'24h Volume USD',path:['metric','volume24hUsd'],scale:1,unit:'USD'}),
 latency:Object.freeze({label:'API Latency',path:['latencyMs'],scale:1,unit:'ms'}),
 spread:Object.freeze({label:'Spread',path:['spreadBps'],scale:1,unit:'bps'}),
 depth25:Object.freeze({label:'Depth ±25bps',path:['depth25Usd'],scale:1,unit:'USD'})
});

const getPath=(obj,path)=>path.reduce((v,k)=>v?.[k],obj);

export function venueTrendSeries(history,{asset,venue,metric='funding'}={}){
 const config=TREND_METRICS[metric];
 if(!config)throw Error('Unknown trend metric: '+metric);
 const rows=[];
 for(const snap of Array.isArray(history)?history:[]){
  if(asset&&snap?.asset!==asset)continue;
  const state=snap?.venues?.[venue];
  const raw=getPath(state,config.path);
  if(!finite(raw))continue;
  rows.push(Object.freeze({
   timestamp:Number(snap.timestamp),
   value:Number(raw)*config.scale
  }));
 }
 rows.sort((a,b)=>a.timestamp-b.timestamp);
 return Object.freeze({
  venue:String(venue||''),
  asset:String(asset||''),
  metric,
  label:config.label,
  unit:config.unit,
  points:Object.freeze(rows)
 });
}

export function seriesStats(series){
 const points=series?.points||[];
 if(!points.length)return Object.freeze({count:0,min:null,max:null,first:null,last:null,change:null});
 const values=points.map(x=>x.value);
 const first=values[0],last=values[values.length-1];
 return Object.freeze({
  count:values.length,
  min:Math.min(...values),
  max:Math.max(...values),
  first,
  last,
  change:last-first
 });
}
