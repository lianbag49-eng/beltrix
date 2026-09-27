import test from 'node:test';import assert from 'node:assert/strict';
import {hyperliquidLogoUrl,loadHyperliquidMarkets} from '../hyperliquid-markets.js';

test('Hyperliquid icon URLs use Hyperliquid app coin assets',()=>{
 assert.equal(hyperliquidLogoUrl('BTC'),'https://app.hyperliquid.xyz/coins/BTC.svg');
 assert.equal(hyperliquidLogoUrl('xyz:ABC'),'https://app.hyperliquid.xyz/coins/ABC.svg');
});

test('all perps include validator and HIP-3 markets with correct asset ids',async()=>{
 const calls=[];
 const rows=await loadHyperliquidMarkets({fetchImpl:async(_url,options)=>{
  const body=JSON.parse(options.body);calls.push(body);
  if(body.type==='perpDexs')return {ok:true,json:async()=>[null,{name:'xyz'}]};
  if(body.type==='meta'&&body.dex==='xyz')return {ok:true,json:async()=>({universe:[{name:'xyz:ABC',maxLeverage:10,szDecimals:2}]})};
  if(body.type==='meta')return {ok:true,json:async()=>({universe:[{name:'BTC',maxLeverage:40,szDecimals:5}]})};
  throw Error('unexpected');
 }});
 assert.equal(rows.length,2);
 assert.equal(rows.find(x=>x.value==='BTC').asset,0);
 assert.equal(rows.find(x=>x.value==='xyz:ABC').asset,110000);
 assert.equal(rows.find(x=>x.value==='xyz:ABC').dex,'xyz');
});
