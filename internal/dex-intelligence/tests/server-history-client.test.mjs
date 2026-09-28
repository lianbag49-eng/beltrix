import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerHistoryClient} from '../server-history-client.js';

test('disabled client cleanly returns null without network access',async()=>{
 let calls=0;
 const client=createServerHistoryClient({baseUrl:'',fetchImpl:async()=>{calls++;}});
 assert.equal(client.enabled,false);
 assert.equal(await client.history({asset:'BTC'}),null);
 assert.equal(calls,0);
});

test('history sends bearer token only to configured internal API',async()=>{
 const calls=[];
 const client=createServerHistoryClient({
  baseUrl:'https://internal.example/api/',
  getToken:()=> 'session-token',
  fetchImpl:async(url,init)=>{
   calls.push({url,init});
   return {ok:true,status:200,async json(){return {rows:[]}}};
  }
 });
 const out=await client.history({asset:'btc',hours:12,limit:20});
 assert.deepEqual(out,{rows:[]});
 assert.equal(calls[0].url,'https://internal.example/api/v1/history?asset=BTC&hours=12&limit=20');
 assert.equal(calls[0].init.headers.authorization,'Bearer session-token');
 assert.equal(calls[0].init.credentials,'omit');
});

test('health never sends the bearer token',async()=>{
 const calls=[];
 const client=createServerHistoryClient({
  baseUrl:'https://internal.example',
  getToken:()=> 'secret',
  fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,status:200,async json(){return {ok:true}}}}
 });
 await client.health();
 assert.equal(calls[0].init.headers.authorization,undefined);
});

test('authenticated requests fail before fetch when token is absent',async()=>{
 let called=false;
 const client=createServerHistoryClient({baseUrl:'https://internal.example',getToken:()=>'',fetchImpl:async()=>{called=true}});
 await assert.rejects(()=>client.latest('ETH'),/token is not available/);
 assert.equal(called,false);
});


test('collector health and alert reads use authenticated GET endpoints',async()=>{
 const calls=[];
 const client=createServerHistoryClient({
  baseUrl:'https://internal.example',
  getToken:()=> 'secret',
  fetchImpl:async(url,init)=>{
   calls.push({url,init});
   return {ok:true,status:200,async json(){return {rows:[]}}};
  }
 });
 await client.collectorHealth(12);
 await client.openAlerts(34);
 assert.equal(calls[0].url,'https://internal.example/v1/collector-health?limit=12');
 assert.equal(calls[1].url,'https://internal.example/v1/open-alerts?limit=34');
 assert.equal(calls[0].init.headers.authorization,'Bearer secret');
 assert.equal(calls[1].init.headers.authorization,'Bearer secret');
});


test('alert status client sends authenticated PATCH without persisting credentials',async()=>{
 let call=null;
 const client=createServerHistoryClient({
  baseUrl:'https://internal.example',
  getToken:()=> 'session-token',
  fetchImpl:async(url,init)=>{call={url,init};return {ok:true,status:200,async json(){return {alert:{id:9,status:'acknowledged'}}}}}
 });
 const out=await client.updateAlertStatus(9,'acknowledged');
 assert.equal(call.url,'https://internal.example/v1/alerts/9');
 assert.equal(call.init.method,'PATCH');
 assert.equal(call.init.headers.authorization,'Bearer session-token');
 assert.deepEqual(JSON.parse(call.init.body),{status:'acknowledged'});
 assert.equal(out.alert.status,'acknowledged');
});


test('expanded client exposes comparison operations protocol and plan endpoints',async()=>{
 const calls=[];
 const authValue='t'.repeat(32);
 const client=createServerHistoryClient({
  baseUrl:'https://internal.example',
  getToken:()=>authValue,
  fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,status:200,async json(){return {ok:true}}}}
 });
 await client.operations('btc');
 await client.quality({asset:'ETH',hours:12});
 await client.comparison({asset:'SOL',hours:48});
 await client.bd();
 await client.protocol();
 await client.planExecution({asset:'BTC',side:'buy',notionalUsd:1000});
 assert.equal(calls[0].url,'https://internal.example/v1/operations?asset=BTC');
 assert.equal(calls[1].url,'https://internal.example/v1/quality?asset=ETH&hours=12');
 assert.equal(calls[2].url,'https://internal.example/v1/comparison?asset=SOL&hours=48');
 assert.equal(calls[5].url,'https://internal.example/v1/execution/plan');
 assert.equal(calls[5].init.method,'POST');
 assert.deepEqual(JSON.parse(calls[5].init.body),{asset:'BTC',side:'buy',notionalUsd:1000});
});
