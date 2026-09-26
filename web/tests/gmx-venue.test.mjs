import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeGmxMarkets} from '../gmx-venue.js';

test('GMX market rows normalize to BELTRIX venue shape',()=>{
 const rows=normalizeGmxMarkets({markets:[{symbol:'BTC/USD',baseSymbol:'BTC',quoteSymbol:'USDC',maxLeverage:50,marketTokenAddress:'0x1'}]});
 assert.equal(rows.length,1);
 assert.equal(rows[0].venue,'gmx');
 assert.equal(rows[0].base,'BTC');
 assert.equal(rows[0].marketType,'perp');
});
