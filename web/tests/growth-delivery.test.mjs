import test from 'node:test';import assert from 'node:assert/strict';
import {deliveryBatch,deliverGrowthEvents} from '../growth-delivery.js';

test('delivery batch adds deterministic event IDs and strips secret-like fields',()=>{
 const event={type:'first_trade',at:1,apiKey:'nope',attribution:{source:'telegram'},volume:20};
 const a=deliveryBatch([event])[0],b=deliveryBatch([event])[0];
 assert.equal(a.apiKey,undefined);assert.equal(a.eventId,b.eventId);assert.equal(a.volume,20);
});

test('delivery requires HTTPS outside localhost',async()=>{
 await assert.rejects(()=>deliverGrowthEvents([{type:'x',at:1}],{endpoint:'http://example.com/events',fetchImpl:async()=>({ok:true})}));
});

test('delivery posts a bounded batch',async()=>{
 let body='';
 const result=await deliverGrowthEvents([{type:'page_view',at:1}],{
  endpoint:'https://api.beltrix.example/events',
  fetchImpl:async(_url,options)=>{body=options.body;return {ok:true}}
 });
 assert.equal(result.sent,1);
 assert.equal(JSON.parse(body).events[0].type,'page_view');
});
