import test from 'node:test';import assert from 'node:assert/strict';
import {venueTrendSeries,seriesStats,TREND_METRICS} from '../trend-series.js';

const history=[
 {asset:'BTC',timestamp:1000,venues:{hyperliquid:{latencyMs:10,spreadBps:2,depth25Usd:1000,metric:{fundingRate:0.001,openInterestUsd:10000,volume24hUsd:50000}}}},
 {asset:'ETH',timestamp:1500,venues:{hyperliquid:{latencyMs:99,metric:{fundingRate:9}}}},
 {asset:'BTC',timestamp:2000,venues:{hyperliquid:{latencyMs:30,spreadBps:3,depth25Usd:1500,metric:{fundingRate:0.002,openInterestUsd:12000,volume24hUsd:60000}}}}
];

test('trend series filters by asset venue and metric',()=>{
 const s=venueTrendSeries(history,{asset:'BTC',venue:'hyperliquid',metric:'funding'});
 assert.equal(s.points.length,2);
 assert.equal(s.points[0].value,0.1);
 assert.equal(s.points[1].value,0.2);
 assert.equal(s.unit,'%');
});

test('trend stats keep first last min max change',()=>{
 const s=venueTrendSeries(history,{asset:'BTC',venue:'hyperliquid',metric:'latency'});
 const stats=seriesStats(s);
 assert.equal(stats.count,2);
 assert.equal(stats.min,10);
 assert.equal(stats.max,30);
 assert.equal(stats.change,20);
});

test('unknown metric is rejected',()=>{
 assert.throws(()=>venueTrendSeries(history,{asset:'BTC',venue:'hyperliquid',metric:'nope'}),/Unknown trend metric/);
 assert.ok(TREND_METRICS.depth25);
});
