import test from 'node:test';import assert from 'node:assert/strict';
import {defineOracleOperatorSet} from '../oracle-operators.js';
import {planOracleOperatorRotation} from '../oracle-rotation.js';

const A='0x1111111111111111111111111111111111111111';
const B='0x2222222222222222222222222222222222222222';
const C='0x3333333333333333333333333333333333333333';

test('oracle rotation preserves overlap before quorum switch',()=>{
 const current=defineOracleOperatorSet({operators:[{address:A},{address:B}],quorum:2});
 const plan=planOracleOperatorRotation({
  currentSet:current,
  nextOperators:[{address:B},{address:C}],
  nextQuorum:2,
  minOverlap:1
 });
 assert.equal(plan.safeToStage,true);
 assert.deepEqual(plan.overlap,[B.toLowerCase()]);
 assert.ok(plan.phases.every(x=>x.broadcast===false));
});

test('oracle rotation blocks discontinuous operator replacement',()=>{
 const current=defineOracleOperatorSet({operators:[{address:A},{address:B}],quorum:2});
 const plan=planOracleOperatorRotation({
  currentSet:current,
  nextOperators:[{address:C}],
  nextQuorum:1,
  minOverlap:1
 });
 assert.equal(plan.safeToStage,false);
 assert.ok(plan.reasons.includes('insufficient-operator-overlap'));
});
