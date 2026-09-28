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
