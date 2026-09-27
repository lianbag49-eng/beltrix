import test from 'node:test';import assert from 'node:assert/strict';
import {BD_PIPELINE,validStage,pipelineCounts} from '../bd-crm.js';
import {tradingCostScenario,effectiveTradeCostBps} from '../economics.js';
import {bookMetrics,estimateMarketImpact} from '../liquidity.js';
import {WHITE_LABEL_MATRIX,whiteLabelFor} from '../white-label.js';

test('BD pipeline contains Aster and uses known stages',()=>{
 assert.ok(BD_PIPELINE.some(x=>x.venue==='aster'));
 for(const row of BD_PIPELINE)assert.equal(validStage(row.stage),true);
 assert.equal(pipelineCounts().approved,1);
});

test('generic venue economics keeps revenue assumptions explicit',()=>{
 const r=tradingCostScenario({
  monthlyVolumeUsd:10_000_000,takerShare:0.6,userMakerBps:2,userTakerBps:5,
  protocolMakerBps:1,protocolTakerBps:3,affiliateSharePct:10,userDiscountPct:5,fixedMonthlyCostUsd:1000
 });
 assert.equal(r.makerVolume,4_000_000);
 assert.equal(r.takerVolume,6_000_000);
 assert.ok(r.grossUserFees>r.protocolCost);
 assert.ok(Number.isFinite(r.net));
 assert.equal(effectiveTradeCostBps({feeBps:4,spreadBps:1,impactBps:2,executionBps:.5,fundingBps:1,bridgeBps:.5}),9);
});

test('liquidity metrics use comparable bps buckets and orderbook notional',()=>{
 const book={bids:[[100,2],[99.9,5]],asks:[[100.1,3],[100.2,4]]};
 const m=bookMetrics(book,{depthBps:[25]});
 assert.ok(m.spreadBps>0);
 assert.ok(m.depth[25].bidUsd>0);
 assert.ok(m.depth[25].askUsd>0);
 const impact=estimateMarketImpact(book,'buy',500);
 assert.equal(impact.complete,true);assert.ok(impact.avgPrice>=100.1);
});

test('white-label matrix keeps Orderly turnkey and public BELTRIX on Hyperliquid',()=>{
 assert.equal(whiteLabelFor('orderly').turnkey,true);
 assert.equal(whiteLabelFor('hyperliquid').role,'Primary BELTRIX product');
 assert.equal(WHITE_LABEL_MATRIX.some(x=>x.venue==='aster'),true);
});
