import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeServerSnapshot,createTelemetryRepository} from '../storage/telemetry-repository.js';
import {createPostgresTelemetryAdapter} from '../storage/postgres-adapter.js';

test('server snapshot normalization preserves metric units and capacities',()=>{
 const out=normalizeServerSnapshot({
  asset:'btc',timestamp:1000,
  venues:{
   hyperliquid:{ok:true,health:'healthy',latencyMs:10,spreadBps:2,depth25Usd:5000,minFillRatio:1,metric:{fundingRate:0.001,openInterest:2,openInterestUsd:200,openInterestUnit:'base',volume24h:1000,volume24hUsd:1000,volume24hUnit:'USD-notional'}},
   gmx:{ok:true,health:'live',capacityLongUsd:7000,capacityShortUsd:6000}
  }
 });
 assert.equal(out.asset,'BTC');
 assert.equal(out.observations.length,2);
 assert.equal(out.observations[0].fundingRate,0.001);
 assert.equal(out.observations[1].capacityLongUsd,7000);
});

test('repository delegates normalized save and bounded history query',async()=>{
 let saved=null,queried=null;
 const repo=createTelemetryRepository({
  insertSnapshot:async x=>{saved=x;return {id:1}},
  querySnapshots:async x=>{queried=x;return []}
 });
 await repo.save({asset:'BTC',timestamp:1000,venues:{}});
 await repo.history({asset:'btc',limit:99999,since:'2026-09-01T00:00:00Z'});
 assert.equal(saved.asset,'BTC');
 assert.equal(queried.asset,'BTC');
 assert.equal(queried.limit,10000);
});

test('Postgres adapter executes transaction and maps query results',async()=>{
 const calls=[];
 const client={query:async(sql,args)=>{
  calls.push([sql,args]);
  if(sql.includes('returning id'))return {rows:[{id:42}]};
  if(sql.includes('select asset'))return {rows:[{payload:{asset:'BTC',timestamp:1,venues:{}}}]};
  return {rows:[]};
 }};
 const adapter=createPostgresTelemetryAdapter(client);
 const repo=createTelemetryRepository(adapter);
 const saved=await repo.save({asset:'BTC',timestamp:1000,venues:{hyperliquid:{ok:true,health:'healthy'}}});
 assert.equal(saved.snapshotId,42);
 assert.ok(calls.some(([sql])=>sql==='BEGIN'));
 assert.ok(calls.some(([sql])=>sql==='COMMIT'));
 const rows=await repo.history({asset:'BTC',limit:10});
 assert.equal(rows[0].asset,'BTC');
});


test('Postgres alert updates are limited to acknowledge or resolve states',async()=>{
 const calls=[];
 const client={query:async(sql,args)=>{calls.push([sql,args]);return {rows:[{id:7,status:args[1]}]}}};
 const adapter=createPostgresTelemetryAdapter(client);
 await assert.rejects(()=>adapter.updateAlertStatus({id:7,status:'deleted'}),/Invalid alert status/);
 const row=await adapter.updateAlertStatus({id:7,status:'acknowledged'});
 assert.equal(row.status,'acknowledged');
 assert.equal(calls.at(-1)[1][0],7);
 assert.equal(calls.at(-1)[1][1],'acknowledged');
 assert.match(calls.at(-1)[0],/status in \('open','acknowledged'\)/);
});
