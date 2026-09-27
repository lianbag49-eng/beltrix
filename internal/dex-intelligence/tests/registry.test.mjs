import test from 'node:test';import assert from 'node:assert/strict';
import {VENUES,venueById,whiteLabelCandidates,internalExecutionCandidates} from '../venue-registry.js';
import {bdMatrix} from '../bd-matrix.js';
import {canonicalAsset,venueSymbol,marketRouting,SUPPORTED_CANONICAL_ASSETS} from '../market-normalizer.js';

test('public BELTRIX baseline is Hyperliquid',()=>{
 assert.equal(venueById('hyperliquid').role,'baseline');
 assert.equal(venueById('hyperliquid').executionCandidate,true);
});

test('white-label candidates are explicitly separated from the public UI',()=>{
 const ids=whiteLabelCandidates().map(x=>x.id);
 assert.ok(ids.includes('orderly'));assert.ok(ids.includes('gmx'));
});

test('registry contains named comparison venues',()=>{
 for(const id of ['hyperliquid','orderly','gmx','paradex','dydx','drift'])assert.ok(VENUES.some(x=>x.id===id));
 assert.ok(internalExecutionCandidates().length>=4);
 assert.equal(bdMatrix().length,VENUES.length);
});

test('asset-first routing maps one canonical market to venue symbols',()=>{
 assert.equal(canonicalAsset('PERP_BTC_USDC'),'BTC');
 assert.equal(canonicalAsset('XBT-USD'),'BTC');
 assert.equal(venueSymbol('BTC','hyperliquid'),'BTC');
 assert.equal(venueSymbol('BTC','orderly'),'PERP_BTC_USDC');
 assert.equal(venueSymbol('ETH','paradex'),'ETH-USD-PERP');
 assert.equal(marketRouting('SOL').symbols.dydx,'SOL-USD');
 assert.deepEqual(SUPPORTED_CANONICAL_ASSETS,['BTC','ETH','SOL']);
});
