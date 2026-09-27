import {INITIAL_QUALIFICATION} from './execution-qualification.js';
import {researchCoverage} from './venue-research.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export function venueIntelligenceRow(bookRow,{gmxState=null}={}){
 const venue=String(bookRow?.venue||'');
 const qualification=INITIAL_QUALIFICATION[venue]||null;
 const research=researchCoverage(venue);

 if(venue==='gmx'||(!bookRow&&gmxState?.venue==='gmx')){
  const state=gmxState||{};
  const capacity=state.capacity||{};
  const long=capacity.long||null,short=capacity.short||null;
  const flags=['model-specific'];
  if(!state.ok)flags.push('collector-error');
  if(long?.jitDataStatus==='stale'||short?.jitDataStatus==='stale'||long?.marketDataStatus==='stale'||short?.marketDataStatus==='stale')flags.push('stale');
  if(!long&&!short)flags.push('capacity-unavailable');
  if(!qualification?.qualified)flags.push('research-only');
  return Object.freeze({
   venue:'gmx',
   model:'oracle-pool',
   dataStatus:state.ok?'live':'unavailable',
   freshnessMs:null,
   spreadBps:null,
   depth25Usd:null,
   minFillRatio:null,
   buyImpactBps:null,
   sellImpactBps:null,
   capacityLongUsd:finite(long?.availableLiquidityUsd)?Number(long.availableLiquidityUsd):null,
   capacityShortUsd:finite(short?.availableLiquidityUsd)?Number(short.availableLiquidityUsd):null,
   jitStatusLong:long?.jitDataStatus||null,
   jitStatusShort:short?.jitDataStatus||null,
   executionQualified:Boolean(qualification?.qualified),
   missingExecutionGates:qualification?.missing?.length??null,
   researchKnownRatio:research.knownRatio,
   flags:Object.freeze([...new Set(flags)])
  });
 }

 const health=bookRow?.health||{};
 const book=bookRow?.snapshot?.book||{};
 const flags=[];
 if(!bookRow?.ok)flags.push('collector-error');
 if(health.status==='degraded')flags.push(...(health.reasons||['degraded']));
 const fill=Math.min(bookRow?.buy?.fillRatio??0,bookRow?.sell?.fillRatio??0);
 if(bookRow?.ok&&fill<0.99)flags.push('partial-fill');
 if(!qualification?.qualified)flags.push('research-only');

 return Object.freeze({
  venue,
  model:'clob',
  dataStatus:bookRow?.ok?(health.status||'healthy'):'unavailable',
  freshnessMs:finite(book.staleMs)?Number(book.staleMs):null,
  spreadBps:finite(book.spreadBps)?Number(book.spreadBps):null,
  depth25Usd:finite(bookRow?.snapshot?.depth?.[25]?.total)?Number(bookRow.snapshot.depth[25].total):null,
  minFillRatio:finite(fill)?Number(fill):null,
  buyImpactBps:finite(bookRow?.buy?.marketImpactBps)?Number(bookRow.buy.marketImpactBps):null,
  sellImpactBps:finite(bookRow?.sell?.marketImpactBps)?Number(bookRow.sell.marketImpactBps):null,
  capacityLongUsd:null,
  capacityShortUsd:null,
  jitStatusLong:null,
  jitStatusShort:null,
  executionQualified:Boolean(qualification?.qualified),
  missingExecutionGates:qualification?.missing?.length??null,
  researchKnownRatio:research.knownRatio,
  flags:Object.freeze([...new Set(flags)])
 });
}

export function buildMarketIntelligence({bookRows=[],gmxState=null}={}){
 const rows=(bookRows||[]).map(row=>venueIntelligenceRow(row));
 if(gmxState)rows.push(venueIntelligenceRow(null,{gmxState}));

 const summary=Object.freeze({
  venues:rows.length,
  live:rows.filter(x=>x.dataStatus==='healthy'||x.dataStatus==='live').length,
  degraded:rows.filter(x=>x.dataStatus==='degraded').length,
  unavailable:rows.filter(x=>x.dataStatus==='unavailable').length,
  executionQualified:rows.filter(x=>x.executionQualified).length,
  researchOnly:rows.filter(x=>!x.executionQualified).length
 });
 return Object.freeze({rows:Object.freeze(rows),summary});
}
