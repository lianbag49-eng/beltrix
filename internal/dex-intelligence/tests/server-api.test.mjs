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
