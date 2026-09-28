import test from 'node:test';import assert from 'node:assert/strict';
import {hyperliquidBook,orderlyBook,paradexBook,dydxBook,gmxMarketsInfo,gmxTradingCapacity,usd30ToNumber} from '../public-data.js';

test('Hyperliquid book collector maps l2Book levels',async()=>{
 let body;
 const out=await hyperliquidBook('BTC',{fetchImpl:async(_url,options)=>{
  body=JSON.parse(options.body);
  return {ok:true,json:async()=>({time:123,levels:[[{px:'10',sz:'2'}],[{px:'11',sz:'3'}]]})};
 }});
 assert.deepEqual(body,{type:'l2Book',coin:'BTC'});
 assert.equal(out.bids[0].px,'10');
});

test('Orderly collector unwraps public orderbook data',async()=>{
 let url='';
 const out=await orderlyBook('PERP_BTC_USDC',{maxLevel:25,fetchImpl:async u=>{
  url=u;
  return {ok:true,json:async()=>({success:true,data:{timestamp:456,bids:[['10','2']],asks:[['11','3']]}})};
 }});
 assert.match(url,/PERP_BTC_USDC/);
 assert.match(url,/max_level=25/);
 assert.equal(out.receivedAt,456);
 assert.equal(out.bids[0][0],'10');
});

test('Paradex collector preserves public orderbook sides and source timestamp',async()=>{
 const out=await paradexBook('BTC-USD-PERP',{fetchImpl:async()=>({ok:true,json:async()=>({last_updated_at:789,bids:[['10','2']],asks:[['11','3']]})})});
 assert.equal(out.venue,'paradex');
 assert.equal(out.receivedAt,789);
 assert.equal(out.asks.length,1);
});

test('dYdX collector maps indexer orderbook',async()=>{
 const out=await dydxBook('BTC-USD',{fetchImpl:async()=>({ok:true,json:async()=>({bids:[{price:'10',size:'2'}],asks:[{price:'11',size:'3'}]})})});
 assert.equal(out.venue,'dydx');assert.equal(out.bids[0].price,'10');
});

test('GMX oracle collector restricts active oracle networks',async()=>{
 let url='';
 const out=await gmxMarketsInfo({chain:'arbitrum',fetchImpl:async u=>{
  url=u;
  return {ok:true,json:async()=>[{name:'BTC/USD'}]};
 }});
 assert.match(url,/arbitrum-api\.gmxinfra\.io\/markets\/info/);
 assert.equal(out.length,1);
 await assert.rejects(()=>gmxMarketsInfo({chain:'megaeth',fetchImpl:async()=>({ok:true,json:async()=>[]})}),/Unsupported GMX oracle network/);
});

test('GMX JIT trading capacity converts 30-decimal USD and fails over peer',async()=>{
 const urls=[];
 const out=await gmxTradingCapacity('BTC/USD [BTC-USDC]',{
  direction:'long',
  fetchImpl:async url=>{
   urls.push(url);
   if(url.includes('.gmxapi.io/'))return {ok:false,status:503,json:async()=>({})};
   return {ok:true,json:async()=>({
    availableLiquidity:'123456000000000000000000000000000',
    baseAvailableLiquidity:'100000000000000000000000000000000',
    jitAvailableLiquidity:'23456000000000000000000000000000',
    limitingFactor:'reserve',
    jitDataStatus:'available',
    marketDataStatus:'available'
   })};
  }
 });
 assert.equal(urls.length,2);
 assert.match(urls[0],/arbitrum\.gmxapi\.io\/v1\/markets\/trading-capacity/);
 assert.match(urls[1],/arbitrum\.gmxapi\.ai\/v1\/markets\/trading-capacity/);
 assert.equal(out.availableLiquidityUsd,123.456);
 assert.equal(out.baseAvailableLiquidityUsd,100);
 assert.equal(out.jitAvailableLiquidityUsd,23.456);
 assert.equal(out.jitDataStatus,'available');
 assert.equal(usd30ToNumber('1000000000000000000000000000000'),1);
});


test('Orderly production collector uses unauthenticated public WebSocket snapshot',async()=>{
 const sent=[];
 class FakeWebSocket{
  static OPEN=1;
  constructor(url){
   this.url=url;this.readyState=1;
   setTimeout(()=>this.onopen?.(),0);
  }
  send(raw){
   const msg=JSON.parse(raw);sent.push(msg);
   if(msg.event==='subscribe')setTimeout(()=>this.onmessage?.({data:JSON.stringify({
    topic:'PERP_BTC_USDC@orderbook',ts:999,
    data:{symbol:'PERP_BTC_USDC',bids:[[100,2],[99,3]],asks:[[101,4],[102,5]]}
   })}),0);
  }
  close(){this.readyState=3}
 }
 const out=await orderlyBook('PERP_BTC_USDC',{WebSocketCtor:FakeWebSocket,timeoutMs:1000});
 assert.equal(out.transport,'public-websocket');
 assert.equal(out.receivedAt,999);
 assert.deepEqual(out.bids[0],[100,2]);
 assert.deepEqual(sent[0],{id:sent[0].id,event:'subscribe',topic:'PERP_BTC_USDC@orderbook'});
});
