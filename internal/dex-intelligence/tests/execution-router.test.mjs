import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTradeIntent,buildExecutionPlan,executionAdapterInventory} from '../execution-router.js';

test('trade intent validates venue-independent order fields',()=>{
 const x=normalizeTradeIntent({asset:'btc',side:'BUY',notionalUsd:10000,orderType:'market',maxSlippageBps:15});
 assert.equal(x.valid,true);
 assert.equal(x.asset,'BTC');
 assert.equal(x.side,'buy');
});

test('invalid trade intent fails closed',()=>{
 const x=normalizeTradeIntent({asset:'',side:'up',notionalUsd:-1});
 assert.equal(x.valid,false);
 assert.ok(x.errors.length>=3);
});

test('execution plan only uses internally qualified live venues',()=>{
 const out=buildExecutionPlan({
  asset:'BTC',side:'buy',notionalUsd:10000,preferredVenues:['orderly']
 },{
  venueStates:{
   hyperliquid:{ok:true,health:'healthy',buyEffectiveCostBps:2},
   orderly:{ok:true,health:'healthy',buyEffectiveCostBps:1}
  }
 });
 assert.equal(out.status,'ready');
 assert.equal(out.route.venue,'hyperliquid');
 assert.equal(out.executionMode,'plan-only');
 assert.equal(out.candidates.some(x=>x.venue==='orderly'),false);
});

test('unavailable qualified venue blocks route instead of falling back to research-only',()=>{
 const out=buildExecutionPlan({asset:'ETH',side:'sell',notionalUsd:5000},{venueStates:{hyperliquid:{ok:false,health:'unavailable'},orderly:{ok:true,health:'healthy'}}});
 assert.equal(out.status,'blocked');
 assert.equal(out.route,null);
});

test('adapter inventory exposes research-only venues explicitly',()=>{
 const rows=executionAdapterInventory();
 assert.equal(rows.find(x=>x.venue==='hyperliquid').mode,'execution');
 assert.equal(rows.find(x=>x.venue==='gmx').mode,'research-only');
});
