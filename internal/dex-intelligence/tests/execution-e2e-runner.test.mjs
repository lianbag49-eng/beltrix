import test from 'node:test';
import assert from 'node:assert/strict';
import {runOrderlyTestnetLifecycle,runParadexTestnetLifecycle} from '../execution-e2e-runner.js';

test('Orderly E2E runner requires explicit testnet confirmation and records lifecycle evidence',async()=>{
 let status='OPEN';
 const client={
  mode:'testnet-only',
  createOrder:async()=>({data:{order_id:13}}),
  getOrder:async()=>({data:{status}}),
  cancelOrder:async()=>{status='CANCELLED';return {data:{status:'CANCEL_SENT'}}},
  reconcileAccountState:async()=>({positions:[]})
 };
 await assert.rejects(()=>runOrderlyTestnetLifecycle(client,{order:{symbol:'PERP_BTC_USDC'}}),/confirmTestnet/);
 const out=await runOrderlyTestnetLifecycle(client,{confirmTestnet:true,order:{symbol:'PERP_BTC_USDC'}});
 assert.equal(out.complete,true);
 assert.equal(out.details.finalStatus,'CANCELLED');
 assert.equal(out.steps.at(-1).id,'reconcile-account-positions');
});

test('Paradex E2E runner keeps lifecycle testnet-only',async()=>{
 let status='OPEN';
 const client={
  mode:'testnet-only',
  createOrder:async()=>({id:'o1',status:'NEW'}),
  getOrder:async()=>({id:'o1',status}),
  cancelOrder:async()=>{status='CANCELLED';return null},
  reconcilePositions:async()=>({positions:[{market:'BTC-USD-PERP'}]})
 };
 const out=await runParadexTestnetLifecycle(client,{confirmTestnet:true,order:{market:'BTC-USD-PERP'}});
 assert.equal(out.complete,true);
 assert.equal(out.details.orderId,'o1');
 assert.equal(out.details.finalStatus,'CANCELLED');
});

test('E2E runner refuses non-testnet clients',async()=>{
 const client={mode:'mainnet'};
 await assert.rejects(()=>runOrderlyTestnetLifecycle(client,{confirmTestnet:true,order:{}}),/testnet-only/);
});
