import test from 'node:test';
import assert from 'node:assert/strict';
import {VENUES,byId} from '../venues.js';
import {executionGate,venueExecutionState} from '../execution-gates.js';

test('market intelligence venue ids are unique and source-backed',()=>{
 const ids=VENUES.map(v=>v.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const v of VENUES){
  assert.ok(v.name);
  assert.ok(Array.isArray(v.sources)&&v.sources.length>=2);
  assert.equal(typeof v.integration.publicApi,'boolean');
  assert.equal(typeof v.integration.orderRouting,'boolean');
 }
});

test('Hyperliquid remains the public core while competitors remain gated',()=>{
 assert.equal(byId('hyperliquid').bd.status,'active-core');
 for(const id of ['orderly','gmx','dydx','paradex','aster','drift','aevo']){
  assert.equal(venueExecutionState(id).eligible,false);
  assert.ok(venueExecutionState(id).missing.length>0);
 }
});

test('execution gate requires every safety and product prerequisite',()=>{
 assert.equal(executionGate({}).eligible,false);
 const all={telemetry:true,api:true,testnet:true,reconcile:true,fees:true,risk:true,legal:true,security:true,e2e:true};
 assert.deepEqual(executionGate(all),{eligible:true,missing:[]});
});
