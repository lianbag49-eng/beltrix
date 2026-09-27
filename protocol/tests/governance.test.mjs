import test from 'node:test';import assert from 'node:assert/strict';
import {governancePolicy,createConfigProposal,approveConfigProposal,proposalReady} from '../governance.js';

test('governance config requires quorum and timelock',()=>{
 const policy=governancePolicy({signers:['a','b','c'],quorum:2,timelockMs:1000});
 let p=createConfigProposal({id:'p1',baseRevision:1,change:{maxLeverage:20},proposer:'a',createdAt:1000});
 assert.equal(proposalReady(p,policy,3000),false);
 p=approveConfigProposal(p,'b',policy);
 assert.equal(proposalReady(p,policy,1500),false);
 assert.equal(proposalReady(p,policy,2000),true);
});

test('unauthorized governance signer cannot approve',()=>{
 const policy=governancePolicy({signers:['a'],quorum:1});
 const p=createConfigProposal({id:'p1',baseRevision:0,change:{x:1},proposer:'a',createdAt:0});
 assert.throws(()=>approveConfigProposal(p,'x',policy),/not in governance policy/);
});
