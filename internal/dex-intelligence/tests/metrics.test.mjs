import test from 'node:test';import assert from 'node:assert/strict';
import {hyperliquidMarketMetrics,paradexMarketMetrics,dydxMarketMetrics,collectMarketMetrics} from '../market-metrics.js';

const ok=json=>({ok:true,json:async()=>json});

test('Hyperliquid metric collector normalizes funding OI and day notional volume',async()=>{
 const out=await hyperliquidMarketMetrics('BTC',{fetchImpl:async(_url,options)=>{
  assert.deepEqual(JSON.parse(options.body),{type:'metaAndAssetCtxs'});
  return ok([
   {universe:[{name:'BTC'},{name:'ETH'}]},
   [
    {markPx:'100',funding:'0.0001',openInterest:'20',dayNtlVlm:'500000'},
    {markPx:'200',funding:'0.0002',openInterest:'10',dayNtlVlm:'300000'}
   ]
  ]);
 }});
 assert.equal(out.symbol,'BTC');
 assert.equal(out.fundingRate,0.0001);
 assert.equal(out.openInterest,20);
 assert.equal(out.openInterestUsd,2000);
 assert.equal(out.volume24hUsd,500000);
 assert.equal(out.openInterestUnit,'base');
});

test('Paradex metric collector preserves venue-native OI and volume semantics',async()=>{
 let url='';
 const out=await paradexMarketMetrics('BTC',{fetchImpl:async u=>{
  url=u;
  return ok({results:[{
   symbol:'BTC-USD-PERP',mark_price:'101',funding_rate:'0.0003',
   open_interest:'6100048.3',volume_24h:'47041.0',created_at:123
  }]});
 }});
 assert.match(url,/markets\/summary\?market=BTC-USD-PERP/);
 assert.equal(out.openInterest,6100048.3);
 assert.equal(out.openInterestUsd,null);
 assert.equal(out.openInterestUnit,'venue-native');
 assert.equal(out.volume24hUnit,'venue-native');
});

test('dYdX metric collector tolerates keyed indexer market response',async()=>{
 const out=await dydxMarketMetrics('BTC',{fetchImpl:async()=>ok({markets:{
  'BTC-USD':{ticker:'BTC-USD',oraclePrice:'102',nextFundingRate:'0.0004',openInterest:'12.5',volume24H:'800000'}
 }})});
 assert.equal(out.symbol,'BTC-USD');
 assert.equal(out.markPrice,102);
 assert.equal(out.fundingRate,0.0004);
 assert.equal(out.openInterest,12.5);
 assert.equal(out.volume24h,800000);
});

test('metric orchestration isolates individual venue failures',async()=>{
 const rows=await collectMarketMetrics('BTC',{fetchImpl:async(url,options={})=>{
  if(url.includes('hyperliquid'))return ok([{universe:[{name:'BTC'}]},[{markPx:'100',funding:'0.1',openInterest:'1',dayNtlVlm:'1'}]]);
  if(url.includes('paradex'))throw Error('paradex down');
  if(url.includes('dydx'))return ok({markets:{'BTC-USD':{ticker:'BTC-USD'}}});
  throw Error('unexpected '+url);
 }});
 assert.equal(rows.length,3);
 assert.equal(rows.find(x=>x.venue==='paradex').ok,false);
 assert.equal(rows.find(x=>x.venue==='hyperliquid').ok,true);
});
