import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateVenueAlerts,evaluateMarketAlerts,dedupeAlerts} from '../alert-engine.js';

test('collector outage creates one critical alert',()=>{
 const rows=evaluateVenueAlerts({venue:'orderly',dataStatus:'unavailable'});
 assert.equal(rows.length,1);
 assert.equal(rows[0].key,'collector-unavailable');
 assert.equal(rows[0].severity,'critical');
});

test('latency success fill and depth rules stay descriptive',()=>{
 const rows=evaluateVenueAlerts(
  {venue:'paradex',dataStatus:'healthy',freshnessMs:100,minFillRatio:0.95,depth25Usd:400,flags:[]},
  {
   healthHistory:{avgLatencyMs:2000,successRatio:0.9},
   previous:{depth25Usd:1000}
  }
 );
 const keys=rows.map(x=>x.key);
 assert.ok(keys.includes('api-latency'));
 assert.ok(keys.includes('api-success'));
 assert.ok(keys.includes('fill-ratio'));
 assert.ok(keys.includes('depth-drop'));
 assert.ok(rows.every(x=>x.severity==='warning'));
});

test('dedupe keeps the highest-severity venue alert',()=>{
 const out=dedupeAlerts([
  {venue:'x',key:'api',severity:'warning',message:'a',evidence:{}},
  {venue:'x',key:'api',severity:'critical',message:'b',evidence:{}}
 ]);
 assert.equal(out.length,1);
 assert.equal(out[0].severity,'critical');
});

test('market alert evaluation does not rank venues',()=>{
 const out=evaluateMarketAlerts([
  {venue:'a',dataStatus:'healthy',minFillRatio:1,flags:[]},
  {venue:'b',dataStatus:'healthy',minFillRatio:1,flags:[]}
 ]);
 assert.deepEqual(out,[]);
});
