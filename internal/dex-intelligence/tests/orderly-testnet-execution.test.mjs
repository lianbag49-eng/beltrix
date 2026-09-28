import test from 'node:test';
import assert from 'node:assert/strict';
import {
 canonicalOrderlyRequest,normalizeOrderlyOrder,orderlyCancelPath,
 buildSignedOrderlyRequest,createOrderlyTestnetExecutionClient,ORDERLY_TESTNET_BASE
} from '../orderly-testnet-execution.js';

test('Orderly canonical signature payload follows timestamp method path query body order',()=>{
 const message=canonicalOrderlyRequest({
  timestamp:1649920583000,
  method:'POST',
  path:'/v1/order',
  body:{symbol:'PERP_ETH_USDC',order_type:'LIMIT',order_price:1521.03,order_quantity:2.11,side:'BUY'}
 });
 assert.equal(message,'1649920583000POST/v1/order'+JSON.stringify({symbol:'PERP_ETH_USDC',order_type:'LIMIT',order_price:1521.03,order_quantity:2.11,side:'BUY'}));
});

test('Orderly request builder emits required auth headers without base URL in signature',async()=>{
 const req=await buildSignedOrderlyRequest({
  accountId:'0xabc',
  orderlyKey:'ed25519:4vJ9JU1bJJE96FWSJKvNoaqqnmzsHn8gKJS6yU5h12Uw',
  timestamp:1700000000000,
  method:'DELETE',
  path:'/v1/order?order_id=13&symbol=PERP_ETH_USDC',
  sign:async message=>'sig:'+message.length
 });
 assert.equal(req.headers['orderly-account-id'],'0xabc');
 assert.match(req.headers['orderly-signature'],/^sig:/);
 assert.equal(req.headers['Content-Type'],'application/x-www-form-urlencoded');
 assert.equal(req.canonicalMessage.includes('https://'),false);
});

test('Orderly order normalization and cancellation are bounded',()=>{
 assert.deepEqual(normalizeOrderlyOrder({symbol:'perp_btc_usdc',orderType:'MARKET',side:'buy',quantity:0.01,reduceOnly:true}),{
  symbol:'PERP_BTC_USDC',order_type:'MARKET',side:'BUY',order_quantity:0.01,reduce_only:true
 });
 assert.equal(orderlyCancelPath({orderId:13,symbol:'PERP_ETH_USDC'}),'/v1/order?order_id=13&symbol=PERP_ETH_USDC');
 assert.throws(()=>normalizeOrderlyOrder({symbol:'BTC',orderType:'MARKET',side:'BUY',quantity:1}),/symbol/i);
});

test('Orderly client stays testnet-only and supports order lifecycle plus public position reconciliation',async()=>{
 const calls=[];
 const fetchImpl=async(url,init)=>{
  calls.push({url,init});
  if(url.endsWith('/v1/order')&&init.method==='POST')return {ok:true,status:200,async json(){return {success:true,data:{order_id:13}}}};
  if(url.includes('/v1/order?')&&init.method==='DELETE')return {ok:true,status:200,async json(){return {success:true,data:{status:'CANCEL_SENT'}}}};
  if(url.endsWith('/v1/order/13'))return {ok:true,status:200,async json(){return {success:true,data:{order_id:13,status:'CANCELLED'}}}};
  if(url.endsWith('/v1/public/query'))return {ok:true,status:200,async json(){return {success:true,data:{account_id:'0xabc',positions:[{symbol:'PERP_BTC_USDC',position_qty:'0.1'}]}}}};
  throw Error('unexpected '+url);
 };
 const client=createOrderlyTestnetExecutionClient({
  accountId:'0xabc',
  orderlyKey:'ed25519:4vJ9JU1bJJE96FWSJKvNoaqqnmzsHn8gKJS6yU5h12Uw',
  sign:async()=> 'fixture-signature',
  address:'0x1111111111111111111111111111111111111111',
  fetchImpl
 });
 assert.equal((await client.createOrder({symbol:'PERP_BTC_USDC',side:'BUY',order_type:'MARKET',order_quantity:0.01})).data.order_id,13);
 assert.equal((await client.cancelOrder({orderId:13,symbol:'PERP_BTC_USDC'})).data.status,'CANCEL_SENT');
 assert.equal((await client.getOrder(13)).data.status,'CANCELLED');
 const state=await client.reconcileAccountState();
 assert.equal(state.positions[0].position_qty,'0.1');
 assert.ok(calls.every(x=>x.url.startsWith(ORDERLY_TESTNET_BASE)));
 assert.throws(()=>createOrderlyTestnetExecutionClient({baseUrl:'https://api.orderly.org'}),/testnet-only/i);
});
