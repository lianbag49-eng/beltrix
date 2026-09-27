import test from 'node:test';import assert from 'node:assert/strict';
import {privateKeyToAccount} from 'viem/accounts';
import {defineOracleOperatorSet,oracleObservationMessage,verifyOperatorObservation,oracleOperatorConsensus} from '../oracle-operators.js';

const a=privateKeyToAccount('0x1111111111111111111111111111111111111111111111111111111111111111');
const b=privateKeyToAccount('0x2222222222222222222222222222222222222222222222222222222222222222');
const c=privateKeyToAccount('0x3333333333333333333333333333333333333333333333333333333333333333');
const set=defineOracleOperatorSet({operators:[
 {address:a.address,label:'A'},{address:b.address,label:'B'},{address:c.address,label:'C'}
],quorum:2});

async function signed(account,{price,timestamp=1000,nonce=1,market='BTC-PERP'}){
 const input={operator:account.address,market,price,timestamp,nonce};
 return {...input,signature:await account.signMessage({message:oracleObservationMessage(input)})};
}

test('signed oracle observation recovers the configured operator',async()=>{
 const row=await signed(a,{price:100});
 const verified=await verifyOperatorObservation(row,set);
 assert.equal(verified.operator.toLowerCase(),a.address.toLowerCase());
 assert.equal(verified.price,100);
});

test('operator consensus requires distinct valid signatures and median price',async()=>{
 const rows=[
  await signed(a,{price:100}),
  await signed(b,{price:101}),
  await signed(c,{price:99})
 ];
 const out=await oracleOperatorConsensus(rows,{operatorSet:set,now:1100,maxAgeMs:500,maxDeviationBps:200});
 assert.equal(out.ok,true);
 assert.equal(out.price,100);
 assert.equal(out.operators.length,3);
});

test('invalid signature and insufficient operator quorum fail closed',async()=>{
 const valid=await signed(a,{price:100});
 const forged={...await signed(b,{price:101}),operator:c.address};
 const out=await oracleOperatorConsensus([valid,forged],{operatorSet:set,now:1100,maxAgeMs:500,maxDeviationBps:200});
 assert.equal(out.ok,false);
 assert.ok(out.reasons.includes('operator-quorum'));
});

test('signed operator consensus rejects excessive source deviation',async()=>{
 const rows=[await signed(a,{price:100}),await signed(b,{price:150})];
 const out=await oracleOperatorConsensus(rows,{operatorSet:set,now:1100,maxAgeMs:500,maxDeviationBps:100});
 assert.equal(out.ok,false);
 assert.ok(out.reasons.includes('oracle-deviation'));
});
