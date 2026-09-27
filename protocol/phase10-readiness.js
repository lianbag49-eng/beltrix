export const PHASE10_READINESS_CHECKS=Object.freeze([
 'isolated-margin-model-tested',
 'initial-margin-validation-tested',
 'maintenance-margin-liquidation-tested',
 'long-liquidation-price-tested',
 'short-liquidation-price-tested',
 'funding-cashflow-tested',
 'funding-rate-cap-tested',
 'insurance-draw-tested',
 'residual-deficit-tested',
 'stress-grid-tested',
 'cross-margin-model',
 'portfolio-netting-model',
 'partial-liquidation-model',
 'adl-policy-model',
 'bad-debt-policy-reviewed',
 'property-tests-expanded',
 'external-risk-review'
]);

export function assessPhase10Readiness(evidence={}){
 const checks=PHASE10_READINESS_CHECKS.map(id=>Object.freeze({id,passed:evidence[id]===true}));
 const missing=checks.filter(x=>!x.passed).map(x=>x.id);
 return Object.freeze({
  ready:missing.length===0,
  isolatedSimulationReady:checks.slice(0,10).every(x=>x.passed),
  checks:Object.freeze(checks),
  missing:Object.freeze(missing)
 });
}

export const CURRENT_PHASE10_READINESS=assessPhase10Readiness({
 'isolated-margin-model-tested':true,
 'initial-margin-validation-tested':true,
 'maintenance-margin-liquidation-tested':true,
 'long-liquidation-price-tested':true,
 'short-liquidation-price-tested':true,
 'funding-cashflow-tested':true,
 'funding-rate-cap-tested':true,
 'insurance-draw-tested':true,
 'residual-deficit-tested':true,
 'stress-grid-tested':true,
 'cross-margin-model':false,
 'portfolio-netting-model':false,
 'partial-liquidation-model':false,
 'adl-policy-model':false,
 'bad-debt-policy-reviewed':false,
 'property-tests-expanded':false,
 'external-risk-review':false
});
