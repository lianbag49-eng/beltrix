import {BELTRIX_PROTOCOL_ROLES} from './roles.js';

const ZERO='0x0000000000000000000000000000000000000000';

function address(value,name){
 const s=String(value||'').trim().toLowerCase();
 if(!/^0x[0-9a-f]{40}$/.test(s)||s===ZERO)throw Error(name+' must be a non-zero 20-byte EVM address');
 return s;
}

export function dryRunOwnershipTransition(plan,currentState={}){
 if(!plan||plan.mode!=='ownership-transition')throw Error('Ownership transition plan is required');
 const currentOwner=address(currentState.currentOwner,'Current state owner');
 if(currentOwner!==address(plan.currentOwner,'Plan current owner'))throw Error('Ownership plan current owner does not match current state');

 const target=address(plan.targetOwner,'Target owner');
 const guardian=address(plan.guardian,'Guardian');
 const signers=(plan.policy?.signers||[]).map(x=>address(x,'Governance signer'));
 const quorum=Number(plan.policy?.quorum);
 const timelockMs=Number(plan.policy?.timelockMs);

 const checks=[];
 const check=(id,passed,detail)=>checks.push(Object.freeze({id,passed:Boolean(passed),detail:String(detail||'')}));

 check('target-owner-differs',target!==currentOwner,'Target multisig differs from current owner');
 check('signer-set-nonempty',signers.length>0,'Governance signer set exists');
 check('signers-unique',new Set(signers).size===signers.length,'Governance signers are unique');
 check('quorum-valid',Number.isInteger(quorum)&&quorum>=1&&quorum<=signers.length,'Governance quorum fits signer set');
 check('timelock-configured',Number.isFinite(timelockMs)&&timelockMs>0,'Non-zero timelock is configured');
 check('guardian-separated',guardian!==currentOwner&&guardian!==target,'Emergency guardian is separated from owner paths');

 const roleMap=[];
 for(const grant of plan.roleGrants||[]){
  const role=String(grant.role||'');
  const account=address(grant.account,'Role account');
  check('known-role:'+role,Boolean(BELTRIX_PROTOCOL_ROLES[role]),'Role '+role+' is recognized');
  roleMap.push(Object.freeze({role,account}));
 }

 const passed=checks.every(x=>x.passed);
 return Object.freeze({
  passed,
  mode:'dry-run',
  currentOwner,
  targetOwner:target,
  guardian,
  policy:Object.freeze({signers:Object.freeze(signers),quorum,timelockMs}),
  roleMap:Object.freeze(roleMap),
  checks:Object.freeze(checks),
  simulatedSteps:Object.freeze((plan.steps||[]).map((step,index)=>Object.freeze({
   sequence:index+1,
   id:step.id,
   status:passed?'ready-for-manual-review':'blocked',
   broadcast:false,
   requiresHumanReview:true
  }))),
  warnings:Object.freeze([
   'Dry-run only. No ownership transaction was created or signed.',
   'Target multisig/timelock deployment must be independently verified before transfer.'
  ])
 });
}
