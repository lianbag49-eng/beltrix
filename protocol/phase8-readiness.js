export const PHASE8_READINESS_CHECKS=Object.freeze([
 'oracle-operator-set-defined',
 'oracle-signature-verification-tested',
 'oracle-quorum-failure-tested',
 'oracle-deviation-failure-tested',
 'multisig-address-reviewed',
 'multisig-signer-set-reviewed',
 'timelock-duration-reviewed',
 'emergency-guardian-reviewed',
 'least-privilege-role-map-reviewed',
 'ownership-transition-dry-run',
 'ownership-recovery-runbook',
 'public-config-disclosure-ready'
]);

export function assessPhase8Readiness(evidence={}){
 const checks=PHASE8_READINESS_CHECKS.map(id=>Object.freeze({id,passed:evidence[id]===true}));
 const missing=checks.filter(x=>!x.passed).map(x=>x.id);
 return Object.freeze({ready:missing.length===0,checks:Object.freeze(checks),missing:Object.freeze(missing)});
}

export const CURRENT_PHASE8_READINESS=assessPhase8Readiness({
 'oracle-operator-set-defined':true,
 'oracle-signature-verification-tested':true,
 'oracle-quorum-failure-tested':true,
 'oracle-deviation-failure-tested':true,
 'multisig-address-reviewed':false,
 'multisig-signer-set-reviewed':false,
 'timelock-duration-reviewed':false,
 'emergency-guardian-reviewed':false,
 'least-privilege-role-map-reviewed':false,
 'ownership-transition-dry-run':false,
 'ownership-recovery-runbook':false,
 'public-config-disclosure-ready':false
});
