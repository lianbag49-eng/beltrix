import test from 'node:test';import assert from 'node:assert/strict';
import {oracleConsensus} from '../oracle.js';
import {defineRiskPolicy,assessIntentRisk} from '../risk.js';

test('oracle consensus uses independent fresh sources and median',()=>{
 const o=oracleConsensus([
  {source:'a',price:100,timestamp:1000},
  {source:'b',price:101,timestamp:1000},
  {source:'c',price:99,timestamp:1000}
 ],{now:1100,minSources:2,maxAgeMs:500,maxDeviationBps:200});
 assert.equal(o.ok,true);
 assert.equal(o.price,100);
 assert.equal(o.sources.length,3);
});

test('oracle deviation halts validation',()=>{
 const o=oracleConsensus([
  {source:'a',price:100,timestamp:1000},
  {source:'b',price:150,timestamp:1000}
 ],{now:1100,minSources:2,maxAgeMs:500,maxDeviationBps:100});
 assert.equal(o.ok,false);
 assert.ok(o.reasons.includes('oracle-deviation'));
});

test('risk engine enforces leverage notional OI and halt rules',()=>{
 const policy=defineRiskPolicy({maxLeverage:10,maxOrderNotionalUsd:1000,maxOpenInterestUsd:5000});
 const oracle={ok:true,price:100};
 const r=assessIntentRisk({size:20,leverage:20},{policy,oracle,marketState:{openInterestUsd:4500,halted:true}});
 assert.equal(r.allowed,false);
 assert.ok(r.reasons.includes('order-notional-cap'));
 assert.ok(r.reasons.includes('leverage-cap'));
 assert.ok(r.reasons.includes('open-interest-cap'));
 assert.ok(r.reasons.includes('market-halted'));
});
