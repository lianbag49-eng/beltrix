import test from 'node:test';
import assert from 'node:assert/strict';
import {batchToPostgresSql} from '../postgres-sql-export.js';

test('postgres export persists snapshots observations and deduplicated alerts',()=>{
 const sql=batchToPostgresSql({version:1,rows:[{
  ok:true,
  snapshot:{version:1,asset:'BTC',timestamp:1700000000000,venues:{
   hyperliquid:{ok:true,health:'healthy',latencyMs:12,spreadBps:.2,depth25Usd:1000,minFillRatio:1,metric:{fundingRate:.0001,openInterest:2,openInterestUsd:100,openInterestUnit:'base',volume24h:200,volume24hUsd:200,volume24hUnit:'USD-notional'}}
  }},
  alerts:[{venue:'orderly',key:'collector-unavailable',severity:'critical',message:"can't fetch",evidence:{code:503}}]
 }]});
 assert.match(sql,/insert into mi_snapshots/);
 assert.match(sql,/insert into mi_venue_observations/);
 assert.match(sql,/insert into mi_alert_events/);
 assert.match(sql,/on conflict \(asset,venue,alert_key\)/);
 assert.match(sql,/can''t fetch/);
 assert.match(sql,/commit;/);
});

test('postgres export rejects malformed scheduled payloads',()=>{
 assert.throws(()=>batchToPostgresSql({version:2,rows:[]}),/Invalid scheduled collector batch/);
});
