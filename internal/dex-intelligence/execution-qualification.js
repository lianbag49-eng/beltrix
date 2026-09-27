const CHECKS=Object.freeze([
 'publicMarketData',
 'normalizedBook',
 'feeModel',
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
 const checks=CHECKS.map(id=>Object.freeze({id,passed:evidence[id]===true}));
 const missing=checks.filter(x=>!x.passed).map(x=>x.id);
 return Object.freeze({
  venue:String(input.venue||''),
  qualified:missing.length===0,
  checks,
  missing,
  reviewedAt:input.reviewedAt||null
 });
}

export function executionChecklist(){return [...CHECKS]}

export const INITIAL_QUALIFICATION=Object.freeze({
 hyperliquid:qualifyExecutionVenue({
  venue:'hyperliquid',
  reviewedAt:'2026-09-27',
  evidence:Object.fromEntries(CHECKS.map(x=>[x,true]))
 }),
 orderly:qualifyExecutionVenue({venue:'orderly',reviewedAt:'2026-09-27',evidence:{publicMarketData:true,feeModel:true}}),
 gmx:qualifyExecutionVenue({venue:'gmx',reviewedAt:'2026-09-27',evidence:{publicMarketData:true,feeModel:true}}),
 paradex:qualifyExecutionVenue({venue:'paradex',reviewedAt:'2026-09-27',evidence:{publicMarketData:true,normalizedBook:true,feeModel:true}}),
 dydx:qualifyExecutionVenue({venue:'dydx',reviewedAt:'2026-09-27',evidence:{publicMarketData:true,normalizedBook:true}}),
 drift:qualifyExecutionVenue({venue:'drift',reviewedAt:'2026-09-27',evidence:{}})
});
