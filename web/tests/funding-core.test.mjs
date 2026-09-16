import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeFunctionData,encodeEventTopics,encodeAbiParameters,erc20Abi} from 'viem';
import {fundingRoute,fundingAmount,rawUSDC,receivePayload,parsePaymentRequest,withdrawalPayload,verifyDepositReceipt,finalizedWithdrawalMatches,creditedDepositMatches,BRIDGE_ABI} from '../funding-core.js';
import {readFundingJournal,saveFundingRecord,assertNoPendingFunding,FUNDING_JOURNAL,fundingLock} from '../funding-journal.js';
const A='0x1111111111111111111111111111111111111111',B='0x2222222222222222222222222222222222222222',H='0x'+'a'.repeat(64),route=fundingRoute('mainnet');
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}};
const record={id:'test-record',env:'mainnet',kind:'deposit',account:A,recipient:route.bridge,quantity:'5000000',nonce:4,created:1700000000000,status:'Submitted',hash:H};
test('funding routes and exact minimums reject rounding, missing balances and unsupported routes',()=>{
 assert.equal(fundingAmount('5','deposit'),5000000n);assert.equal(fundingAmount('2.000001','withdraw'),2000001n);assert.equal(rawUSDC('0'),0n);
 for(const text of ['4.999999','5.0000001','5e6','-5','0','NaN'])assert.throws(()=>fundingAmount(text,'deposit'));
 for(const x of [undefined,null,0,'','-1','1.0000001'])assert.throws(()=>rawUSDC(x));
 for(const env of ['arbitrum','__proto__','constructor',null])assert.throws(()=>fundingRoute(env));assert.equal(fundingRoute('testnet').chainId,421614);
});
test('QR requests encode exact chain, token and atomic units, address-only is explicit',()=>{
 assert.equal(receivePayload({recipient:A,chainId:42161,format:'address',value:'1'}),A);
 const request=receivePayload({recipient:A,chainId:42161,token:route.usdc,decimals:6,value:'1.234567',format:'payment'});
 assert.match(request,/uint256=1234567$/);assert.deepEqual(parsePaymentRequest(request,{chainId:42161,token:route.usdc,decimals:6}),{recipient:A,value:'1.234567',networkSpecified:true});
 const native=receivePayload({recipient:B,chainId:1,format:'payment',value:'0.000000000000000001'});assert.match(native,/value=1$/);assert.equal(parsePaymentRequest(native,{chainId:1}).value,'0.000000000000000001');
});
test('QR cannot choose an arbitrary call, contract, network or ambiguous amount',()=>{
 for(const bad of [`https://evil.example/${A}`,`ethereum:${A}@1/approve?address=${B}&uint256=1`,`ethereum:${A}@2?value=1`,`ethereum:${A}@1?value=1&value=2`,`ethereum:${A}@1?value=1e18`,`ethereum:${A}@1?value=1&gas=3`,`ethereum:name.eth@1`])assert.throws(()=>parsePaymentRequest(bad,{chainId:1}));
 assert.throws(()=>parsePaymentRequest(`ethereum:${route.usdc}@42161/transfer?address=${B}&uint256=1`,{chainId:42161,token:A,decimals:6}));
 assert.equal(parsePaymentRequest(B,{chainId:1}).networkSpecified,false);
});
test('withdrawal signed domain, nonce and action are bound to the actual environment',()=>{
 for(const env of ['mainnet','testnet']){const r=fundingRoute(env),p=withdrawalPayload(env,B,2500000n,1700000000000);assert.equal(p.action.type,'withdraw3');assert.equal(p.typed.domain.chainId,r.chainId);assert.equal(p.nonce,p.action.time);assert.equal(p.typed.message.amount,'2.5');assert.equal(p.typed.primaryType,'HyperliquidTransaction:Withdraw');assert.equal(p.action.hyperliquidChain,r.testnet?'Testnet':'Mainnet');}
 assert.throws(()=>withdrawalPayload('mainnet',route.bridge,2000000n,1));assert.throws(()=>withdrawalPayload('mainnet',route.usdc,2000000n,1));
});
test('deposit receipt requires exact sender, nonce, native USDC, bridge, amount and Transfer log',()=>{
 const log={address:route.usdc,topics:encodeEventTopics({abi:erc20Abi,eventName:'Transfer',args:{from:A,to:route.bridge}}),data:encodeAbiParameters([{type:'uint256'}],[5000000n])};
 const tx={hash:H,from:A,to:route.usdc,nonce:4,value:0n,chainId:42161,input:encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[route.bridge,5000000n]})};
 const receipt={transactionHash:H,from:A,to:route.usdc,status:'success',logs:[log]};
 assert.equal(verifyDepositReceipt(record,tx,receipt),'Awaiting credit');
 for(const mutation of [{from:B},{nonce:5},{chainId:1},{value:1n}])assert.throws(()=>verifyDepositReceipt(record,{...tx,...mutation},receipt));
 assert.throws(()=>verifyDepositReceipt(record,tx,{...receipt,logs:[]}));
 assert.equal(verifyDepositReceipt(record,tx,{...receipt,status:'reverted'}),'Failed');
 assert.ok(creditedDepositMatches(record,{hash:H,delta:{type:'deposit',usdc:'5'}}));assert.ok(!creditedDepositMatches(record,{hash:H,delta:{type:'withdraw',usdc:'5'}}));
});
test('withdrawal settlement cannot be inferred from a balance or an unrelated payment',()=>{
 const row={...record,kind:'withdraw',recipient:B,nonce:1700000000000};
 const log={address:route.bridge,topics:encodeEventTopics({abi:BRIDGE_ABI,eventName:'FinalizedWithdrawal',args:{user:A}}),data:encodeAbiParameters([{type:'address'},{type:'uint64'},{type:'uint64'},{type:'bytes32'}],[B,4000000n,1700000000000n,H])};
 assert.ok(finalizedWithdrawalMatches(row,log));assert.ok(!finalizedWithdrawalMatches({...row,nonce:1},log));assert.ok(!finalizedWithdrawalMatches({...row,recipient:A},log));assert.ok(!finalizedWithdrawalMatches(row,{...log,address:B}));assert.ok(!finalizedWithdrawalMatches(row,{...log,removed:true}));
});
test('journal keeps unknown outcomes locked after reload and fails closed on corruption',async()=>{
 const store=memory();saveFundingRecord({...record,status:'Unknown'},store);assert.equal(readFundingJournal(store)[0].status,'Unknown');assert.throws(()=>assertNoPendingFunding(A,'mainnet',store));assertNoPendingFunding(B,'mainnet',store);
 saveFundingRecord({...record,status:'Credited'},store);assertNoPendingFunding(A,'mainnet',store);
 store.setItem(FUNDING_JOURNAL,'bad');assert.throws(()=>readFundingJournal(store));
 await assert.rejects(fundingLock(A,'mainnet',()=>1,{}));await assert.rejects(fundingLock(A,'mainnet',()=>1,{request:async(k,o,fn)=>fn(null)}));
});
