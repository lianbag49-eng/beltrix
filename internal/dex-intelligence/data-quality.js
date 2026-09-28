const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export const DEFAULT_QUALITY_POLICY=Object.freeze({
 maxSnapshotAgeMs:30*60*1000,
 maxVenueLatencyMs:10000,
 maxSpreadBps:2500,
 depthJumpRatio:12,
 spreadJumpRatio:12
});

function issue(code,severity,detail,evidence={}){
 return Object.freeze({code,severity,detail,evidence:Object.freeze({...evidence})});
}

function ratioJump(current,previous,limit){
 if(!finite(current)||!finite(previous)||Number(previous)===0)return false;
 const a=Math.abs(Number(current)),b=Math.abs(Number(previous));
 const ratio=Math.max(a/b,b/Math.max(a,Number.EPSILON));
 return ratio>=limit;
}

export function evaluateVenueQuality(state={},previous=null,{policy=DEFAULT_QUALITY_POLICY}={}){
 const issues=[];
 if(state.ok===false)issues.push(issue('collector-unavailable','critical','Venue snapshot is unavailable.'));
 if(finite(state.latencyMs)&&Number(state.latencyMs)<0)issues.push(issue('invalid-latency','critical','Latency cannot be negative.'));
 if(finite(state.latencyMs)&&Number(state.latencyMs)>policy.maxVenueLatencyMs)issues.push(issue('latency-extreme','warning','Venue latency is unusually high.',{latencyMs:Number(state.latencyMs)}));
 if(finite(state.spreadBps)&&(Number(state.spreadBps)<0||Number(state.spreadBps)>policy.maxSpreadBps))issues.push(issue('spread-range','critical','Spread is outside the accepted telemetry range.',{spreadBps:Number(state.spreadBps)}));
 if(finite(state.minFillRatio)&&(Number(state.minFillRatio)<0||Number(state.minFillRatio)>1.000001))issues.push(issue('fill-range','critical','Fill ratio is outside 0..1.',{minFillRatio:Number(state.minFillRatio)}));
 for(const key of ['depth25Usd','capacityLongUsd','capacityShortUsd']){
  if(finite(state[key])&&Number(state[key])<0)issues.push(issue('negative-'+key,'critical',key+' cannot be negative.',{value:Number(state[key])}));
 }
 if(previous&&ratioJump(state.depth25Usd,previous.depth25Usd,policy.depthJumpRatio))issues.push(issue('depth-outlier','warning','Depth changed by an unusually large ratio versus the previous snapshot.'));
 if(previous&&ratioJump(state.spreadBps,previous.spreadBps,policy.spreadJumpRatio))issues.push(issue('spread-outlier','warning','Spread changed by an unusually large ratio versus the previous snapshot.'));
 if(Array.isArray(state.flags)&&state.flags.includes('stale'))issues.push(issue('venue-stale','warning','Venue reported stale supporting data.'));
 const critical=issues.filter(x=>x.severity==='critical').length;
 const warnings=issues.filter(x=>x.severity==='warning').length;
 const score=Math.max(0,100-critical*40-warnings*12);
 const status=critical?'untrusted':warnings?'degraded':'valid';
 return Object.freeze({status,score,critical,warnings,issues:Object.freeze(issues)});
}

export function evaluateSnapshotQuality(snapshot={},previousSnapshot=null,{
 now=Date.now(),
 policy=DEFAULT_QUALITY_POLICY
}={}){
 const timestamp=Number(snapshot?.timestamp);
 const ageMs=Number.isFinite(timestamp)?Math.max(0,Number(now)-timestamp):null;
 const snapshotIssues=[];
 if(ageMs===null)snapshotIssues.push(issue('missing-timestamp','critical','Snapshot timestamp is missing or invalid.'));
 else if(ageMs>policy.maxSnapshotAgeMs)snapshotIssues.push(issue('snapshot-stale','warning','Snapshot is older than the quality freshness window.',{ageMs}));
 const venues=[];
 for(const [venue,state] of Object.entries(snapshot?.venues||{})){
  const q=evaluateVenueQuality(state,previousSnapshot?.venues?.[venue]||null,{policy});
  venues.push(Object.freeze({venue,...q}));
 }
 const critical=snapshotIssues.filter(x=>x.severity==='critical').length+venues.reduce((n,v)=>n+v.critical,0);
 const warnings=snapshotIssues.filter(x=>x.severity==='warning').length+venues.reduce((n,v)=>n+v.warnings,0);
 const score=venues.length?Math.round(venues.reduce((n,v)=>n+v.score,0)/venues.length):0;
 const status=critical?'untrusted':warnings?'degraded':'valid';
 return Object.freeze({
  asset:String(snapshot?.asset||'').toUpperCase(),
  status,score,critical,warnings,ageMs,
  snapshotIssues:Object.freeze(snapshotIssues),
  venues:Object.freeze(venues)
 });
}


export function qualityAlerts(quality){
 if(!quality)return Object.freeze([]);
 const out=[];
 for(const x of quality.snapshotIssues||[]){
  out.push(Object.freeze({
   venue:'collector',
   key:'quality-'+x.code,
   severity:x.severity,
   message:x.detail,
   evidence:Object.freeze({...x.evidence,qualityScore:quality.score})
  }));
 }
 for(const venue of quality.venues||[]){
  for(const x of venue.issues||[]){
   out.push(Object.freeze({
    venue:venue.venue,
    key:'quality-'+x.code,
    severity:x.severity,
    message:x.detail,
    evidence:Object.freeze({...x.evidence,qualityScore:venue.score})
   }));
  }
 }
 return Object.freeze(out);
}
