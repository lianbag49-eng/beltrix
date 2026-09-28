import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateVenueQuality,evaluateSnapshotQuality} from '../data-quality.js';

test('valid venue telemetry remains trusted',()=>{
 const q=evaluateVenueQuality({ok:true,latencyMs:120,spreadBps:2.5,depth25Usd:500000,minFillRatio:1,flags:[]});
 assert.equal(q.status,'valid');
 assert.equal(q.score,100);
});

test('invalid ranges fail quality closed',()=>{
 const q=evaluateVenueQuality({ok:true,latencyMs:-1,spreadBps:-2,minFillRatio:1.2,depth25Usd:-5});
 assert.equal(q.status,'untrusted');
 assert.ok(q.critical>=4);
});

test('large depth and spread jumps are flagged as warnings',()=>{
 const q=evaluateVenueQuality(
  {ok:true,spreadBps:30,depth25Usd:100000,minFillRatio:1},
  {spreadBps:1,depth25Usd:2000000}
 );
 assert.equal(q.status,'degraded');
 assert.ok(q.issues.some(x=>x.code==='depth-outlier'));
 assert.ok(q.issues.some(x=>x.code==='spread-outlier'));
});

test('stale snapshots degrade aggregate quality',()=>{
 const now=Date.parse('2026-09-28T08:00:00Z');
 const out=evaluateSnapshotQuality({
  asset:'BTC',timestamp:now-40*60000,
  venues:{hyperliquid:{ok:true,latencyMs:100,spreadBps:1,depth25Usd:1000,minFillRatio:1}}
 },null,{now});
 assert.equal(out.status,'degraded');
 assert.equal(out.asset,'BTC');
 assert.ok(out.snapshotIssues.some(x=>x.code==='snapshot-stale'));
});
