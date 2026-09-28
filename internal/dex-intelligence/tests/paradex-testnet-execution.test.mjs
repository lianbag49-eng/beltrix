import test from 'node:test';
import assert from 'node:assert/strict';
import {
 buildParadexSiweMessage,authenticateParadexEvm,normalizeParadexOrder,
 createParadexTestnetExecutionClient,PARADEX_TESTNET_BASE
} from '../paradex-testnet-execution.js';

const EVM='0x1111111111111111111111111111111111111111';

test('Paradex SIWE auth payload is deterministic and time bounded',()=>{
 const msg=buildParadexSiweMessage({
  address:EVM,nonce:'abcdef0123456789',
  issuedAt:'2026-09-28T08:00:00.000Z',
  expirationTime:'2026-09-28T08:05:00.000Z'
 });
 assert.match(msg,/app\.paradex\.trade wants you to sign in/);
 assert.match(msg,/Chain ID: 1/);
 assert.match(msg,/Expiration Time: 2026-09-28T08:05:00\.000Z/);
});

test('Paradex EVM authentication uses personal_sign and v2 auth headers',async()=>{
 let signed=null,call=null;
 const provider={request:async req=>{signed=req;return '0x'+'12'.repeat(65)}};
 const auth=await authenticateParadexEvm({
  provider,
  paradexAccount:'0xabc123',
  address:EVM,
  nonce:'abcdef0123456789',
  now:Date.parse('2026-09-28T08:00:00Z'),
  fetchImpl:async(url,init)=>{call={url,init};return {ok:true,status:200,async json(){return {jwt_token:'fixture.jwt'}}}}
 });
 assert.equal(signed.method,'personal_sign');
 assert.equal(call.url,PARADEX_TESTNET_BASE+'/v2/auth');
 assert.equal(call.init.headers['PARADEX-STARKNET-ACCOUNT'],'0xabc123');
 assert.ok(call.init.headers['PARADEX-SIWE-MESSAGE']);
 assert.equal(auth.jwt,'fixture.jwt');
});

test('Paradex order normalization requires venue signature and timestamp',()=>{
 const body=normalizeParadexOrder({
  market:'BTC-USD-PERP',side:'BUY',size:'0.01',type:'LIMIT',price:'60000',flags:['REDUCE_ONLY']
 },{signature:'[123,456]',signatureTimestamp:1700000000000});
 assert.equal(body.market,'BTC-USD-PERP');
 assert.equal(body.signature,'[123,456]');
 assert.deepEqual(body.flags,['REDUCE_ONLY']);
 assert.throws(()=>normalizeParadexOrder({market:'BTC-USD-PERP',side:'BUY',size:'1',type:'MARKET'}),/signature/i);
});

test('Paradex client stays testnet-only and supports order cancel get and position reconciliation',async()=>{
 const calls=[];
 const fetchImpl=async(url,init)=>{
  calls.push({url,init});
  if(url.endsWith('/v1/orders')&&init.method==='POST')return {ok:true,status:201,async json(){return {id:'o1',status:'NEW'}}};
  if(url.endsWith('/v1/orders/o1')&&init.method==='DELETE')return {ok:true,status:204,async json(){throw Error('no body')}};
  if(url.endsWith('/v1/orders/o1')&&init.method==='GET')return {ok:true,status:200,async json(){return {id:'o1',status:'OPEN'}}};
  if(url.endsWith('/v1/positions'))return {ok:true,status:200,async json(){return {results:[{market:'BTC-USD-PERP',size:'0.01',side:'LONG'}]}}};
  throw Error('unexpected '+url);
 };
 const client=createParadexTestnetExecutionClient({
  jwt:'fixture.jwt',
  orderSigner:async unsigned=>({signature:'[123,456]',signatureTimestamp:unsigned.signature_timestamp}),
  fetchImpl
 });
 assert.equal((await client.createOrder({market:'BTC-USD-PERP',side:'BUY',size:'0.01',type:'MARKET'})).id,'o1');
 assert.equal(await client.cancelOrder('o1'),null);
 assert.equal((await client.getOrder('o1')).status,'OPEN');
 const state=await client.reconcilePositions();
 assert.equal(state.positions[0].market,'BTC-USD-PERP');
 assert.ok(calls.every(x=>x.url.startsWith(PARADEX_TESTNET_BASE)));
 assert.throws(()=>createParadexTestnetExecutionClient({baseUrl:'https://api.prod.paradex.trade'}),/testnet-only/i);
});
