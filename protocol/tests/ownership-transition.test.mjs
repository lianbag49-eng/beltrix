import test from 'node:test';import assert from 'node:assert/strict';
import {buildOwnershipTransition} from '../ownership-transition.js';

const A='0x1111111111111111111111111111111111111111';
const B='0x2222222222222222222222222222222222222222';
const C='0x3333333333333333333333333333333333333333';
const D='0x4444444444444444444444444444444444444444';
const E='0x5555555555555555555555555555555555555555';

test('ownership transition is explicitly unsigned and review-gated',()=>{
 const plan=buildOwnershipTransition({
  currentOwner:A,multisig:B,signers:[B,C,D],quorum:2,timelockMs:86400000,guardian:E,
  roleGrants:[{role:'oracle-updater',account:C},{role:'emergency-guardian',account:E}]
 });
 assert.equal(plan.researchOnly,true);
 assert.equal(plan.executionEnabled,false);
 assert.equal(plan.policy.quorum,2);
 assert.equal(plan.policy.timelockMs,86400000);
 assert.ok(plan.steps.every(x=>x.requiresHumanReview));
 assert.equal(plan.steps.at(-1).id,'publish-config');
});

test('ownership transition rejects same owner and multisig',()=>{
 assert.throws(()=>buildOwnershipTransition({
  currentOwner:A,multisig:A,signers:[B],quorum:1,timelockMs:0,guardian:E
 }),/must differ/);
});
