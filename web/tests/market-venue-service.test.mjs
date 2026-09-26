import test from 'node:test';import assert from 'node:assert/strict';
import {venueOptions,venueNetworks,venueIsTradable,loadVenueMarkets,marketSnapshot} from '../market-venue-service.js';

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
