import test from 'node:test';import assert from 'node:assert/strict';
import {buildOwnershipTransition} from '../ownership-transition.js';
import {dryRunOwnershipTransition} from '../ownership-dry-run.js';

const OWNER='0x1111111111111111111111111111111111111111';
const SAFE='0x2222222222222222222222222222222222222222';
const GUARD='0x3333333333333333333333333333333333333333';
const S1='0x4444444444444444444444444444444444444444';
const S2='0x5555555555555555555555555555555555555555';

test('ownership dry-run validates separation quorum timelock and roles',()=>{
 const plan=buildOwnershipTransition({
  currentOwner:OWNER,multisig:SAFE,guardian:GUARD,
  signers:[S1,S2],quorum:2,timelockMs:3600000,
  roleGrants:[{role:'oracle-updater',account:S1}]
 });
 const out=dryRunOwnershipTransition(plan,{currentOwner:OWNER});
 assert.equal(out.passed,true);
 assert.ok(out.checks.every(x=>x.passed));
 assert.ok(out.simulatedSteps.every(x=>x.broadcast===false));
});

test('ownership dry-run blocks owner mismatch',()=>{
 const plan=buildOwnershipTransition({
  currentOwner:OWNER,multisig:SAFE,guardian:GUARD,
  signers:[S1,S2],quorum:2,timelockMs:3600000
 });
 assert.throws(()=>dryRunOwnershipTransition(plan,{currentOwner:SAFE}),/does not match/);
});

test('ownership dry-run blocks zero timelock and role mistakes',()=>{
 const plan=buildOwnershipTransition({
  currentOwner:OWNER,multisig:SAFE,guardian:GUARD,
  signers:[S1,S2],quorum:2,timelockMs:0,
  roleGrants:[{role:'unknown-role',account:S1}]
 });
 const out=dryRunOwnershipTransition(plan,{currentOwner:OWNER});
 assert.equal(out.passed,false);
 assert.ok(out.checks.some(x=>x.id==='timelock-configured'&&!x.passed));
 assert.ok(out.checks.some(x=>x.id==='known-role:unknown-role'&&!x.passed));
});
