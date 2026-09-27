import test from 'node:test';import assert from 'node:assert/strict';
import {CURRENT_PHASE10_READINESS,PHASE10_READINESS_CHECKS,assessPhase10Readiness} from '../phase10-readiness.js';

test('isolated native-risk simulation is ready but native protocol risk is not',()=>{
 assert.equal(CURRENT_PHASE10_READINESS.isolatedSimulationReady,true);
 assert.equal(CURRENT_PHASE10_READINESS.ready,false);
 assert.ok(CURRENT_PHASE10_READINESS.missing.includes('cross-margin-model'));
 assert.ok(CURRENT_PHASE10_READINESS.missing.includes('external-risk-review'));
});

test('full readiness requires every risk research gate',()=>{
 const evidence=Object.fromEntries(PHASE10_READINESS_CHECKS.map(x=>[x,true]));
 const out=assessPhase10Readiness(evidence);
 assert.equal(out.ready,true);
 assert.deepEqual(out.missing,[]);
});
