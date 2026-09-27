import test from 'node:test';import assert from 'node:assert/strict';
import {decentralizationState,CURRENT_DECENTRALIZATION_STATE} from '../decentralization.js';
import {BELTRIX_PROTOCOL} from '../manifest.js';
import {BOOTSTRAP_MARKETS,ProtocolMarketRegistry} from '../market-registry.js';

test('current state is explicitly bootstrap rather than falsely native',()=>{
 assert.equal(CURRENT_DECENTRALIZATION_STATE.stage,'bootstrap');
 assert.ok(CURRENT_DECENTRALIZATION_STATE.satisfied.includes('user-custody'));
 assert.ok(CURRENT_DECENTRALIZATION_STATE.missing.includes('beltrix-native-state'));
 assert.equal(BELTRIX_PROTOCOL.nativeSettlementStatus,'research');
});

test('hybrid and native maturity require concrete components',()=>{
 const hybrid=decentralizationState({
  'user-custody':true,'user-signed-orders':true,'open-market-registry':true,
  'independent-oracle-policy':true,'protocol-risk-policy':true,'multi-party-governance':true
 });
 assert.equal(hybrid.stage,'hybrid');
 const native=decentralizationState(Object.fromEntries([
  'user-custody','user-signed-orders','open-market-registry','independent-oracle-policy',
  'protocol-risk-policy','multi-party-governance','permissionless-settlement','beltrix-native-state'
 ].map(x=>[x,true])));
 assert.equal(native.stage,'native');
});

test('bootstrap registry carries BELTRIX market definitions independent of settlement ids',()=>{
 const r=new ProtocolMarketRegistry();
 for(const m of BOOTSTRAP_MARKETS)r.register(m);
 assert.equal(r.active().length,3);
 assert.deepEqual(r.get('BTC-PERP').settlementIds,['hyperliquid','beltrix-native']);
 assert.equal(r.get('BTC-PERP').metadata.nativeSettlementEnabled,false);
});
