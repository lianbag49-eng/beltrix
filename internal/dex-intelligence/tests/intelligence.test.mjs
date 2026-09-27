import test from 'node:test';import assert from 'node:assert/strict';
import {buildMarketIntelligence,venueIntelligenceRow} from '../market-intelligence.js';

const clob={
 venue:'orderly',
 ok:true,
 snapshot:{book:{spreadBps:2,staleMs:100},depth:{25:{total:250000}}},
 buy:{fillRatio:1,marketImpactBps:1.2},
 sell:{fillRatio:0.998,marketImpactBps:1.1},
 health:{status:'healthy',reasons:[]}
};

test('market intelligence preserves descriptive CLOB telemetry',()=>{
 const row=venueIntelligenceRow(clob);
 assert.equal(row.venue,'orderly');
 assert.equal(row.model,'clob');
 assert.equal(row.depth25Usd,250000);
 assert.equal(row.minFillRatio,0.998);
 assert.equal(row.executionQualified,false);
 assert.ok(row.flags.includes('research-only'));
});

test('GMX intelligence exposes capacity without inventing orderbook metrics',()=>{
 const gmx={
  venue:'gmx',ok:true,
  capacity:{
   long:{availableLiquidityUsd:1000000,jitDataStatus:'available',marketDataStatus:'available'},
   short:{availableLiquidityUsd:900000,jitDataStatus:'stale',marketDataStatus:'available'}
  }
 };
 const row=venueIntelligenceRow(null,{gmxState:gmx});
 assert.equal(row.model,'oracle-pool');
 assert.equal(row.spreadBps,null);
 assert.equal(row.capacityLongUsd,1000000);
 assert.ok(row.flags.includes('model-specific'));
 assert.ok(row.flags.includes('stale'));
});

test('summary counts operational state without ranking venues',()=>{
 const out=buildMarketIntelligence({
  bookRows:[clob,{venue:'paradex',ok:false,health:{status:'unavailable'},snapshot:null,buy:null,sell:null}],
  gmxState:{venue:'gmx',ok:true,capacity:{long:null,short:null}}
 });
 assert.equal(out.summary.venues,3);
 assert.equal(out.summary.live,2);
 assert.equal(out.summary.unavailable,1);
 assert.equal(out.summary.executionQualified,0);
 assert.equal(out.summary.researchOnly,3);
});
