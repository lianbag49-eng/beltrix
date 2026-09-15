import test from 'node:test';
import assert from 'node:assert/strict';
import {guardedWallet} from '../signing-guard.js';
test('valid signature requires checks before and after signing',async()=>{let checks=0;const wallet=guardedWallet({signTypedData:async()=>'sig'},async()=>{checks++},()=>1);assert.equal(await wallet.signTypedData({}),'sig');assert.equal(checks,2)});
test('session changes and late signatures are withheld',async()=>{let epoch=1,time=0;let wallet=guardedWallet({signTypedData:async()=>{epoch++;return 'sig'}},async()=>{},()=>epoch);await assert.rejects(()=>wallet.signTypedData({}),/session changed/);wallet=guardedWallet({signTypedData:async()=>{time=31000;return 'sig'}},async()=>{},()=>1,()=>time);await assert.rejects(()=>wallet.signTypedData({}),/expired/)});
test('disconnected account after signing is rejected',async()=>{let signed=false;const wallet=guardedWallet({signTypedData:async()=>{signed=true;return 'sig'}},async()=>{if(signed)throw Error('Disconnected')},()=>1);await assert.rejects(()=>wallet.signTypedData({}),/Disconnected/)});

import {freshMarket} from '../order-validation.js';
test('freshness rejects future receive times and malformed timestamps',()=>{const now=Date.now(),m={network:'testnet',market:{value:'ETH'},book:{coin:'ETH',time:now},received:now};assert.ok(freshMarket(m));assert.equal(freshMarket({...m,received:now+60000}),false);assert.equal(freshMarket({...m,book:{coin:'ETH',time:String(now)}}),false);assert.equal(freshMarket({...m,market:null}),false)});
