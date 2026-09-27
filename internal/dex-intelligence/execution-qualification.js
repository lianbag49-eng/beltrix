const CHECKS=Object.freeze([
 'publicMarketData',
 'canonicalSymbolMapping',
 'normalizedLiquidityModel',
 'feeModel',
 'executionCostModel',
 'signingModel',
 'orderLifecycle',
 'positionReconciliation',
 'rateLimits',
 'regionalPolicy',
 'failureRecovery',
 'paperOrTestnetE2E'
]);

export function qualifyExecutionVenue(input={}){
 const evidence=input.evidence&&typeof input.evidence==='object'?input.evidence:{};
 const checks=CHECKS.map(id=>Object.freeze({
  id,
  passed:evidence[id]===true,
  note:typeof evidence[id]==='string'?evidence[id]:null
 }));
 const missing=checks.filter(x=>!x.passed).map(x=>x.id);
 return Object.freeze({
  venue:String(input.venue||''),
  qualified:missing.length===0,
  mode:missing.length===0?'execution':'research-only',
  checks,
  missing,
  reviewedAt:input.reviewedAt||null
 });
}

export function executionChecklist(){return [...CHECKS]}

const pass=(...ids)=>Object.fromEntries(CHECKS.map(id=>[id,ids.includes(id)]));

export const INITIAL_QUALIFICATION=Object.freeze({
 hyperliquid:qualifyExecutionVenue({
  venue:'hyperliquid',
  reviewedAt:'2026-09-27',
  evidence:Object.fromEntries(CHECKS.map(x=>[x,true]))
 }),
 orderly:qualifyExecutionVenue({
  venue:'orderly',
  reviewedAt:'2026-09-27',
  evidence:pass('publicMarketData','canonicalSymbolMapping','normalizedLiquidityModel','feeModel','executionCostModel')
 }),
 gmx:qualifyExecutionVenue({
  venue:'gmx',
  reviewedAt:'2026-09-27',
  evidence:pass('publicMarketData','canonicalSymbolMapping','feeModel')
 }),
 paradex:qualifyExecutionVenue({
  venue:'paradex',
  reviewedAt:'2026-09-27',
  evidence:pass('publicMarketData','canonicalSymbolMapping','normalizedLiquidityModel','feeModel','executionCostModel')
 }),
 dydx:qualifyExecutionVenue({
  venue:'dydx',
  reviewedAt:'2026-09-27',
  evidence:pass('publicMarketData','canonicalSymbolMapping','normalizedLiquidityModel','executionCostModel')
 }),
 drift:qualifyExecutionVenue({
  venue:'drift',
  reviewedAt:'2026-09-27',
  evidence:pass('canonicalSymbolMapping')
 })
});

export function executableVenues(){
 return Object.values(INITIAL_QUALIFICATION).filter(x=>x.qualified).map(x=>x.venue);
}
