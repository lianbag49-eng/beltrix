import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalTradeIntent,validateIntentFreshness,intentSigningEnvelope} from '../intent.js';

test('trade intent is venue-neutral and bounded',()=>{
 const i=canonicalTradeIntent({
  account:'0xabc',market:'btc-perp',side:'buy',size:'0.5',orderType:'market',
  leverage:10,maxSlippageBps:25,expiry:2000,nonce:1,settlementPreferences:['hyperliquid','hyperliquid']
 });
 assert.equal(i.market,'BTC-PERP');
 assert.equal(i.side,'buy');
 assert.equal(i.size,0.5);
 assert.deepEqual(i.settlementPreferences,['hyperliquid']);
 assert.equal(i.limitPrice,null);
});

test('expired trade intent is rejected',()=>{
 const i=canonicalTradeIntent({account:'a',market:'BTC-PERP',side:'sell',size:1,expiry:1000,nonce:0});
 assert.throws(()=>validateIntentFreshness(i,1000),/expired/);
});

test('signing envelope identifies BELTRIX protocol rather than a venue',()=>{
 const env=intentSigningEnvelope({account:'a',market:'ETH-PERP',side:'buy',size:1,expiry:5000,nonce:2});
 assert.equal(env.domain.name,'BELTRIX Protocol');
 assert.equal(env.intent.protocol,'beltrix');
});
