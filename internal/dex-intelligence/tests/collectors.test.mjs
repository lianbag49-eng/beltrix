import test from 'node:test';import assert from 'node:assert/strict';
import {hyperliquidBook,paradexBook,dydxBook} from '../public-data.js';

test('Hyperliquid book collector maps l2Book levels',async()=>{
 let body;
 const out=await hyperliquidBook('BTC',{fetchImpl:async(_url,options)=>{
  body=JSON.parse(options.body);
  return {ok:true,json:async()=>({time:123,levels:[[{px:'10',sz:'2'}],[{px:'11',sz:'3'}]]})};
 }});
 assert.deepEqual(body,{type:'l2Book',coin:'BTC'});
 assert.equal(out.bids[0].px,'10');
});

test('Paradex collector preserves public orderbook sides',async()=>{
 const out=await paradexBook('BTC-USD-PERP',{fetchImpl:async()=>({ok:true,json:async()=>({bids:[['10','2']],asks:[['11','3']]})})});
 assert.equal(out.venue,'paradex');assert.equal(out.asks.length,1);
});

test('dYdX collector maps indexer orderbook',async()=>{
 const out=await dydxBook('BTC-USD',{fetchImpl:async()=>({ok:true,json:async()=>({bids:[{price:'10',size:'2'}],asks:[{price:'11',size:'3'}]})})});
 assert.equal(out.venue,'dydx');assert.equal(out.bids[0].price,'10');
});
