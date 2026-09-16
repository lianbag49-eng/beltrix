import {formatUnits,parseAbi,decodeFunctionData,decodeEventLog,erc20Abi} from 'viem';
import {address,amount,same,ZERO,hashOK} from './wallet-core.js';

// Explicit, reviewed routes only. Never infer a bridge or token from its symbol.
export const FUNDING_ROUTES=Object.freeze({
 mainnet:Object.freeze({env:'mainnet',chainId:42161,label:'Arbitrum One',usdc:address('0xaf88d065e77c8cc2239327c5edb3a432268e5831'),bridge:address('0x2df1c51e09aecf9cacb7bc98cb1742757f163df7'),api:'https://api.hyperliquid.xyz',venue:'https://app.hyperliquid.xyz/',testnet:false}),
 testnet:Object.freeze({env:'testnet',chainId:421614,label:'Arbitrum Sepolia',usdc:address('0x1baabb04529d43a73232b713c0fe471f7c7334d5'),bridge:address('0x08cfc1b6b2dcf36a1480b99353a354aa8ac56f89'),api:'https://api.hyperliquid-testnet.xyz',venue:'https://app.hyperliquid-testnet.xyz/',testnet:true})
});
export const DOCUMENTED_WITHDRAWAL_FEE=1000000n;
export const BRIDGE_ABI=parseAbi([
 'function paused() view returns (bool)',
 'function usdcToken() view returns (address)',
 'event FinalizedWithdrawal(address indexed user,address destination,uint64 usd,uint64 nonce,bytes32 message)'
]);
export function fundingRoute(env){if(typeof env!=='string'||!Object.hasOwn(FUNDING_ROUTES,env))throw Error('Unsupported funding environment.');return FUNDING_ROUTES[env];}
export function fundingAmount(text,kind){
 const n=amount(text,6);
 if(n>=2n**64n)throw Error('Amount exceeds the bridge limit.');
 if(kind==='deposit'&&n<5000000n)throw Error('Minimum bridge deposit is 5 USDC. Smaller deposits are not credited.');
 if(kind==='withdraw'&&n<2000000n)throw Error('BELTRIX minimum withdrawal is 2 USDC, including the documented 1 USDC fee.');
 if(!['deposit','withdraw'].includes(kind))throw Error('Unsupported funding action.');
 return n;
}
export function rawUSDC(value){
 if(typeof value!=='string'||!/^\d+(?:\.\d{1,6})?$/.test(value)||value.length>32)throw Error('Available balance is unavailable or malformed.');
 const [w,f='']=value.split('.');return BigInt(w)*1000000n+BigInt(f.padEnd(6,'0'));
}
export function withdrawalPayload(env,destination,quantity,time){
 const r=fundingRoute(env);const to=address(destination);const n=fundingAmount(formatUnits(quantity,6),'withdraw');
 if(same(to,r.usdc)||same(to,r.bridge))throw Error('A token or bridge contract is not a withdrawal recipient.');
 if(!Number.isSafeInteger(time)||time<=0)throw Error('Invalid withdrawal nonce.');
 const message={hyperliquidChain:r.testnet?'Testnet':'Mainnet',destination:to,amount:formatUnits(n,6),time};
 const primaryType='HyperliquidTransaction:Withdraw';
 const typed={domain:{name:'HyperliquidSignTransaction',version:'1',chainId:r.chainId,verifyingContract:ZERO},types:{[primaryType]:[{name:'hyperliquidChain',type:'string'},{name:'destination',type:'string'},{name:'amount',type:'string'},{name:'time',type:'uint64'}]},primaryType,message};
 return {typed,action:{type:'withdraw3',signatureChainId:'0x'+r.chainId.toString(16),...message},nonce:time};
}
export function receivePayload({recipient,chainId,token='native',decimals=18,value='',format='address'}){
 const to=address(recipient);
 if(!Number.isSafeInteger(chainId)||chainId<=0)throw Error('Select a supported network.');
 if(format==='address')return to;
 if(format!=='payment')throw Error('Unknown QR format.');
 const units=value.trim()?amount(value,decimals).toString():null;
 if(token==='native')return `ethereum:${to}@${chainId}${units?'?value='+units:''}`;
 return `ethereum:${address(token)}@${chainId}/transfer?address=${to}${units?'&uint256='+units:''}`;
}
/** A deliberately restricted EIP-681 payment parser; never execute arbitrary QR calls. */
export function parsePaymentRequest(text,{chainId,token='native',decimals=18}){
 if(typeof text!=='string'||text.length>1024||/[\u0000-\u001f\u007f]/.test(text))throw Error('Invalid payment request.');
 const input=text.trim();
 if(/^0x[\da-f]{40}$/i.test(input))return {recipient:address(input),value:null,networkSpecified:false};
 const m=/^ethereum:(?:pay-)?(0x[\da-f]{40})(?:@([1-9]\d*))?(?:\/(transfer))?(?:\?(.+))?$/i.exec(input);
 if(!m)throw Error('Only an EVM address or a supported ethereum: payment request is allowed.');
 if(m[2]&&Number(m[2])!==chainId)throw Error('QR network differs from the selected send network.');
 const params=new URLSearchParams(m[4]||'');const allowed=m[3]?['address','uint256']:['value'];
 for(const k of params.keys())if(!allowed.includes(k)||params.getAll(k).length!==1)throw Error('Unexpected or duplicate QR parameters.');
 if(m[3]&&(token==='native'||!same(address(m[1]),token)))throw Error('QR token contract differs from the selected asset.');
 if(!m[3]&&token!=='native')throw Error('This is a native-asset request. Select the correct asset first.');
 const recipient=address(m[3]?params.get('address'):m[1]);
 const raw=params.get(m[3]?'uint256':'value');
 // Fail closed on unsupported scientific notation rather than rounding a payment.
 if(raw!==null&&(!/^[1-9]\d*$/.test(raw)||raw.length>78||BigInt(raw)>=2n**256n))throw Error('QR amount must be a positive integer in atomic units.');
 if(!Number.isInteger(decimals)||decimals<0||decimals>36)throw Error('Asset precision unavailable.');
 return {recipient,value:raw===null?null:formatUnits(BigInt(raw),decimals),networkSpecified:!!m[2]};
}
export function verifyDepositReceipt(record,tx,receipt){
 const r=fundingRoute(record.env);
 if(!hashOK(tx?.hash)||!same(tx.hash,receipt?.transactionHash)||!same(tx.from,record.account)||!same(tx.to,r.usdc)||Number(tx.nonce)!==record.nonce||BigInt(tx.value)!==0n)throw Error('Transaction does not match the reviewed deposit.');
 if(tx.chainId!==undefined&&Number(tx.chainId)!==r.chainId)throw Error('Transaction network mismatch.');
 const d=decodeFunctionData({abi:erc20Abi,data:tx.input??tx.data});
 if(d.functionName!=='transfer'||!same(d.args[0],r.bridge)||d.args[1]!==BigInt(record.quantity))throw Error('Deposit token, bridge or amount does not match.');
 if(!same(receipt.from,record.account)||!same(receipt.to,r.usdc))throw Error('Receipt identity mismatch.');
 if(receipt.status==='reverted')return 'Failed';
 if(receipt.status!=='success')throw Error('Receipt status is not confirmed.');
 const transfer=(receipt.logs||[]).some(log=>{try{const e=decodeEventLog({abi:erc20Abi,...log});return same(log.address,r.usdc)&&e.eventName==='Transfer'&&same(e.args.from,record.account)&&same(e.args.to,r.bridge)&&e.args.value===BigInt(record.quantity)}catch{return false}});
 if(!transfer)throw Error('Exact USDC deposit transfer event not found.');
 return 'Awaiting credit';
}
export function finalizedWithdrawalMatches(record,log){
 try{const r=fundingRoute(record.env),e=decodeEventLog({abi:BRIDGE_ABI,...log});return !log.removed&&same(log.address,r.bridge)&&e.eventName==='FinalizedWithdrawal'&&same(e.args.user,record.account)&&same(e.args.destination,record.recipient)&&e.args.nonce===BigInt(record.nonce)&&e.args.usd===BigInt(record.quantity)-DOCUMENTED_WITHDRAWAL_FEE;}catch{return false;}
}
export function creditedDepositMatches(record,row){
 try{return same(row.hash,record.hash)&&row.delta?.type==='deposit'&&rawUSDC(row.delta.usdc)===BigInt(record.quantity)}catch{return false;}
}
