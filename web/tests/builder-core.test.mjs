import test from 'node:test';import assert from 'node:assert/strict';
import {formatBuilderRate,validateBuilderConfig,requiredApprovalTenthsBp,builderForOrder} from '../builder-core.js';

const address='0x1111111111111111111111111111111111111111';

test('disabled builder config never attaches a fee',()=>{
 const c=validateBuilderConfig({enabled:false,address:'bad',perpFeeTenthsBp:1000});
 assert.equal(c.enabled,false);assert.equal(builderForOrder(c,{approvedTenthsBp:1000}),null);
});
test('builder rates follow Hyperliquid tenths-of-bp representation',()=>{
 assert.equal(formatBuilderRate(1),'0.001%');assert.equal(formatBuilderRate(10),'0.01%');assert.equal(formatBuilderRate(100),'0.1%');assert.equal(formatBuilderRate(1000),'1%');
});
test('approval and per-market builder fee are explicit',()=>{
 const c={enabled:true,address,perpFeeTenthsBp:10,spotFeeTenthsBp:20};
 assert.equal(requiredApprovalTenthsBp(c),20);
 assert.equal(builderForOrder(c,{spot:false,approvedTenthsBp:9}),null);
 assert.deepEqual(builderForOrder(c,{spot:false,approvedTenthsBp:10}),{b:address,f:10});
 assert.deepEqual(builderForOrder(c,{spot:true,approvedTenthsBp:20}),{b:address,f:20});
});
test('fee caps reject unsafe configuration',()=>{
 assert.throws(()=>validateBuilderConfig({enabled:true,address,perpFeeTenthsBp:101,spotFeeTenthsBp:0}));
 assert.throws(()=>validateBuilderConfig({enabled:true,address,perpFeeTenthsBp:0,spotFeeTenthsBp:1001}));
});
