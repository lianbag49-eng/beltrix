import test from 'node:test';import assert from 'node:assert/strict';
import {BOOTSTRAP_MARKETS} from '../market-registry.js';
import {buildBeltrixHip3Plan} from '../hip3-plan.js';
import {buildHip3TestnetDryRun,HIP3_TESTNET_CHECKS} from '../hip3-testnet.js';

const FEE='0x1111111111111111111111111111111111111111';
const ORACLE='0x2222222222222222222222222222222222222222';

test('HIP-3 testnet dry-run never enables broadcast',()=>{
 const market=BOOTSTRAP_MARKETS.find(x=>x.id==='BTC-PERP');
 const plan=buildBeltrixHip3Plan({
  market,dexName:'beltrix',feeRecipient:FEE,oracleUpdater:ORACLE,marginTableId:1,openInterestCapUsd:1000000
 });
 const evidence=Object.fromEntries(HIP3_TESTNET_CHECKS.map(x=>[x,true]));
 const out=buildHip3TestnetDryRun(plan,{evidence});
 assert.equal(out.readyForManualTestnetReview,true);
 assert.equal(out.broadcastEnabled,false);
 assert.ok(out.operationPreview.every(x=>x.broadcast===false));
});

test('HIP-3 dry-run stays blocked when operational review is incomplete',()=>{
 const market=BOOTSTRAP_MARKETS.find(x=>x.id==='ETH-PERP');
 const plan=buildBeltrixHip3Plan({
  market,dexName:'beltrix',feeRecipient:FEE,oracleUpdater:ORACLE,marginTableId:1,openInterestCapUsd:1000000
 });
 const out=buildHip3TestnetDryRun(plan);
 assert.equal(out.readyForManualTestnetReview,false);
 assert.ok(out.missing.includes('operator-addresses-reviewed'));
});
