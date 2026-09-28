import test from 'node:test';
import assert from 'node:assert/strict';
import {marketDefinition,marketRegistrySnapshot} from '../market-registry.js';
import {evaluateOracleObservations} from '../oracle-policy.js';
import {evaluateRiskEnvelope} from '../risk-engine.js';
import {protocolArchitectureSnapshot} from '../protocol-core.js';

test('market registry keeps canonical venue mappings behind BELTRIX market ids',()=>{
 const btc=marketDefinition('BTC');
 assert.equal(btc.id,'BELTRIX-BTC-PERP');
 assert.equal(btc.symbols.hyperliquid,'BTC');
 assert.equal(btc.bootstrapSettlement,'hyperliquid');
 assert.equal(marketRegistrySnapshot().length>=3,true);
});

test('oracle policy requires fresh quorum and bounded deviation',()=>{
 const now=100000;
 const ok=evaluateOracleObservations([
  {source:'a',price:100,timestamp:now-1000},
  {source:'b',price:100.2,timestamp:now-1000}
 ],{now,policy:{minSources:2,maxAgeMs:30000,maxDeviationBps:100}});
 assert.equal(ok.status,'valid');

 const insufficient=evaluateOracleObservations([{source:'a',price:100,timestamp:now-1000}],{now});
 assert.equal(insufficient.status,'blocked');
});

test('risk engine refuses to invent market limits',()=>{
 const blocked=evaluateRiskEnvelope({notionalUsd:10000,equityUsd:1000});
 assert.equal(blocked.status,'blocked');
 assert.ok(blocked.reasons.includes('market_limits_required'));

 const accepted=evaluateRiskEnvelope({notionalUsd:10000,equityUsd:2000},{maxLeverage:10,maxNotionalUsd:20000,minEquityUsd:500});
 assert.equal(accepted.status,'accepted');
 assert.equal(accepted.leverage,5);
});

test('protocol snapshot separates bootstrap settlement from native settlement',()=>{
 const snap=protocolArchitectureSnapshot();
 assert.equal(snap.nativeSettlementStatus,'not-enabled');
 assert.equal(snap.bootstrapSettlement,'hyperliquid');
 assert.ok(snap.layers.some(x=>x.id==='execution-router'));
 assert.ok(snap.settlementAdapters.some(x=>x.id==='hyperliquid'&&x.status==='bootstrap-active'));
});
