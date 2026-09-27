import test from 'node:test';import assert from 'node:assert/strict';
import {defineMarginPolicy,defineIsolatedPosition,positionLeverage,unrealizedPnl,positionEquity,liquidationPrice,marginHealth,validateOpeningPosition} from '../margin-model.js';

const policy=defineMarginPolicy({initialMarginRatio:0.1,maintenanceMarginRatio:0.05,liquidationFeeBps:50,maxLeverage:10});

test('isolated long margin and liquidation price are internally consistent',()=>{
 const p=defineIsolatedPosition({side:'long',size:10,entryPrice:100,collateral:200});
 assert.equal(positionLeverage(p),5);
 assert.equal(unrealizedPnl(p,110),100);
 assert.equal(positionEquity(p,110),300);
 assert.ok(Math.abs(liquidationPrice(p,policy)-84.21052631578948)<1e-9);
 assert.equal(marginHealth(p,85,policy).liquidatable,false);
 assert.equal(marginHealth(p,84,policy).liquidatable,true);
});

test('isolated short liquidation price moves above entry',()=>{
 const p=defineIsolatedPosition({side:'short',size:10,entryPrice:100,collateral:200});
 assert.equal(unrealizedPnl(p,90),100);
 assert.ok(Math.abs(liquidationPrice(p,policy)-114.28571428571429)<1e-9);
 assert.equal(marginHealth(p,114,policy).liquidatable,false);
 assert.equal(marginHealth(p,115,policy).liquidatable,true);
});

test('opening validation enforces initial margin and max leverage',()=>{
 const good=defineIsolatedPosition({side:'long',size:10,entryPrice:100,collateral:200});
 assert.equal(validateOpeningPosition(good,policy).allowed,true);
 const bad=defineIsolatedPosition({side:'long',size:20,entryPrice:100,collateral:100});
 const out=validateOpeningPosition(bad,policy);
 assert.equal(out.allowed,false);
 assert.ok(out.reasons.includes('max-leverage'));
 assert.ok(out.reasons.includes('initial-margin'));
});

test('margin policy rejects maintenance above initial margin',()=>{
 assert.throws(()=>defineMarginPolicy({initialMarginRatio:0.05,maintenanceMarginRatio:0.06}),/maintenanceMarginRatio/);
});
