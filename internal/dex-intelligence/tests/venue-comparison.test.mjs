import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVenueComparison} from '../venue-comparison.js';

test('venue comparison preserves model-specific fields without fake CLOB data',()=>{
 const snapshot={asset:'BTC',timestamp:1,venues:{
  hyperliquid:{ok:true,health:'healthy',latencyMs:100,spreadBps:1,depth25Usd:500000,metric:{fundingRate:0.0001,openInterestUsd:1000000,volume24hUsd:2000000}},
  gmx:{ok:true,health:'healthy',latencyMs:200,capacityLongUsd:900000,capacityShortUsd:800000,metric:{}}
 }};
 const rows=buildVenueComparison({
  asset:'BTC',latestSnapshot:snapshot,history:[snapshot],
  intelligenceRows:[
   {venue:'hyperliquid',dataStatus:'healthy',spreadBps:1,depth25Usd:500000,minFillRatio:1},
   {venue:'gmx',dataStatus:'live',capacityLongUsd:900000,capacityShortUsd:800000}
  ]
 });
 const hl=rows.find(x=>x.venue==='hyperliquid');
 const gmx=rows.find(x=>x.venue==='gmx');
 assert.equal(hl.spreadBps,1);
 assert.equal(hl.availabilityRatio,1);
 assert.equal(gmx.marketModel,'oracle-liquidity-pool');
 assert.equal(gmx.capacityLongUsd,900000);
 assert.equal(gmx.spreadBps,null);
});

test('comparison exposes execution gates instead of implying execution support',()=>{
 const rows=buildVenueComparison({asset:'ETH'});
 assert.equal(rows.find(x=>x.venue==='hyperliquid').executionQualified,true);
 assert.equal(rows.find(x=>x.venue==='orderly').executionQualified,false);
 assert.ok(rows.find(x=>x.venue==='orderly').missingExecutionGates.length>0);
});
