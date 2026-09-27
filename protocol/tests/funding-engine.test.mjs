import test from 'node:test';import assert from 'node:assert/strict';
import {defineFundingPolicy,clampFundingRate,fundingCashflow,applyFunding,fundingEvent} from '../funding-engine.js';
import {defineIsolatedPosition} from '../margin-model.js';

const long=defineIsolatedPosition({side:'long',size:10,entryPrice:100,collateral:200});
const short=defineIsolatedPosition({side:'short',size:10,entryPrice:100,collateral:200});
const policy=defineFundingPolicy({intervalMs:3600000,maxAbsRate:0.01});

test('positive funding makes longs pay and shorts receive',()=>{
 assert.equal(fundingCashflow(long,100,0.001,policy),-1);
 assert.equal(fundingCashflow(short,100,0.001,policy),1);
});

test('funding rate is capped by policy',()=>{
 assert.equal(clampFundingRate(0.5,policy),0.01);
 assert.equal(clampFundingRate(-0.5,policy),-0.01);
});

test('funding accumulates into isolated position equity state',()=>{
 const after=applyFunding(long,100,0.001,policy);
 assert.equal(after.realizedFunding,-1);
 const after2=applyFunding(after,100,-0.001,policy);
 assert.equal(after2.realizedFunding,0);
});

test('funding event records requested and applied rates',()=>{
 const e=fundingEvent({position:long,oraclePrice:100,rate:0.02,intervalStart:1000,policy});
 assert.equal(e.requestedRate,0.02);
 assert.equal(e.appliedRate,0.01);
 assert.equal(e.cashflow,-10);
});
