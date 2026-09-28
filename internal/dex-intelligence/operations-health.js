const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export const DEFAULT_OPERATIONS_THRESHOLDS=Object.freeze({
 freshMs:25*60*1000,
 delayedMs:35*60*1000,
 staleMs:45*60*1000
});

function runTime(row){
 const raw=row?.finished_at||row?.finishedAt||null;
 const t=raw?new Date(raw).getTime():NaN;
 return Number.isFinite(t)?t:null;
}

export function collectorOperationalState(rows=[],{
 now=Date.now(),
 thresholds=DEFAULT_OPERATIONS_THRESHOLDS
}={}){
 const ordered=[...(rows||[])].sort((a,b)=>(runTime(b)||0)-(runTime(a)||0));
 const latest=ordered[0]||null;
 const latestAt=runTime(latest);
 if(!latest||latestAt===null){
  return Object.freeze({status:'down',reason:'no-collector-runs',ageMs:null,lastRunAt:null,successfulAssets:0,failedAssets:0,consecutiveFailedRuns:0});
 }
 const ageMs=Math.max(0,Number(now)-latestAt);
 const successfulAssets=Math.max(0,Number(latest.successful_assets??latest.successfulAssets??0));
 const failedAssets=Math.max(0,Number(latest.failed_assets??latest.failedAssets??0));
 let consecutiveFailedRuns=0;
 for(const row of ordered){
  const ok=Number(row.successful_assets??row.successfulAssets??0)>0;
  if(ok)break;
  consecutiveFailedRuns++;
 }
 let status='fresh',reason='collector-current';
 if(successfulAssets===0||consecutiveFailedRuns>=2){status='down';reason='collector-failing'}
 else if(ageMs>thresholds.staleMs){status='down';reason:'collector-overdue'}
 else if(ageMs>thresholds.delayedMs){status='stale';reason='collector-stale'}
 else if(ageMs>thresholds.freshMs){status='delayed';reason='collector-delayed'}
 return Object.freeze({
  status,reason,ageMs,lastRunAt:new Date(latestAt).toISOString(),
  successfulAssets,failedAssets,consecutiveFailedRuns
 });
}

export function venueOperationalState(state={},alerts=[]){
 const health=String(state?.health||'').toLowerCase();
 const active=(alerts||[]).filter(a=>a?.venue===state?.venue||!state?.venue);
 const critical=active.filter(a=>a?.severity==='critical').length;
 const warning=active.filter(a=>a?.severity==='warning').length;
 let status='healthy';
 const reasons=[];
 if(state?.ok===false||health==='unavailable'){status='down';reasons.push('collector-unavailable')}
 else if(critical){status='down';reasons.push('critical-alert')}
 else if(health==='degraded'||warning){status='degraded';reasons.push(health==='degraded'?'venue-degraded':'warning-alert')}
 if(finite(state?.latencyMs)&&Number(state.latencyMs)>=5000){status='down';reasons.push('latency-critical')}
 else if(finite(state?.latencyMs)&&Number(state.latencyMs)>=1500&&status==='healthy'){status='degraded';reasons.push('latency-elevated')}
 return Object.freeze({status,reasons:Object.freeze([...new Set(reasons)]),critical,warning});
}

export function buildOperationsSummary({collectorRuns=[],latestSnapshot=null,alerts=[],now=Date.now()}={}){
 const collector=collectorOperationalState(collectorRuns,{now});
 const venues=[];
 for(const [venue,raw] of Object.entries(latestSnapshot?.venues||{})){
  venues.push(Object.freeze({venue,...venueOperationalState({...raw,venue},alerts)}));
 }
 const down=venues.filter(v=>v.status==='down').length;
 const degraded=venues.filter(v=>v.status==='degraded').length;
 const overall=collector.status==='down'||down?'down':collector.status==='stale'||collector.status==='delayed'||degraded?'degraded':'healthy';
 return Object.freeze({
  overall,
  collector,
  venues:Object.freeze(venues),
  counts:Object.freeze({venues:venues.length,down,degraded,healthy:venues.filter(v=>v.status==='healthy').length}),
  generatedAt:new Date(Number(now)).toISOString()
 });
}
