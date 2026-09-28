import test from 'node:test';
import assert from 'node:assert/strict';
import {privateKeyToAccount} from 'viem/accounts';
import {createBeltrixLocalProvider,normalizeLocalTransaction} from '../beltrix-local-provider.js';

const PK='0x'+'12'.repeat(32);
const account=privateKeyToAccount(PK);

test('local provider exposes only unlocked account and explicit chain',async()=>{
 const provider=createBeltrixLocalProvider({account,initialChainId:1,fetchImpl:async()=>{throw Error('unexpected RPC')}});
 assert.deepEqual(await provider.request({method:'eth_accounts'}),[account.address]);
 assert.equal(await provider.request({method:'eth_chainId'}),'0x1');
 await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xa4b1'}]});
 assert.equal(await provider.request({method:'eth_chainId'}),'0xa4b1');
 await assert.rejects(()=>provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x123456'}]}),e=>e.code===4902);
});

test('local provider signs typed data and messages without exposing private key',async()=>{
 const provider=createBeltrixLocalProvider({account,initialChainId:1,fetchImpl:async()=>{throw Error('unexpected RPC')}});
 const typed={
  domain:{name:'BELTRIX',version:'1',chainId:1,verifyingContract:'0x1111111111111111111111111111111111111111'},
  types:{Action:[{name:'value',type:'uint256'}]},
  primaryType:'Action',
  message:{value:1}
 };
 const sig=await provider.request({method:'eth_signTypedData_v4',params:[account.address,JSON.stringify(typed)]});
 assert.match(sig,/^0x[0-9a-f]{130}$/i);
 const personal=await provider.request({method:'personal_sign',params:['0x68656c6c6f',account.address]});
 assert.match(personal,/^0x[0-9a-f]{130}$/i);
 await assert.rejects(()=>provider.request({method:'eth_sign',params:[account.address,'0x00']}),e=>e.code===4200);
 assert.equal('privateKey' in provider,false);
});

test('local transaction sender is bound to unlocked wallet',async()=>{
 assert.throws(()=>normalizeLocalTransaction({from:'0x1111111111111111111111111111111111111111'},account.address),/sender/i);
 const tx=normalizeLocalTransaction({from:account.address,to:'0x2222222222222222222222222222222222222222',value:'0x10',gas:'0x5208',nonce:'0x2'},account.address);
 assert.equal(tx.value,16n);
 assert.equal(tx.gas,21000n);
 assert.equal(tx.nonce,2);
});

test('eth_sendTransaction delegates only normalized local-account transaction',async()=>{
 let seen=null;
 const provider=createBeltrixLocalProvider({
  account,initialChainId:42161,
  fetchImpl:async()=>{throw Error('unexpected RPC')},
  sendTransactionImpl:async input=>{seen=input;return '0x'+'ab'.repeat(32)}
 });
 const hash=await provider.request({method:'eth_sendTransaction',params:[{
  from:account.address,to:'0x2222222222222222222222222222222222222222',value:'0x1'
 }]});
 assert.equal(hash,'0x'+'ab'.repeat(32));
 assert.equal(seen.transaction.account,account.address);
 assert.equal(seen.transaction.value,1n);
 assert.equal(seen.network.chain.id,42161);
});

test('read-only RPC methods forward to selected network RPC',async()=>{
 let call=null;
 const provider=createBeltrixLocalProvider({
  account,initialChainId:1,
  fetchImpl:async(url,init)=>{call={url,body:JSON.parse(init.body)};return {ok:true,async json(){return {jsonrpc:'2.0',id:1,result:'0x123'}}}}
 });
 assert.equal(await provider.request({method:'eth_blockNumber'}),'0x123');
 assert.equal(call.body.method,'eth_blockNumber');
 assert.match(call.url,/^https:/);
});

test('locking provider removes signing access',async()=>{
 const provider=createBeltrixLocalProvider({account,initialChainId:1,fetchImpl:async()=>{throw Error('unexpected RPC')}});
 provider.lock();
 await assert.rejects(()=>provider.request({method:'eth_accounts'}),e=>e.code===4100);
});
