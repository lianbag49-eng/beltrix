import test from 'node:test';import assert from 'node:assert/strict';
import {defineIsolatedPosition,defineMarginPolicy} from '../margin-model.js';
import {generatePriceShockGrid,stressPosition} from '../risk-stress.js';

const policy=defineMarginPolicy({initialMarginRatio:0.1,maintenanceMarginRatio:0.05,liquidationFeeBps:50,maxLeverage:10});

test('stress grid spans symmetric shock range',()=>{
 const grid=generatePriceShockGrid(100,{downPct:0.5,upPct:0.5,steps:5});
 assert.deepEqual(grid,[50,75,100,125,150]);
});

test('long stress simulation finds liquidation region',()=>{
 const p=defineIsolatedPosition({side:'long',size:10,entryPrice:100,collateral:200});
 const out=stressPosition(p,{policy,prices:[100,90,85,84,80],insuranceBalance:100});
 assert.equal(out.firstLiquidation.price,84);
 assert.equal(out.anyResidualDeficit,false);
});

test('stress simulation flags residual bad debt when insurance is insufficient',()=>{
 const p=defineIsolatedPosition({side:'long',size:10,entryPrice:100,collateral:200});
 const out=stressPosition(p,{policy,prices:[80],insuranceBalance:0});
 assert.equal(out.anyResidualDeficit,true);
 assert.ok(out.rows[0].residualDeficit>0);
});
