const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export const DEFAULT_ALERT_RULES=Object.freeze({
 latencyWarningMs:1500,
 latencyCriticalMs:5000,
 successRatioWarning:0.95,
 successRatioCritical:0.75,
 minFillWarning:0.99,
 staleWarningMs:30000,
 depthDropRatioWarning:0.5
});

const alert=(venue,key,severity,message,evidence={})=>Object.freeze({
 venue:String(venue||''),
 key:String(key||''),
 severity,
 message,
 evidence:Object.freeze({...evidence})
});

export function evaluateVenueAlerts(row,{healthHistory=null,previous=null,rules=DEFAULT_ALERT_RULES}={}){
 const venue=String(row?.venue||'');
 const out=[];
 if(!row||row.dataStatus==='unavailable'||row.ok===false){
  out.push(alert(venue,'collector-unavailable','critical','Market-data collector is unavailable.'));
  return Object.freeze(out);
 }
 if(finite(row.freshnessMs)&&Number(row.freshnessMs)>rules.staleWarningMs){
  out.push(alert(venue,'stale-data','warning','Market data is stale.',{freshnessMs:Number(row.freshnessMs)}));
 }
 const latency=healthHistory?.avgLatencyMs;
 if(finite(latency)){
  const n=Number(latency);
  if(n>=rules.latencyCriticalMs)out.push(alert(venue,'api-latency','critical','Average API latency is above the critical threshold.',{avgLatencyMs:n}));
  else if(n>=rules.latencyWarningMs)out.push(alert(venue,'api-latency','warning','Average API latency is elevated.',{avgLatencyMs:n}));
 }
 const success=healthHistory?.successRatio;
 if(finite(success)){
  const n=Number(success);
  if(n<rules.successRatioCritical)out.push(alert(venue,'api-success','critical','API success ratio is below the critical threshold.',{successRatio:n}));
  else if(n<rules.successRatioWarning)out.push(alert(venue,'api-success','warning','API success ratio is degraded.',{successRatio:n}));
 }
 if(finite(row.minFillRatio)&&Number(row.minFillRatio)<rules.minFillWarning){
  out.push(alert(venue,'fill-ratio','warning','Simulated order is not fully filled at the selected notional.',{minFillRatio:Number(row.minFillRatio)}));
 }
 if(finite(previous?.depth25Usd)&&finite(row.depth25Usd)&&Number(previous.depth25Usd)>0){
  const ratio=Number(row.depth25Usd)/Number(previous.depth25Usd);
  if(ratio<rules.depthDropRatioWarning){
   out.push(alert(venue,'depth-drop','warning','±25 bps depth dropped materially versus the previous snapshot.',{
    previousDepth25Usd:Number(previous.depth25Usd),
    depth25Usd:Number(row.depth25Usd),
    ratio
   }));
  }
 }
 if(row.flags?.includes('stale')&&!out.some(x=>x.key==='stale-data')){
  out.push(alert(venue,'stale-data','warning','Venue reports stale supporting data.'));
 }
 return Object.freeze(out);
}

export function evaluateMarketAlerts(rows,{healthByVenue={},previousByVenue={},rules=DEFAULT_ALERT_RULES}={}){
 const alerts=[];
 for(const row of rows||[]){
  alerts.push(...evaluateVenueAlerts(row,{
   healthHistory:healthByVenue[row.venue]||null,
   previous:previousByVenue[row.venue]||null,
   rules
  }));
 }
 return Object.freeze(alerts);
}

export function dedupeAlerts(alerts=[]){
 const map=new Map();
 const rank={info:0,warning:1,critical:2};
 for(const item of alerts){
  const id=item.venue+'|'+item.key;
  const existing=map.get(id);
  if(!existing||rank[item.severity]>rank[existing.severity])map.set(id,item);
 }
 return Object.freeze([...map.values()]);
}
