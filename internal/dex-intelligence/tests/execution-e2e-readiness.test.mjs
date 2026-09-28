import test from 'node:test';
import assert from 'node:assert/strict';
import {executionE2eProfile,evaluateE2eEvidence} from '../execution-e2e-readiness.js';

test('Orderly and Paradex remain testnet-only and unqualified',()=>{
 for(const venue of ['orderly','paradex']){
  const p=executionE2eProfile(venue);
  assert.equal(p.mode,'testnet-only');
  assert.equal(p.currentlyQualified,false);
  assert.equal(p.promotable,false);
  assert.ok(p.missingGates.includes('paperOrTestnetE2E'));
 }
});

test('complete lifecycle evidence only clears the E2E evidence condition',()=>{
 const p=executionE2eProfile('orderly');
 const evidence=Object.fromEntries(p.sequence.map(x=>[x,true]));
 const out=evaluateE2eEvidence('orderly',evidence);
 assert.equal(out.complete,true);
 assert.equal(out.mayMarkPaperOrTestnetE2E,true);
 assert.equal(out.mayPromoteToExecution,false);
});

test('partial E2E evidence fails closed',()=>{
 const out=evaluateE2eEvidence('paradex',{'evm-siwe-authenticate':true});
 assert.equal(out.complete,false);
 assert.equal(out.mayMarkPaperOrTestnetE2E,false);
});
