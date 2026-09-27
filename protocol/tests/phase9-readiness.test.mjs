import test from 'node:test';import assert from 'node:assert/strict';
import {CURRENT_PHASE9_READINESS,PHASE9_READINESS_CHECKS,assessPhase9Readiness} from '../phase9-readiness.js';

test('phase 9 structural code is ready but production binding is not',()=>{
 assert.equal(CURRENT_PHASE9_READINESS.structuralReady,true);
 assert.equal(CURRENT_PHASE9_READINESS.ready,false);
 assert.ok(CURRENT_PHASE9_READINESS.missing.includes('production-multisig-bound'));
 assert.ok(CURRENT_PHASE9_READINESS.missing.includes('hip3-testnet-deploy-completed'));
});

test('phase 9 only becomes fully ready with every operational proof',()=>{
 const evidence=Object.fromEntries(PHASE9_READINESS_CHECKS.map(x=>[x,true]));
 const out=assessPhase9Readiness(evidence);
 assert.equal(out.structuralReady,true);
 assert.equal(out.ready,true);
 assert.deepEqual(out.missing,[]);
});
