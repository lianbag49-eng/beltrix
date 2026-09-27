import test from 'node:test';import assert from 'node:assert/strict';
import {makeTelemetrySnapshot,appendTelemetry,saveTelemetry,loadTelemetry,telemetryForAsset,apiHealthSummary,DEFAULT_HISTORY_KEY} from '../telemetry-history.js';

const memoryStorage=()=>{
 const map=new Map();
 return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
};

test('telemetry snapshot joins book health and market metrics by venue',()=>{
 const snap=makeTelemetrySnapshot({
  asset:'BTC',timestamp:1000,
  bookRows:[{
   venue:'hyperliquid',ok:true,latencyMs:15,health:{status:'healthy'},
   snapshot:{book:{spreadBps:1.2},depth:{25:{total:100000}}},
   buy:{fillRatio:1},sell:{fillRatio:0.99}
  }],
  metricRows:[{venue:'hyperliquid',fundingRate:0.0001,openInterestUsd:2000000}]
 });
 assert.equal(snap.venues.hyperliquid.health,'healthy');
 assert.equal(snap.venues.hyperliquid.latencyMs,15);
 assert.equal(snap.venues.hyperliquid.metric.fundingRate,0.0001);
});

test('history enforces age and count retention',()=>{
 const old={asset:'BTC',timestamp:100,venues:{}};
 const a={asset:'BTC',timestamp:900,venues:{}};
 const b={asset:'BTC',timestamp:1000,venues:{}};
 const next=appendTelemetry([old,a],b,{maxEntries:2,maxAgeMs:500,now:1100});
 assert.deepEqual(next.map(x=>x.timestamp),[900,1000]);
});

test('storage roundtrip and health summary report success and latency',()=>{
 const storage=memoryStorage();
 let history=saveTelemetry(storage,{asset:'BTC',timestamp:1000,venues:{hyperliquid:{ok:true,health:'healthy',latencyMs:10}}},{now:1000,maxAgeMs:10000});
 history=saveTelemetry(storage,{asset:'BTC',timestamp:2000,venues:{hyperliquid:{ok:false,health:'unavailable',latencyMs:30}}},{now:2000,maxAgeMs:10000});
 assert.equal(loadTelemetry(storage).length,2);
 assert.equal(telemetryForAsset(history,'BTC').length,2);
 const s=apiHealthSummary(history,'BTC').hyperliquid;
 assert.equal(s.samples,2);
 assert.equal(s.successRatio,0.5);
 assert.equal(s.avgLatencyMs,20);
 assert.equal(s.p95LatencyMs,30);
 assert.equal(DEFAULT_HISTORY_KEY,'beltrix.dex-intelligence.telemetry.v1');
});
