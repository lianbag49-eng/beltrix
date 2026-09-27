import test from 'node:test';import assert from 'node:assert/strict';
import {createBootstrapProtocol} from '../bootstrap.js';
import {prepareBeltrixTrade} from '../core.js';

const obs=[
 {source:'oracle-a',price:100,timestamp:1000},
 {source:'oracle-b',price:100.5,timestamp:1000}
];

test('BELTRIX core validates intent oracle and risk before settlement',()=>{
 const protocol=createBootstrapProtocol();
 const out=prepareBeltrixTrade({
  intent:{
   account:'0xabc',market:'BTC-PERP',side:'buy',size:1,orderType:'market',
   leverage:5,expiry:5000,nonce:1,settlementPreferences:['hyperliquid']
  },
  marketRegistry:protocol.markets,
  settlementRegistry:protocol.settlements,
  oracleObservations:obs,
  marketState:{openInterestUsd:1000},
  settlementContextById:{hyperliquid:{settlementMarket:{assetId:0},marketOrderPrice:'101'}},
  now:1100
 });
 assert.equal(out.ok,true);
 assert.equal(out.settlement.id,'hyperliquid');
 assert.equal(out.prepared.unsigned,true);
 assert.equal(out.market.id,'BTC-PERP');
});

test('BELTRIX core blocks unsafe oracle before settlement adapter',()=>{
 const protocol=createBootstrapProtocol();
 const out=prepareBeltrixTrade({
  intent:{account:'a',market:'BTC-PERP',side:'buy',size:1,expiry:5000,nonce:1,settlementPreferences:['hyperliquid']},
  marketRegistry:protocol.markets,
  settlementRegistry:protocol.settlements,
  oracleObservations:[{source:'only-one',price:100,timestamp:1000}],
  settlementContextById:{hyperliquid:{settlementMarket:{assetId:0},marketOrderPrice:'101'}},
  now:1100
 });
 assert.equal(out.ok,false);
 assert.equal(out.prepared,null);
 assert.ok(out.reasons.includes('insufficient-fresh-sources'));
});

test('research-only native settlement cannot be silently selected',()=>{
 const protocol=createBootstrapProtocol();
 assert.throws(()=>prepareBeltrixTrade({
  intent:{account:'a',market:'ETH-PERP',side:'buy',size:1,expiry:5000,nonce:1,settlementPreferences:['beltrix-native']},
  marketRegistry:protocol.markets,
  settlementRegistry:protocol.settlements,
  oracleObservations:obs,
  now:1100
 }),/No user-permitted live settlement/);
});
