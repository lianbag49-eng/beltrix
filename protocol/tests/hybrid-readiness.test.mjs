import test from 'node:test';import assert from 'node:assert/strict';
import {assessHybridReadiness,CURRENT_HYBRID_READINESS,HYBRID_READINESS_CHECKS} from '../hybrid-readiness.js';

test('current HIP-3 hybrid state is not launch-ready',()=>{
 assert.equal(CURRENT_HYBRID_READINESS.ready,false);
 assert.ok(CURRENT_HYBRID_READINESS.missing.includes('testnet-deploy-e2e'));
 assert.ok(CURRENT_HYBRID_READINESS.missing.includes('governance-multisig-ready'));
 assert.ok(!CURRENT_HYBRID_READINESS.missing.includes('protocol-core-tested'));
});

test('hybrid readiness only becomes true when every gate has evidence',()=>{
 const all=Object.fromEntries(HYBRID_READINESS_CHECKS.map(x=>[x,true]));
 const out=assessHybridReadiness(all);
 assert.equal(out.ready,true);
 assert.deepEqual(out.missing,[]);
});
