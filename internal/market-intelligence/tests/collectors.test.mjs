import test from 'node:test';import assert from 'node:assert/strict';
import {collectHyperliquid,collectOrderly,collectParadex,collectDydx,collectAster,collectVenueTelemetry} from '../collectors.mjs';

const response=json=>({ok:true,json:async()=>json});

test('Hyperliquid collector sums direct 24h notional and OI USD',async()=>{
 const r=await collectHyperliquid(async()=>response([{universe:[{name:'BTC'},{name:'ETH'}]},[
  {dayNtlVlm:'1000',openInterest:'2',markPx:'100'},
  {dayNtlVlm:'2000',openInterest:'3',markPx:'50'}
 ]]));
 assert.equal(r.marketCount,2);assert.equal(r.volume24h,3000);assert.equal(r.openInterestUsd,350);assert.equal(r.confidence,'direct');
});

test('Orderly collector tolerates public info field variants',async()=>{
 const r=await collectOrderly(async()=>response({data:{rows:[
  {symbol:'PERP_BTC_USDC','24h_amount':'12',open_interest_usd:'9'},
  {symbol:'PERP_ETH_USDC','24h_amount':'8',open_interest_usd:'11'}
 ]}}));
 assert.equal(r.marketCount,2);assert.equal(r.volume24h,20);assert.equal(r.openInterestUsd,20);
});

test('Paradex collector separates market catalog from optional summary telemetry',async url=>{
 if(String(url).includes('/summary'))return response({results:[{volume_24h:'50',open_interest:'2',mark_price:'10'}]});
 return response({results:[{symbol:'BTC-USD-PERP'}]});
});
test('Paradex direct values normalize',async()=>{
 const r=await collectParadex(async url=>String(url).includes('/summary')?response({results:[{volume_24h:'50',open_interest:'2',mark_price:'10'}]}):response({results:[{symbol:'BTC-USD-PERP'}]}));
 assert.equal(r.marketCount,1);assert.equal(r.volume24h,50);assert.equal(r.openInterestUsd,20);
});

test('dYdX collector uses indexer market values',async()=>{
 const r=await collectDydx(async()=>response({markets:{BTC:{volume24H:'80',openInterest:'2',oraclePrice:'20'}}}));
 assert.equal(r.volume24h,80);assert.equal(r.openInterestUsd,40);
});

test('Aster collector records direct public volume without pretending OI is available',async()=>{
 const r=await collectAster(async()=>response([{symbol:'BTCUSDT',quoteVolume:'100'},{symbol:'ETHUSDT',quoteVolume:'200'}]));
 assert.equal(r.marketCount,2);assert.equal(r.volume24h,300);assert.equal(r.openInterestUsd,null);
});

test('unsupported collectors remain explicitly unavailable',async()=>{
 const rows=await collectVenueTelemetry(['gmx'],async()=>response({}));
 assert.equal(rows[0].confidence,'unavailable');assert.equal(rows[0].error,'collector-not-implemented');
});
