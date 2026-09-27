import test from 'node:test';import assert from 'node:assert/strict';
import {CURRENT_PHASE8_READINESS,PHASE8_READINESS_CHECKS,assessPhase8Readiness} from '../phase8-readiness.js';

test('Phase 8 current state remains blocked on real governance deployment evidence',()=>{
 assert.equal(CURRENT_PHASE8_READINESS.ready,false);
 assert.ok(CURRENT_PHASE8_READINESS.missing.includes('multisig-address-reviewed'));
 assert.ok(CURRENT_PHASE8_READINESS.missing.includes('ownership-transition-dry-run'));
 assert.ok(!CURRENT_PHASE8_READINESS.missing.includes('oracle-signature-verification-tested'));
});

test('Phase 8 only becomes ready with every explicit gate',()=>{
 const evidence=Object.fromEntries(PHASE8_READINESS_CHECKS.map(x=>[x,true]));
 const out=assessPhase8Readiness(evidence);
 assert.equal(out.ready,true);
 assert.deepEqual(out.missing,[]);
});
