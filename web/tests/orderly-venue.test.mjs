import test from 'node:test';import assert from 'node:assert/strict';
import {ORDERLY_MARKETS_PATH,normalizeOrderlyMarkets} from '../orderly-venue.js';

test('Orderly POC uses public market information endpoint',()=>assert.equal(ORDERLY_MARKETS_PATH,'/v1/public/info'));
test('Orderly market rows normalize to BELTRIX venue shape',()=>{
 const rows=normalizeOrderlyMarkets({data:{rows:[
  {symbol:'PERP_BTC_USDC',quote_tick:0.1,base_min:0.001,max_leverage:20},
  {symbol:'SPOT_ETH_USDC'}
 ]}});
 assert.equal(rows.length,1);assert.equal(rows[0].base,'BTC');assert.equal(rows[0].quote,'USDC');assert.equal(rows[0].venue,'orderly');
});
