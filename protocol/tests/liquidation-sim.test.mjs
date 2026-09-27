import test from 'node:test';import assert from 'node:assert/strict';
import {defineIsolatedPosition,defineMarginPolicy} from '../margin-model.js';
import {simulateLiquidation,liquidationDecision} from '../liquidation-sim.js';

const policy=defineMarginPolicy({initialMarginRatio:0.1,maintenanceMarginRatio:0.05,liquidationFeeBps:50,maxLeverage:10});
const p=defineIsolatedPosition({side:'long',size:10,entryPrice:100,collateral:200});

test('healthy position does not trigger liquidation',()=>{
 const out=simulateLiquidation(p,90,policy,100);
 assert.equal(out.triggered,false);
 assert.equal(out.deficit,0);
});

test('liquidation uses insurance only for uncovered fee/equity deficit',()=>{
 const out=simulateLiquidation(p,80,policy,3);
 assert.equal(out.triggered,true);
 assert.equal(out.closeNotional,800);
 assert.equal(out.liquidationFee,4);
 assert.equal(out.equityBefore,0);
 assert.equal(out.deficit,4);
 assert.equal(out.insuranceDraw,3);
 assert.equal(out.residualDeficit,1);
});

test('liquidation decision exposes maintenance breach only',()=>{
 const out=liquidationDecision(p,84,policy);
 assert.equal(out.shouldLiquidate,true);
 assert.deepEqual(out.reasons,['maintenance-margin-breach']);
});
