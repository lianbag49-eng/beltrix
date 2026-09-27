import test from 'node:test';import assert from 'node:assert/strict';
import {hyperliquidNetwork,hyperliquidBuilderParam,normalizeHyperliquidMarkets,normalizeHyperliquidAllPerpMarkets} from '../hyperliquid-venue.js';

test('Hyperliquid network config is explicit',()=>{
 assert.equal(hyperliquidNetwork('mainnet').http,'https://api.hyperliquid.xyz');
 assert.equal(hyperliquidNetwork('testnet').ws,'wss://api.hyperliquid-testnet.xyz/ws');
 assert.throws(()=>hyperliquidNetwork('devnet'));
});
test('builder fee helper enforces documented caps',()=>{
 const a='0x1111111111111111111111111111111111111111';
 assert.deepEqual(hyperliquidBuilderParam(a,100,'perp'),{b:a,f:100});
 assert.throws(()=>hyperliquidBuilderParam(a,101,'perp'));
 assert.deepEqual(hyperliquidBuilderParam(a,1000,'spot'),{b:a,f:1000});
});
test('Hyperliquid perp metadata normalizes without delisted markets',()=>{
 const rows=normalizeHyperliquidMarkets({universe:[
  {name:'BTC',szDecimals:5,maxLeverage:50},
  {name:'OLD',szDecimals:2,maxLeverage:3,isDelisted:true}
 ]},'perp');
 assert.equal(rows.length,1);assert.equal(rows[0].symbol,'BTC');assert.equal(rows[0].maxLeverage,50);
});


test('all perp metadata includes native and HIP-3 markets with canonical asset ids',()=>{
 const perpDexs=[null,{name:'xyz',fullName:'XYZ Markets'}];
 const allMetas=[
  {collateralToken:0,universe:[{name:'BTC',szDecimals:5,maxLeverage:50}]},
  {collateralToken:0,universe:[{name:'xyz:NVDA',szDecimals:3,maxLeverage:10}]}
 ];
 const rows=normalizeHyperliquidAllPerpMarkets(allMetas,perpDexs);
 assert.equal(rows.length,2);
 assert.equal(rows[0].symbol,'BTC');
 assert.equal(rows[0].nativeId,0);
 assert.equal(rows[0].raw.dex,'');
 assert.equal(rows[1].symbol,'xyz:NVDA');
 assert.equal(rows[1].nativeId,110000);
 assert.equal(rows[1].raw.dex,'xyz');
 assert.equal(rows[1].raw.dexFullName,'XYZ Markets');
});
