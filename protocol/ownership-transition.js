import {governancePolicy} from './governance.js';

const address=value=>{
 const s=String(value||'').trim().toLowerCase();
 if(!/^0x[0-9a-f]{40}$/.test(s))throw Error('Ownership address must be a 20-byte EVM address');
 return s;
};

export function buildOwnershipTransition({
 currentOwner,
 multisig,
 signers,
 quorum,
 timelockMs,
 guardian,
 roleGrants=[]
}={}){
 const owner=address(currentOwner);
 const safe=address(multisig);
 const guard=address(guardian);
 const policy=governancePolicy({signers:(signers||[]).map(address),quorum,timelockMs});
 if(owner===safe)throw Error('Current owner and multisig must differ');
 const roles=(roleGrants||[]).map(row=>Object.freeze({
  role:String(row.role||'').trim(),
  account:address(row.account)
 }));
 return Object.freeze({
  protocol:'beltrix',
  mode:'ownership-transition',
  researchOnly:true,
  executionEnabled:false,
  currentOwner:owner,
  targetOwner:safe,
  guardian:guard,
  policy,
  roleGrants:Object.freeze(roles),
  steps:Object.freeze([
   Object.freeze({id:'deploy-multisig',requiresHumanReview:true,description:'Deploy or verify the target multisig and signer quorum.'}),
   Object.freeze({id:'configure-timelock',requiresHumanReview:true,description:'Configure the reviewed timelock before protocol ownership changes.'}),
   Object.freeze({id:'assign-scoped-roles',requiresHumanReview:true,description:'Assign oracle, risk, emergency and fee roles with least privilege.'}),
   Object.freeze({id:'transfer-owner',requiresHumanReview:true,description:'Transfer protocol control from the developer owner to the multisig/timelock path.'}),
   Object.freeze({id:'revoke-developer-control',requiresHumanReview:true,description:'Revoke obsolete direct developer permissions after verification.'}),
   Object.freeze({id:'publish-config',requiresHumanReview:true,description:'Publish signer, quorum, timelock and role state for public verification.'})
  ]),
  warnings:Object.freeze([
   'This plan does not deploy or transfer onchain ownership.',
   'Every target contract/action must be verified against the actual chain deployment before signing.',
   'Emergency powers must be documented and time-bounded where possible.'
  ])
 });
}
