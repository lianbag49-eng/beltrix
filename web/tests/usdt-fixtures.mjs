// Public deterministic TEST-ONLY keys. Never fund these addresses.
import {TronWeb,utils} from 'tronweb';
import {Keypair,PublicKey,SystemProgram,Transaction} from '@solana/web3.js';
import {encodeAbiParameters,encodeEventTopics,erc20Abi,toHex} from 'viem';
import {usdtRoute} from '../usdt-registry.js';
import {TOKEN_PROGRAM,associated} from '../usdt-solana-token.js';
import {tronTransferData} from '../usdt-tron.js';
import {SOLANA_MAINNET_GENESIS} from '../usdt-solana.js';
export const EVM_FROM='0x1111111111111111111111111111111111111111',EVM_TO='0x2222222222222222222222222222222222222222',EVM_HASH='0x'+'a'.repeat(64);
export const TRON_KEY='1'.padStart(64,'0'),TRON_FROM=TronWeb.address.fromPrivateKey(TRON_KEY),TRON_TO=TronWeb.address.fromPrivateKey('2'.padStart(64,'0'));
export const SOL_KEY=Keypair.fromSeed(Uint8Array.from({length:32},(_,i)=>i+1)),SOL_TO=Keypair.fromSeed(Uint8Array.from({length:32},(_,i)=>i+51)).publicKey.toBase58();
export function storage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m};}
export const locks={request:async(_name,_options,fn)=>fn({name:'test lock'})};
export function evmFixture(id='ethereum'){
 const r=usdtRoute(id),state={raw:1000n*10n**BigInt(r.decimals),native:10n**20n,nonce:7,chain:r.chainId,account:EVM_FROM,gas:60000n,price:1000000000n,sends:[],input:null,simulation:'0x',receipt:null};
 const provider={request:async({method,params})=>{if(method==='eth_accounts'||method==='eth_requestAccounts')return[state.account];if(method==='eth_chainId')return toHex(state.chain);if(method==='eth_sendTransaction'){state.sends.push(params[0]);state.input=params[0].data;return EVM_HASH;}throw Error(method);}};
 const client={getChainId:async()=>r.chainId,readContract:async x=>x.functionName==='decimals'?r.decimals:state.raw,getBalance:async()=>state.native,getCode:async()=>undefined,estimateGas:async()=>state.gas,getGasPrice:async()=>state.price,getTransactionCount:async()=>state.nonce,call:async()=>({data:state.simulation}),getBlockNumber:async()=>101n,getTransaction:async()=>({hash:EVM_HASH,from:EVM_FROM,to:r.token,nonce:7,input:state.input,value:0n}),getTransactionReceipt:async()=>state.receipt};
 const receipt=(raw)=>({transactionHash:EVM_HASH,from:EVM_FROM,to:r.token,status:'success',blockNumber:100n,logs:[{address:r.token,topics:encodeEventTopics({abi:erc20Abi,eventName:'Transfer',args:{from:EVM_FROM,to:EVM_TO}}),data:encodeAbiParameters([{type:'uint256'}],[raw])}]});
 return{state,provider,client,receipt};
}
export function tronTx(recipient=TRON_TO,raw=1234567n,feeLimit=13000000){
 const tx={visible:false,raw_data:{contract:[{parameter:{value:{owner_address:TronWeb.address.toHex(TRON_FROM),contract_address:TronWeb.address.toHex(usdtRoute('tron').token),data:tronTransferData(recipient,raw),call_value:0},type_url:'type.googleapis.com/protocol.TriggerSmartContract'},type:'TriggerSmartContract'}],ref_block_bytes:'1234',ref_block_hash:'1234567890abcdef',expiration:Date.now()+60000,timestamp:Date.now(),fee_limit:feeLimit}};
 const pb=utils.transaction.txJsonToPb(tx);tx.raw_data_hex=utils.transaction.txPbToRawDataHex(pb);tx.txID=utils.transaction.txPbToTxID(pb).replace(/^0x/,'');return tx;
}
export function tronFixture(){
 const r=usdtRoute('tron'),state={account:TRON_FROM,balance:100000000n,native:1000000000,energy:100000,broadcasts:[],tx:null,signed:null};
 const signer=new TronWeb({fullHost:'https://api.trongrid.io'});signer.setPrivateKey(TRON_KEY);
 const genesis={blockID:'0'.repeat(64)};
 const web={defaultAddress:{base58:TRON_FROM},trx:{getBlock:async()=>genesis,sign:async tx=>{state.signed=await signer.trx.sign(tx);return state.signed;}}};
 const client={setAddress:()=>{},trx:{getBlock:async()=>genesis,getBalance:async()=>state.native,getAccount:async()=>({}),getChainParameters:async()=>[{key:'getEnergyFee',value:100},{key:'getTransactionFee',value:1000}],sendRawTransaction:async tx=>{state.broadcasts.push(tx);return{result:true,txid:tx.txID};},getConfirmedTransaction:async()=>({...state.tx,ret:[{contractRet:'SUCCESS'}]}),getTransactionInfo:async()=>({id:state.tx.txID,blockNumber:10,receipt:{result:'SUCCESS'},log:[{address:TronWeb.address.toHex(r.token).slice(2),topics:['ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',TronWeb.address.toHex(TRON_FROM).slice(2).padStart(64,'0'),TronWeb.address.toHex(TRON_TO).slice(2).padStart(64,'0')],data:(1234567n).toString(16).padStart(64,'0')}]})},transactionBuilder:{triggerConstantContract:async(_token,selector)=>({result:{result:true},constant_result:[(selector==='decimals()'?6n:selector.startsWith('balance')?state.balance:1n).toString(16).padStart(64,'0')],energy_used:state.energy}),triggerSmartContract:async(_t,_s,o,p)=>{state.tx=tronTx(p[0].value,BigInt(p[1].value),o.feeLimit);return{result:{result:true},transaction:state.tx};}}};
 return{state,web,client,connection:{web:()=>web}};
}
export function mintInfo(){const b=Buffer.alloc(82);b[44]=6;b[45]=1;return{owner:TOKEN_PROGRAM,data:b,lamports:100,executable:false};}
export function tokenInfo(owner,raw=100000000n,mint=new PublicKey(usdtRoute('solana').token),frozen=false){const b=Buffer.alloc(165);mint.toBuffer().copy(b,0);owner.toBuffer().copy(b,32);b.writeBigUInt64LE(raw,64);b[108]=frozen?2:1;return{owner:TOKEN_PROGRAM,data:b,lamports:2039280,executable:false};}
export function solanaFixture(){
 const mint=new PublicKey(usdtRoute('solana').token),owner=SOL_KEY.publicKey,source=associated(owner,mint),recipient=new PublicKey(SOL_TO),dest=associated(recipient,mint);
 const state={balance:100000000n,native:1000000000,height:10,sends:[],simulation:null,signed:null,created:false};
 const provider={publicKey:owner,connect:async()=>({publicKey:owner}),signTransaction:async tx=>{tx.partialSign(SOL_KEY);state.signed=tx;return tx;}};
 const client={getGenesisHash:async()=>SOLANA_MAINNET_GENESIS,getAccountInfo:async p=>p.equals(mint)?mintInfo():p.equals(source)?tokenInfo(owner,state.balance):p.equals(dest)&&state.created?tokenInfo(recipient,0n):null,getTokenAccountsByOwner:async()=>({value:[{pubkey:source,account:tokenInfo(owner,state.balance)}]}),getBalance:async()=>state.native,getLatestBlockhash:async()=>({blockhash:new PublicKey(new Uint8Array(32).fill(12)).toBase58(),lastValidBlockHeight:100}),getMinimumBalanceForRentExemption:async()=>2039280,getFeeForMessage:async()=>({value:6000}),simulateTransaction:async()=>({value:{err:state.simulation}}),getBlockHeight:async()=>state.height,sendRawTransaction:async bytes=>{state.sends.push(bytes);return (await import('bs58')).default.encode(Transaction.from(bytes).signature);},getTransaction:async hash=>({transaction:{signatures:[hash],message:state.signed.compileMessage()},meta:{err:null}})};
 return{state,provider,client,owner,source,dest,mint};
}
