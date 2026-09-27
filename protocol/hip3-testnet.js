export const HIP3_TESTNET_CHECKS=Object.freeze([
 'plan-is-unsigned',
 'plan-is-research-only',
 'operator-addresses-reviewed',
 'market-config-reviewed',
 'oracle-policy-reviewed',
 'risk-policy-reviewed',
 'test-wallet-separated-from-mainnet',
 'testnet-balance-confirmed',
 'deployer-action-schema-reviewed',
 'post-deploy-state-verification-defined',
 'rollback-or-halt-procedure-defined'
]);

export function buildHip3TestnetDryRun(plan,{network='testnet',evidence={}}={}){
 if(!plan||plan.mode!=='hip3-hybrid')throw Error('BELTRIX HIP-3 hybrid plan is required');
 if(network!=='testnet')throw Error('Phase 9 dry-run only supports testnet');
 const checks=HIP3_TESTNET_CHECKS.map(id=>Object.freeze({
  id,
  passed:id==='plan-is-unsigned'
   ?plan.operations?.every(x=>x.unsigned===true)
   :id==='plan-is-research-only'
    ?plan.researchOnly===true&&plan.executionEnabled===false
    :evidence[id]===true
 }));
 const missing=checks.filter(x=>!x.passed).map(x=>x.id);
 return Object.freeze({
  protocol:'beltrix',
  network,
  dryRun:true,
  broadcastEnabled:false,
  readyForManualTestnetReview:missing.length===0,
  checks:Object.freeze(checks),
  missing:Object.freeze(missing),
  operationPreview:Object.freeze((plan.operations||[]).map((op,index)=>Object.freeze({
   sequence:index+1,
   variant:op.variant,
   purpose:op.purpose,
   broadcast:false,
   requiresDeployerSignature:true,
   requiresHumanReview:true
  }))),
  warnings:Object.freeze([
   'No deployer payload is signed or submitted by this dry-run.',
   'Mainnet credentials, stake, capital and production oracle keys must not be used.'
  ])
 });
}
