import test from 'node:test';import assert from 'node:assert/strict';
import {hyperliquidNetwork,hyperliquidBuilderParam,normalizeHyperliquidMarkets} from '../hyperliquid-venue.js';

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
