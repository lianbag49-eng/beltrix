import test from 'node:test';import assert from 'node:assert/strict';
import {VENUES,venueById,whiteLabelCandidates,internalExecutionCandidates} from '../venue-registry.js';
import {bdMatrix} from '../bd-matrix.js';

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
