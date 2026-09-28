import test from 'node:test';
import assert from 'node:assert/strict';
import {batchToPostgresSql} from '../postgres-sql-export.js';

test('postgres export persists snapshots observations and deduplicated alerts',()=>{
 const sql=batchToPostgresSql({version:1,rows:[{
  ok:true,
  snapshot:{version:1,asset:'BTC',timestamp:1700000000000,venues:{
   hyperliquid:{ok:true,health:'healthy',latencyMs:12,spreadBps:.2,depth25Usd:1000,minFillRatio:1,metric:{fundingRate:.0001,openInterest:2,openInterestUsd:100,openInterestUnit:'base',volume24h:200,volume24hUsd:200,volume24hUnit:'USD-notional'}}
  }},
  alerts:[{venue:'orderly',key:'collector-unavailable',severity:'critical',message:"can't fetch",evidence:{code:503}}],
  bdEvents:[{venue:'orderly',eventType:'market-intelligence-alert',source:'market-intelligence',priority:'high',title:'Critical · orderly',detail:'Collector unavailable',asset:'BTC',timestamp:1700000000000,evidence:{severity:'critical'}}]
 }],startedAt:1699999990000,finishedAt:1700000000000,successful:1,failed:0});
 assert.match(sql,/insert into mi_collector_runs/);
 assert.match(sql,/insert into mi_snapshots/);
 assert.match(sql,/insert into mi_venue_observations/);
 assert.match(sql,/update mi_alert_events set status='resolved'/);
 assert.match(sql,/insert into mi_alert_events/);
 assert.match(sql,/on conflict \(asset,venue,alert_key\)/);
 assert.match(sql,/can''t fetch/);
 assert.match(sql,/insert into mi_bd_events/);
 assert.match(sql,/on conflict \(event_key\).*do nothing/);
 assert.match(sql,/delete from mi_snapshots where captured_at < E'/);
 assert.match(sql,/delete from mi_collector_runs where finished_at < E'/);
 assert.match(sql,/delete from mi_bd_events where created_at < E'/);
 assert.match(sql,/commit;/);
});

test('postgres export rejects malformed scheduled payloads',()=>{
 assert.throws(()=>batchToPostgresSql({version:2,rows:[]}),/Invalid scheduled collector batch/);
});


test('postgres export resolves all prior alerts when the current asset has no alerts',()=>{
 const sql=batchToPostgresSql({
  version:1,startedAt:1,finishedAt:2,successful:1,failed:0,
  rows:[{ok:true,snapshot:{version:1,asset:'ETH',timestamp:1700000000000,venues:{}},alerts:[],intelligence:{rows:[]}}]
 });
 assert.match(sql,/where asset=E'ETH' and status in \('open','acknowledged'\);/);
});


test('postgres export uses policy-specific retention windows instead of one hard-coded age',()=>{
 const finishedAt=Date.UTC(2026,8,28);
 const sql=batchToPostgresSql({version:1,startedAt:finishedAt-1000,finishedAt,successful:0,failed:0,rows:[]});
 assert.match(sql,/2026-08-29T00:00:00\.000Z/);
 assert.match(sql,/2026-06-30T00:00:00\.000Z/);
 assert.match(sql,/2026-04-01T00:00:00\.000Z/);
 assert.doesNotMatch(sql,/interval '90 days'/);
});
