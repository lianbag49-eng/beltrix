import test from 'node:test';import assert from 'node:assert/strict';
import {BOOTSTRAP_MARKETS} from '../market-registry.js';
import {buildBeltrixHip3Plan} from '../hip3-plan.js';

const btc=BOOTSTRAP_MARKETS.find(x=>x.id==='BTC-PERP');

test('HIP-3 plan preserves BELTRIX-owned market oracle and risk policy',()=>{
 const plan=buildBeltrixHip3Plan({
  market:btc,
  dexName:'beltrix',
  feeRecipient:'0x1111111111111111111111111111111111111111',
  oracleUpdater:'0x2222222222222222222222222222222222222222',
  marginTableId:1,
  openInterestCapUsd:5000000,
  fundingMultiplier:1,
  annotation:'BELTRIX BTC perpetual',
  roleGrants:[
   {role:'oracle-updater',account:'0x2222222222222222222222222222222222222222'},
   {role:'emergency-guardian',account:'0x3333333333333333333333333333333333333333'}
  ],
  szDecimals:5
 });
 assert.equal(plan.mode,'hip3-hybrid');
 assert.equal(plan.researchOnly,true);
 assert.equal(plan.executionEnabled,false);
 assert.ok(plan.beltrixOwnedLayers.includes('risk-policy'));
 assert.ok(plan.inheritedLayers.includes('matching'));
 assert.ok(plan.operations.some(x=>x.variant==='setOracle'));
 assert.ok(plan.operations.some(x=>x.variant==='setOpenInterestCaps'));
 assert.ok(plan.operations.some(x=>x.variant==='setSubDeployers'));
 assert.ok(plan.operations.every(x=>x.unsigned&&x.requiresHumanReview));
});

test('HIP-3 plan rejects leverage outside Hyperliquid deployer range',()=>{
 const market={...btc,riskPolicy:{...btc.riskPolicy,maxLeverage:75}};
 assert.throws(()=>buildBeltrixHip3Plan({
  market,dexName:'beltrix',feeRecipient:'0x1111111111111111111111111111111111111111',oracleUpdater:'0x2222222222222222222222222222222222222222',marginTableId:1,openInterestCapUsd:1000000
 }),/max leverage must be 1-50/);
});

test('HIP-3 plan is not represented as a broadcast payload',()=>{
 const plan=buildBeltrixHip3Plan({
  market:btc,dexName:'beltrix',feeRecipient:'0x1111111111111111111111111111111111111111',oracleUpdater:'0x2222222222222222222222222222222222222222',marginTableId:1,openInterestCapUsd:1000000
 });
 assert.equal(plan.researchOnly,true);
 assert.match(plan.warnings[0],/unsigned deployment plan/i);
});
