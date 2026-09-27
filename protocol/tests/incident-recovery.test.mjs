import test from 'node:test';import assert from 'node:assert/strict';
import {INCIDENT_TYPES,incidentResponsePlan,canResumeIncident} from '../incident-recovery.js';

test('oracle quorum loss fails closed and never auto resumes',()=>{
 const plan=incidentResponsePlan(INCIDENT_TYPES.ORACLE_QUORUM_LOSS,{market:'btc-perp',detectedAt:100});
 assert.equal(plan.severity,'critical');
 assert.equal(plan.market,'BTC-PERP');
 assert.equal(plan.automaticResume,false);
 assert.ok(plan.immediate.includes('fail-close-new-risk'));
 const state=canResumeIncident(plan,{
  'oracle-quorum-restored':true,
  'freshness-window-satisfied':true,
  'operator-signatures-verified':true,
  'human-guardian-approval':false
 });
 assert.equal(state.ready,false);
 assert.ok(state.missing.includes('human-guardian-approval'));
});

test('governance compromise requires signer and timelock recovery',()=>{
 const plan=incidentResponsePlan(INCIDENT_TYPES.GOVERNANCE_COMPROMISE);
 assert.ok(plan.recovery.includes('rotate-compromised-signers'));
 assert.ok(plan.resumeConditions.includes('timelock-verified'));
});

test('unknown incident type is rejected',()=>{
 assert.throws(()=>incidentResponsePlan('unknown'),/Unknown BELTRIX incident type/);
});
