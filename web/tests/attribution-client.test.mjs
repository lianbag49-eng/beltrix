import test from 'node:test';import assert from 'node:assert/strict';
import {captureAttribution,getStoredAttribution,getGrowthQueue,recordGrowthEvent,ATTRIBUTION_KEY,GROWTH_QUEUE_KEY} from '../attribution-client.js';

function storage(){
 const m=new Map();
 return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),dump:()=>m};
}

test('capture persists first referral and updates last-touch campaign',()=>{
 const s=storage();
 captureAttribution('https://beltrix.trade/?ref=alice&utm_source=telegram&utm_campaign=launch',s,100);
 captureAttribution('https://beltrix.trade/?ref=bob&utm_source=youtube&utm_campaign=review',s,200);
 const a=getStoredAttribution(s);
 assert.equal(a.referral,'alice');assert.equal(a.source,'youtube');assert.equal(a.campaign,'review');
 assert.equal(a.firstSeenAt,100);assert.equal(a.lastSeenAt,200);
 assert.ok(s.dump().has(ATTRIBUTION_KEY));
});

test('growth queue is capped and strips secret fields through attribution core',()=>{
 const s=storage();captureAttribution('https://beltrix.trade/?ref=alice',s,1);
 for(let i=0;i<205;i++)recordGrowthEvent('trade_order_confirmed',{venue:'hyperliquid',apiKey:'secret',n:i},s,i+2);
 const q=getGrowthQueue(s);assert.equal(q.length,200);assert.equal(q.at(-1).n,204);assert.equal(q.at(-1).apiKey,undefined);
 assert.ok(s.dump().has(GROWTH_QUEUE_KEY));
});
