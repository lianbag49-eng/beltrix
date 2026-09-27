import test from 'node:test';import assert from 'node:assert/strict';
import {bookMetrics,depthUsdWithinBps,simulateMarketOrder,liquiditySnapshot,estimateExecutionCost,bookHealth} from '../liquidity.js';

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
 assert.equal(book.receivedAt,1000);
 assert.equal(book.crossed,false);
});

test('depth inside 25 bps is additive USD depth',()=>{
 const d=depthUsdWithinBps(book,25);
 assert.equal(d.bid,2995);
 assert.equal(d.ask,3005);
 assert.equal(d.total,6000);
});

test('market impact reports partial fills rather than invented liquidity',()=>{
 const x=simulateMarketOrder(book,{side:'buy',notionalUsd:5000});
 assert.ok(x.fillRatio>0&&x.fillRatio<1);
 assert.ok(x.avgPrice>100);
});

test('effective execution cost only appears when fee input is explicit',()=>{
 const noFee=estimateExecutionCost(book,{side:'buy',notionalUsd:1000});
 assert.equal(noFee.effectiveCostBps,null);
 const withFee=estimateExecutionCost(book,{side:'buy',notionalUsd:1000,feeBps:4});
 assert.ok(withFee.marketImpactBps>0);
 assert.ok(withFee.effectiveCostBps>withFee.marketImpactBps);
 assert.equal(withFee.effectiveCostBps,withFee.marketImpactBps+4);
});

test('book health catches stale or insufficient books',()=>{
 assert.equal(bookHealth(book,{now:1500,notionalUsd:1000,maxStaleMs:1000}).status,'healthy');
 const stale=bookHealth(book,{now:5000,notionalUsd:1000,maxStaleMs:1000});
 assert.equal(stale.status,'degraded');
 assert.ok(stale.reasons.includes('stale'));
});

test('snapshot includes standard comparison bands and notionals',()=>{
 const s=liquiditySnapshot({bids:book.bids,asks:book.asks});
 assert.ok(s.depth[10]);assert.ok(s.depth[25]);assert.ok(s.depth[50]);
 assert.ok(s.impact[1000]);assert.ok(s.impact[100000]);
});
