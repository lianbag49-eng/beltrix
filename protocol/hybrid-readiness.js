export const HYBRID_READINESS_CHECKS=Object.freeze([
 'protocol-core-tested',
 'market-config-reviewed',
 'oracle-operator-ready',
 'independent-oracle-sources-live',
 'governance-multisig-ready',
 'timelock-policy-ready',
 'incident-recovery-runbook',
 'monitoring-and-alerts-live',
 'testnet-deploy-e2e',
 'testnet-trading-e2e',
 'liquidation-behavior-reviewed',
 'fee-accounting-reconciled'
]);

export function assessHybridReadiness(evidence={}){
 const checks=HYBRID_READINESS_CHECKS.map(id=>Object.freeze({id,passed:evidence[id]===true}));
 const missing=checks.filter(x=>!x.passed).map(x=>x.id);
 return Object.freeze({
  ready:missing.length===0,
  checks:Object.freeze(checks),
  missing:Object.freeze(missing)
 });
}

export const CURRENT_HYBRID_READINESS=assessHybridReadiness({
 'protocol-core-tested':true,
 'market-config-reviewed':false,
 'oracle-operator-ready':false,
 'independent-oracle-sources-live':false,
 'governance-multisig-ready':false,
 'timelock-policy-ready':false,
 'incident-recovery-runbook':false,
 'monitoring-and-alerts-live':true,
 'testnet-deploy-e2e':false,
 'testnet-trading-e2e':false,
 'liquidation-behavior-reviewed':false,
 'fee-accounting-reconciled':false
});
