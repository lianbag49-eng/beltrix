import test from 'node:test';
import assert from 'node:assert/strict';
import {privateKeyToAccount} from 'viem/accounts';
import {encodeAbiParameters,decodeFunctionData,erc20Abi} from 'viem';
import {FundingService} from '../funding-service.js';
import {fundingRoute} from '../funding-core.js';
import {readFundingJournal} from '../funding-journal.js';
// Public, deterministic TEST-ONLY signing key. Never fund this address.
const signer=privateKeyToAccount('0x'+'01'.repeat(32)),B='0x2222222222222222222222222222222222222222',HASH='0x'+'a'.repeat(64);
function fixture(env='testnet'){
 const r=fundingRoute(env),state={chain:r.chainId,account:signer.address,valid:true,paused:false,available:'100',balance:100000000n,gas:21000n,nonce:3,sent:[],posted:[],signed:0};const map=new Map();const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 const provider={async request({method,params}){
  if(method==='eth_accounts')return [state.account];if(method==='eth_chainId')return '0x'+state.chain.toString(16);
  if(method==='eth_sendTransaction'){state.sent.push(params[0]);if(state.ambiguous)throw Error('RPC response missing');return HASH;}
  if(method==='eth_signTypedData_v4'){state.signed++;const data=JSON.parse(params[1]);data.domain.chainId=Number(data.domain.chainId);const sig=await signer.signTypedData(data);if(state.drift)state.valid=false;if(state.badSignature)return '0x'+'00'.repeat(65);return sig;}
  throw Error('Unexpected provider method '+method);
 }};
 const service=new FundingService({provider,account:signer.address,env,storage,locks:{request:async(k,o,fn)=>fn({name:k})},assertCurrent:()=>{if(!state.valid)throw Error('Session changed');},fetcher:async(url,request)=>{
  const data=JSON.parse(request.body);if(url.endsWith('/exchange')){state.posted.push(data);if(state.ambiguous)throw Error('Lost response');return {ok:true,json:async()=>({status:'ok',response:{type:'default'}})};}
  return {ok:true,json:async()=>({withdrawable:state.available})};
 }});
 service.client={readContract:async({functionName})=>({paused:state.paused,usdcToken:r.usdc,decimals:6,balanceOf:state.balance})[functionName],getCode:async()=>state.code||'0x',getBalance:async()=>10n**18n,estimateGas:async()=>state.gas,getGasPrice:async()=>1n,getTransactionCount:async()=>state.nonce,call:async()=>({data:encodeAbiParameters([{type:'bool'}],[true])}),getBlockNumber:async()=>10000n};
 return {service,state,storage};
}
test('deposit writes one exact USDC transfer, no approval or automatic credit claim',async()=>{
 const {service,state,storage}=fixture();const p=await service.prepare('deposit','5');assert.equal(state.sent.length,0);const row=await service.execute(p);assert.equal(row.status,'Submitted');assert.equal(state.sent.length,1);assert.equal(state.sent[0].to,fundingRoute('testnet').usdc);const d=decodeFunctionData({abi:erc20Abi,data:state.sent[0].data});assert.equal(d.functionName,'transfer');assert.deepEqual(d.args,[fundingRoute('testnet').bridge,5000000n]);assert.equal(readFundingJournal(storage).length,1);await assert.rejects(service.execute(p));
});
test('withdrawal produces verified typed signature and single request, not a completed-payment claim',async()=>{
 const {service,state}=fixture();const p=await service.prepare('withdraw','10',B);const row=await service.execute(p);assert.equal(row.status,'Awaiting settlement');assert.equal(state.signed,1);assert.equal(state.sent.length,0);assert.equal(state.posted.length,1);assert.equal(state.posted[0].action.amount,'10');assert.equal(state.posted[0].action.destination,B);assert.equal(state.posted[0].action.hyperliquidChain,'Testnet');assert.equal(state.posted[0].nonce,state.posted[0].action.time);await assert.rejects(service.prepare('withdraw','10',B),/unresolved/);
});
test('network drift, bridge pause, contract wallets and unavailable balances fail before signing',async()=>{
 for(const [key,value] of [['chain',1],['paused',true],['code','0x6000'],['available',null]]){const {service,state}=fixture();state[key]=value;await assert.rejects(service.prepare('withdraw','10',B));assert.equal(state.signed,0);assert.equal(state.posted.length,0);}
});
test('wallet change while signing withholds the signature and sends nothing',async()=>{
 const {service,state,storage}=fixture();const p=await service.prepare('withdraw','10',B);state.drift=true;await assert.rejects(service.execute(p));assert.equal(state.signed,1);assert.equal(state.posted.length,0);assert.equal(readFundingJournal(storage)[0].status,'Not submitted');
});
test('ambiguous transport results remain locked and are never resubmitted',async()=>{
 for(const kind of ['withdraw','deposit']){const {service,state,storage}=fixture();const p=await service.prepare(kind,'10',B);state.ambiguous=true;await assert.rejects(service.execute(p));assert.equal(readFundingJournal(storage)[0].status,'Unknown');await assert.rejects(service.prepare(kind,'10',B),/unresolved/);assert.equal(state.posted.length+state.sent.length,1);}
});
test('changed deposit nonce and lost durable storage cannot initiate a wallet send',async()=>{
 const {service,state}=fixture();const p=await service.prepare('deposit','5');state.nonce++;await assert.rejects(service.execute(p),/Nonce/);assert.equal(state.sent.length,0);
 const f=fixture();const review=await f.service.prepare('withdraw','10',B);f.storage.setItem=()=>{throw Error('Storage unavailable')};await assert.rejects(f.service.execute(review));assert.equal(f.state.signed,0);assert.equal(f.state.posted.length,0);
});
test('invalid signatures and lower withdrawable funds never reach exchange',async()=>{
 const f=fixture();const p=await f.service.prepare('withdraw','10',B);f.state.badSignature=true;await assert.rejects(f.service.execute(p));assert.equal(f.state.posted.length,0);
 const g=fixture();const q=await g.service.prepare('withdraw','10',B);g.state.available='9';await assert.rejects(g.service.execute(q));assert.equal(g.state.signed,0);
});
