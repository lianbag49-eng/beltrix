import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketIntelligenceService} from '../service-runtime.js';

test('service runtime composes Postgres repository and authenticated API',async()=>{
 const queries=[];
 const client={query:async(sql,args)=>{
  queries.push([sql,args]);
  if(sql.includes('from mi_snapshots'))return {rows:[{payload:{asset:'BTC',timestamp:123,venues:{}}}]};
  if(sql.includes('from mi_collector_health_recent'))return {rows:[{finished_at:'2026-09-28T00:00:00Z',successful_assets:3,failed_assets:0,healthy:true}]};
  if(sql.includes('from mi_open_alerts'))return {rows:[]};
  return {rows:[]};
 }};
 const service=createMarketIntelligenceService({queryClient:client,apiToken:'x'.repeat(32),clock:()=>0});
 const denied=await service.api.handle({url:'/v1/history?asset=BTC'});
 assert.equal(denied.status,401);
 const ok=await service.api.handle({url:'/v1/history?asset=BTC&limit=10',headers:{authorization:'Bearer '+ 'x'.repeat(32)}});
 assert.equal(ok.status,200);
 assert.equal(JSON.parse(ok.body).count,1);
 assert.ok(queries.some(([sql])=>sql.includes('from mi_snapshots')));
 assert.equal(typeof service.handler,'function');
 assert.equal(typeof service.createServer,'function');
});
