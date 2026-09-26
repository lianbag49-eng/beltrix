import test from 'node:test';import assert from 'node:assert/strict';
import {venueOptions,venueNetworks,venueIsTradable,loadVenueMarkets,loadVenueCandles,marketSnapshot} from '../market-venue-service.js';

test('registry exposes Hyperliquid plus read-only comparison venues',()=>{
 const ids=venueOptions().map(x=>x.id);
 assert.deepEqual(ids,['hyperliquid','orderly','gmx','paradex']);
 assert.equal(venueIsTradable('hyperliquid'),true);
 assert.equal(venueIsTradable('gmx'),false);
 assert.ok(venueNetworks('gmx').some(x=>x.id==='arbitrum'));
});

test('Orderly public catalog uses documented endpoint and normalizes perps',async()=>{
 let seen='';
 const rows=await loadVenueMarkets({venueId:'orderly',fetchImpl:async url=>{
  seen=String(url);
  return {ok:true,json:async()=>({data:{rows:[{symbol:'PERP_BTC_USDC',quote_tick:0.1,base_min:0.001,max_leverage:20}]}})};
 }});
 assert.equal(seen,'https://api.orderly.org/v1/public/info');
 assert.equal(rows[0].venue,'orderly');
 assert.equal(rows[0].base,'BTC');
});

test('Paradex public catalog uses /v1/markets',async()=>{
 let seen='';
 const rows=await loadVenueMarkets({venueId:'paradex',fetchImpl:async url=>{
  seen=String(url);
  return {ok:true,json:async()=>({results:[{symbol:'BTC-USD-PERP',asset_kind:'PERP',base_currency:'BTC',quote_currency:'USD',price_tick_size:'0.1'}]})};
 }});
 assert.equal(seen,'https://api.prod.paradex.trade/v1/markets');
 assert.equal(rows[0].base,'BTC');
});

test('snapshot extracts common venue fields without inventing zeroes',()=>{
 const s=marketSnapshot({raw:{mark_price:'123.4',open_interest:'55',funding_rate:'0.001'}});
 assert.equal(s.mark,123.4);assert.equal(s.openInterest,55);assert.equal(s.funding,0.001);assert.equal(s.volume24h,null);
});


test('Orderly TradingView history normalizes to BELTRIX candles',async()=>{
 let seen='';
 const rows=await loadVenueCandles({
  venueId:'orderly',
  market:{symbol:'PERP_BTC_USDC',base:'BTC'},
  interval:'15m',
  fetchImpl:async url=>{
   seen=String(url);
   return {ok:true,json:async()=>({s:'ok',t:[1000,1900],o:[10,11],h:[12,13],l:[9,10],c:[11,12],v:[5,6]})};
  }
 });
 assert.match(seen,/\/v1\/tv\/history\?/);
 assert.deepEqual(rows.map(x=>x.t),[1000000,1900000]);
 assert.equal(rows[1].c,12);
});

test('GMX oracle candles normalize descending source rows into ascending candles',async()=>{
 const rows=await loadVenueCandles({
  venueId:'gmx',
  network:'arbitrum',
  market:{symbol:'BTC/USD',base:'BTC'},
  interval:'1h',
  fetchImpl:async()=>({ok:true,json:async()=>({candles:[
   [2000,20,22,19,21],
   [1000,10,12,9,11]
  ]})})
 });
 assert.deepEqual(rows.map(x=>x.t),[1000000,2000000]);
 assert.equal(rows[0].o,10);
});

test('Paradex hourly source candles aggregate into 4h BELTRIX candles',async()=>{
 const rows=await loadVenueCandles({
  venueId:'paradex',
  market:{symbol:'BTC-USD-PERP',base:'BTC'},
  interval:'4h',
  fetchImpl:async()=>({ok:true,json:async()=>({results:[
   {start_at:0,open:10,high:12,low:9,close:11,volume:1},
   {start_at:3600000,open:11,high:13,low:10,close:12,volume:2},
   {start_at:7200000,open:12,high:14,low:11,close:13,volume:3},
   {start_at:10800000,open:13,high:15,low:12,close:14,volume:4}
  ]})})
 });
 assert.equal(rows.length,1);
 assert.deepEqual(rows[0],{t:0,o:10,h:15,l:9,c:14,v:10});
});
