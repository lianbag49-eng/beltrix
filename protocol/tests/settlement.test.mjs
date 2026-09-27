import test from 'node:test';import assert from 'node:assert/strict';
import {SettlementRegistry,SETTLEMENT_CAPABILITIES} from '../settlement.js';
import {hyperliquidSettlement,prepareHyperliquidIntent} from '../hyperliquid-settlement.js';
import {beltrixNativeSettlement,BELTRIX_NATIVE_REQUIREMENTS} from '../native-settlement.js';

test('Hyperliquid adapter prepares unsigned user-signed IOC semantics',()=>{
 const out=prepareHyperliquidIntent({
  account:'0xabc',market:'BTC-PERP',side:'buy',size:1,orderType:'market',
  reduceOnly:false,expiry:2000,nonce:1
 },{
  now:1000,settlementMarket:{assetId:0},marketOrderPrice:'101'
 });
 assert.equal(out.unsigned,true);
 assert.equal(out.requiresUserSignature,true);
 assert.equal(out.order.p,'101');
 assert.equal(out.order.t.limit.tif,'Ioc');
 assert.equal(out.executionSemantics,'aggressive-ioc-limit');
});

test('Hyperliquid market intent requires explicit IOC price',()=>{
 assert.throws(()=>prepareHyperliquidIntent({
  account:'a',market:'BTC-PERP',side:'buy',size:1,orderType:'market',expiry:2000,nonce:1
 },{now:1000,settlementMarket:{assetId:0}}),/positive settlement price/);
});

test('settlement registry separates live bootstrap and native research',()=>{
 const r=new SettlementRegistry();
 r.register(hyperliquidSettlement);r.register(beltrixNativeSettlement);
 assert.equal(r.available({status:'live',capabilities:[SETTLEMENT_CAPABILITIES.NON_CUSTODIAL]}).length,1);
 assert.equal(r.get('beltrix-native').status,'research');
 assert.ok(BELTRIX_NATIVE_REQUIREMENTS.includes('liquidation-engine'));
 assert.throws(()=>r.get('beltrix-native').prepareIntent(),/research-only/);
});
