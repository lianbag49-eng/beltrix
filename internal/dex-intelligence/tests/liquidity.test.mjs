import test from 'node:test';import assert from 'node:assert/strict';
import {bookMetrics,depthUsdWithinBps,simulateMarketOrder,liquiditySnapshot} from '../liquidity.js';

const book=bookMetrics({
 bids:[['99.9','10'],['99.8','20']],
 asks:[['100.1','10'],['100.2','20']],
 receivedAt:1000,
 now:1500
});

test('spread and freshness are normalized',()=>{
 assert.equal(book.mid,100);
 assert.ok(Math.abs(book.spreadBps-20)<1e-9);
 assert.equal(book.staleMs,500);
 assert.equal(book.crossed,false);
});

test('depth inside 25 bps is additive USD depth',()=>{
 const d=depthUsdWithinBps(book,25);
 assert.equal(d.bid,999);
 assert.equal(d.ask,1001);
 assert.equal(d.total,2000);
});

test('market impact reports partial fills rather than invented liquidity',()=>{
 const x=simulateMarketOrder(book,{side:'buy',notionalUsd:5000});
 assert.ok(x.fillRatio>0&&x.fillRatio<1);
 assert.ok(x.avgPrice>100);
});

test('snapshot includes standard comparison bands and notionals',()=>{
 const s=liquiditySnapshot({bids:book.bids,asks:book.asks});
 assert.ok(s.depth[10]);assert.ok(s.depth[25]);assert.ok(s.depth[50]);
 assert.ok(s.impact[1000]);assert.ok(s.impact[100000]);
});
