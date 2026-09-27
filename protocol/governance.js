function cleanSigner(value){
 const s=String(value||'').trim().toLowerCase();
 if(!s)throw Error('Governance signer is required');
 return s;
}
export function governancePolicy({signers=[],quorum=1,timelockMs=0}={}){
 const list=[...new Set(signers.map(cleanSigner))];
 if(!list.length)throw Error('Governance requires at least one signer');
 const q=Number(quorum);
 if(!Number.isInteger(q)||q<1||q>list.length)throw Error('Invalid governance quorum');
 const delay=Number(timelockMs);
 if(!Number.isFinite(delay)||delay<0)throw Error('Invalid timelock');
 return Object.freeze({signers:Object.freeze(list),quorum:q,timelockMs:delay});
}

export function createConfigProposal({id,baseRevision,change,proposer,createdAt=Date.now()}={}){
 const pid=String(id||'').trim(),who=cleanSigner(proposer);
 if(!pid)throw Error('Proposal id is required');
 if(!Number.isInteger(Number(baseRevision))||Number(baseRevision)<0)throw Error('Invalid base revision');
 if(!change||typeof change!=='object')throw Error('Proposal change is required');
 return Object.freeze({
  id:pid,
  baseRevision:Number(baseRevision),
  change:Object.freeze({...change}),
  proposer:who,
  createdAt:Number(createdAt),
  approvals:Object.freeze([who])
 });
}

export function approveConfigProposal(proposal,signer,policy){
 const who=cleanSigner(signer);
 if(!policy.signers.includes(who))throw Error('Signer is not in governance policy');
 const approvals=[...new Set([...(proposal.approvals||[]),who])];
 return Object.freeze({...proposal,approvals:Object.freeze(approvals)});
}

export function proposalReady(proposal,policy,now=Date.now()){
 const approvals=(proposal.approvals||[]).filter(x=>policy.signers.includes(x));
 return approvals.length>=policy.quorum&&Number(now)>=Number(proposal.createdAt)+policy.timelockMs;
}
