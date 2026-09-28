import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketIntelligenceApi} from '../server-api.js';

function repository(rows=[]){
 return {
  calls:[],
  async history(args){this.calls.push(args);return rows;}
 };
}
function parse(response){return JSON.parse(response.body)}

test('health is public but telemetry routes require bearer auth',async()=>{
 const repo=repository();
 const api=createMarketIntelligenceApi({repository:repo,token:'secret-token',clock:()=>0});
 const health=await api.handle({url:'/health'});
 assert.equal(health.status,200);
 assert.equal(parse(health).service,'beltrix-market-intelligence');
 const denied=await api.handle({url:'/v1/history?asset=BTC'});
 assert.equal(denied.status,401);
 assert.equal(repo.calls.length,0);
});

test('history validates asset and forwards bounded query parameters',async()=>{
 const rows=[{asset:'BTC',timestamp:1}];
 const repo=repository(rows);
 const api=createMarketIntelligenceApi({repository:repo,token:'secret-token'});
 const bad=await api.handle({url:'/v1/history?asset=../../etc',headers:{authorization:'Bearer secret-token'}});
 assert.equal(bad.status,400);
 const ok=await api.handle({url:'/v1/history?asset=btc&hours=48&limit=99999',headers:{authorization:'Bearer secret-token'}});
 assert.equal(ok.status,200);
 const body=parse(ok);
 assert.equal(body.asset,'BTC');
 assert.equal(body.limit,5000);
 assert.deepEqual(body.rows,rows);
 assert.equal(repo.calls[0].asset,'BTC');
 assert.equal(repo.calls[0].limit,5000);
});

test('latest returns newest repository snapshot without exposing database details',async()=>{
 const rows=[{timestamp:1,asset:'ETH'},{timestamp:2,asset:'ETH'}];
 const repo=repository(rows);
 const api=createMarketIntelligenceApi({repository:repo,token:'abc123'});
 const out=await api.handle({url:'/v1/latest?asset=ETH',headers:{Authorization:'Bearer abc123'}});
 assert.equal(out.status,200);
 assert.deepEqual(parse(out).latest,rows[1]);
 assert.equal(out.body.includes('DATABASE_URL'),false);
});

test('unsupported methods and routes fail closed',async()=>{
 const api=createMarketIntelligenceApi({repository:repository(),token:'x'});
 assert.equal((await api.handle({method:'POST',url:'/v1/history',headers:{authorization:'Bearer x'}})).status,405);
 assert.equal((await api.handle({url:'/v1/nope',headers:{authorization:'Bearer x'}})).status,404);
});


test('collector health and open alerts require auth and use repository read methods',async()=>{
 const repo={
  history:async()=>[],
  collectorHealth:async({limit})=>[{finished_at:'2026-09-28T00:00:00Z',healthy:true,limit}],
  openAlerts:async({limit})=>[{venue:'orderly',severity:'warning',alert_key:'latency',message:'Slow',limit}]
 };
 const api=createMarketIntelligenceApi({repository:repo,token:'secret'});
 const denied=await api.handle({url:'/v1/collector-health'});
 assert.equal(denied.status,401);
 const health=await api.handle({url:'/v1/collector-health?limit=10',headers:{authorization:'Bearer secret'}});
 assert.equal(health.status,200);
 assert.equal(parse(health).rows[0].limit,10);
 const alerts=await api.handle({url:'/v1/open-alerts?limit=20',headers:{authorization:'Bearer secret'}});
 assert.equal(alerts.status,200);
 assert.equal(parse(alerts).rows[0].alert_key,'latency');
});


test('alert status update is authenticated bounded and delegated',async()=>{
 let seen=null;
 const repo={
  history:async()=>[],
  updateAlertStatus:async input=>{seen=input;return {id:7,status:input.status}}
 };
 const api=createMarketIntelligenceApi({repository:repo,token:'secret'});
 const denied=await api.handle({method:'PATCH',url:'/v1/alerts/7',body:{status:'acknowledged'}});
 assert.equal(denied.status,401);
 const bad=await api.handle({method:'PATCH',url:'/v1/alerts/7',headers:{authorization:'Bearer secret'},body:{status:'deleted'}});
 assert.equal(bad.status,400);
 const ok=await api.handle({method:'PATCH',url:'/v1/alerts/7',headers:{authorization:'Bearer secret'},body:{status:'resolved'}});
 assert.equal(ok.status,200);
 assert.deepEqual(seen,{id:7,status:'resolved'});
 assert.equal(parse(ok).alert.status,'resolved');
});


test('readiness is public but requires fresh successful persisted collector state',async()=>{
 const freshRepo={
  history:async()=>[],
  collectorHealth:async()=>[{finished_at:'2026-09-28T05:00:00.000Z',successful_assets:3,failed_assets:0}]
 };
 const api=createMarketIntelligenceApi({repository:freshRepo,token:'secret',clock:()=>Date.parse('2026-09-28T05:20:00.000Z')});
 const ready=await api.handle({url:'/ready'});
 assert.equal(ready.status,200);
 assert.equal(parse(ready).ok,true);

 const staleApi=createMarketIntelligenceApi({repository:freshRepo,token:'secret',clock:()=>Date.parse('2026-09-28T07:00:01.000Z')});
 const stale=await staleApi.handle({url:'/ready'});
 assert.equal(stale.status,503);
 assert.equal(parse(stale).ok,false);

 const failedApi=createMarketIntelligenceApi({repository:{history:async()=>[],collectorHealth:async()=>[{finished_at:'2026-09-28T05:19:00.000Z',successful_assets:0,failed_assets:3}]},token:'secret',clock:()=>Date.parse('2026-09-28T05:20:00.000Z')});
 assert.equal((await failedApi.handle({url:'/ready'})).status,503);
});
