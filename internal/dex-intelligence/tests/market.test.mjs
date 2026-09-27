import test from 'node:test';import assert from 'node:assert/strict';
import {collectAssetBooks,collectGmxState} from '../market-snapshot.js';

const ok=json=>({ok:true,json:async()=>json});

test('asset snapshot collects comparable books without enabling execution',async()=>{
 const fetchImpl=async(url,options={})=>{
  if(url.includes('hyperliquid')){
   const body=JSON.parse(options.body);
   assert.deepEqual(body,{type:'l2Book',coin:'BTC'});
   return ok({time:1000,levels:[[{px:'99.9',sz:'100'}],[{px:'100.1',sz:'100'}]]});
  }
  if(url.includes('api.orderly.org'))return ok({data:{timestamp:1000,bids:[['99.9','100']],asks:[['100.1','100']]}});
  if(url.includes('paradex'))return ok({last_updated_at:1000,bids:[['99.9','100']],asks:[['100.1','100']]});
  if(url.includes('dydx'))return ok({bids:[{price:'99.9',size:'100'}],asks:[{price:'100.1',size:'100'}]});
  throw Error('unexpected url '+url);
 };
 const rows=await collectAssetBooks('BTC',{fetchImpl,now:1500,notionalUsd:1000,feeBpsByVenue:{hyperliquid:4}});
 assert.equal(rows.length,4);
 assert.ok(rows.every(x=>x.ok));
 assert.equal(rows.find(x=>x.venue==='orderly').symbol,'PERP_BTC_USDC');
 assert.equal(rows.find(x=>x.venue==='hyperliquid').buy.feeBps,4);
 assert.equal(rows.find(x=>x.venue==='paradex').buy.effectiveCostBps,null);
});

test('asset snapshot isolates collector failures',async()=>{
 const fetchImpl=async url=>{
  if(url.includes('orderly'))throw Error('down');
  return ok({bids:[['99.9','100']],asks:[['100.1','100']],levels:[[{px:'99.9',sz:'100'}],[{px:'100.1',sz:'100'}]],time:1000});
 };
 const rows=await collectAssetBooks('BTC',{fetchImpl,now:1500});
 const orderly=rows.find(x=>x.venue==='orderly');
 assert.equal(orderly.ok,false);
 assert.match(orderly.error,/down/);
});

test('GMX state keeps pool model and attaches per-side JIT-aware capacity',async()=>{
 const fetchImpl=async url=>{
  if(url.includes('gmxinfra.io/markets/info'))return ok([{name:'BTC/USD [BTC-USDC]'},{name:'ETH/USD [WETH-USDC]'}]);
  if(url.includes('/markets/trading-capacity')){
   const isLong=url.includes('direction=long');
   return ok({
    availableLiquidity:isLong?'5000000000000000000000000000000000':'4000000000000000000000000000000000',
    baseAvailableLiquidity:'3000000000000000000000000000000000',
    jitAvailableLiquidity:isLong?'2000000000000000000000000000000000':'1000000000000000000000000000000000',
    limitingFactor:'reserve',
    jitDataStatus:'available',
    marketDataStatus:'available'
   });
  }
  throw Error('unexpected '+url);
 };
 const gmx=await collectGmxState('BTC',{fetchImpl});
 assert.equal(gmx.ok,true);
 assert.equal(gmx.marketCount,2);
 assert.equal(gmx.matchingMarkets,1);
 assert.equal(gmx.matchedSymbol,'BTC/USD [BTC-USDC]');
 assert.equal(gmx.capacity.long.availableLiquidityUsd,5000);
 assert.equal(gmx.capacity.short.availableLiquidityUsd,4000);
 assert.match(gmx.note,/not a CLOB depth substitute/i);
});
