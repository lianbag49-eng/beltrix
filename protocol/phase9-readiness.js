export const PHASE9_READINESS_CHECKS=Object.freeze([
 'ownership-dry-run-engine-tested',
 'incident-recovery-runbook-defined',
 'oracle-rotation-plan-tested',
 'public-config-disclosure-tested',
 'public-config-fingerprint-tested',
 'hip3-testnet-dry-run-engine-tested',
 'production-multisig-bound',
 'production-timelock-bound',
 'production-guardian-bound',
 'independent-oracle-operators-bound',
 'ownership-recovery-rehearsed',
 'hip3-testnet-deploy-completed',
 'hip3-testnet-trading-completed',
 'public-config-published'
]);

export function assessPhase9Readiness(evidence={}){
 const checks=PHASE9_READINESS_CHECKS.map(id=>Object.freeze({id,passed:evidence[id]===true}));
 const missing=checks.filter(x=>!x.passed).map(x=>x.id);
 return Object.freeze({
  ready:missing.length===0,
  structuralReady:checks.slice(0,6).every(x=>x.passed),
  checks:Object.freeze(checks),
  missing:Object.freeze(missing)
 });
}

export const CURRENT_PHASE9_READINESS=assessPhase9Readiness({
 'ownership-dry-run-engine-tested':true,
 'incident-recovery-runbook-defined':true,
 'oracle-rotation-plan-tested':true,
 'public-config-disclosure-tested':true,
 'public-config-fingerprint-tested':true,
 'hip3-testnet-dry-run-engine-tested':true,
 'production-multisig-bound':false,
 'production-timelock-bound':false,
 'production-guardian-bound':false,
 'independent-oracle-operators-bound':false,
 'ownership-recovery-rehearsed':false,
 'hip3-testnet-deploy-completed':false,
 'hip3-testnet-trading-completed':false,
 'public-config-published':false
});
