import test from 'node:test';
import assert from 'node:assert/strict';
import {collectorOperationalState,buildOperationsSummary} from '../operations-health.js';

const now=Date.parse('2026-09-28T08:00:00Z');

test('collector health transitions through fresh delayed stale and down',()=>{
 const rowAt=min=>[{finished_at:new Date(now-min*60000).toISOString(),successful_assets:3,failed_assets:0}];
 assert.equal(collectorOperationalState(rowAt(10),{now}).status,'fresh');
 assert.equal(collectorOperationalState(rowAt(30),{now}).status,'delayed');
 assert.equal(collectorOperationalState(rowAt(40),{now}).status,'stale');
 assert.equal(collectorOperationalState(rowAt(50),{now}).status,'down');
});

test('collector fails closed after consecutive unsuccessful runs',()=>{
 const rows=[
  {finished_at:new Date(now-5*60000).toISOString(),successful_assets:0,failed_assets:3},
  {finished_at:new Date(now-20*60000).toISOString(),successful_assets:0,failed_assets:3},
  {finished_at:new Date(now-35*60000).toISOString(),successful_assets:3,failed_assets:0}
 ];
 const out=collectorOperationalState(rows,{now});
 assert.equal(out.status,'down');
 assert.equal(out.consecutiveFailedRuns,2);
});

test('operations summary includes degraded and down venue counts',()=>{
 const out=buildOperationsSummary({
  now,
  collectorRuns:[{finished_at:new Date(now-5*60000).toISOString(),successful_assets:3,failed_assets:0}],
  latestSnapshot:{venues:{
   hyperliquid:{ok:true,health:'healthy',latencyMs:100},
   orderly:{ok:true,health:'degraded',latencyMs:2000},
   paradex:{ok:false,health:'unavailable'}
  }},
  alerts:[]
 });
 assert.equal(out.counts.healthy,1);
 assert.equal(out.counts.degraded,1);
 assert.equal(out.counts.down,1);
 assert.equal(out.overall,'down');
});
