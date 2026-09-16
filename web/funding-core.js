import {encodeFunctionData,erc20Abi,formatUnits,parseEventLogs} from 'viem';
import {address,amount,same,hashOK} from './wallet-core.js';

// Pinned to the official Bridge2 documentation; never accept a bridge or token from a URL/QR.
// https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/bridge2
export const FUNDING_NETWORKS=Object.freeze({
 mainnet:Object.freeze({network:'mainnet',chainId:42161,label:'Arbitrum One',bridge:'0x2df1c51e09aecf9cacb7bc98cb1742757f163df7',token:'0xaf88d065e77c8cc2239327c5edb3a432268e5831',api:'https://api.hyperliquid.xyz',explorer:'https://arbiscan.io',venue:'https://app.hyperliquid.xyz/'}),
 testnet:Object.freeze({network:'testnet',chainId:421614,label:'Arbitrum Sepolia',bridge:'0x08cfc1b6b2dcf36a1480b99353a354aa8ac56f89',token:'0x1baabb04529d43a73232b713c0fe471f7c7334d5',api:'https://api.hyperliquid-testnet.xyz',explorer:'https://sepolia.arbiscan.io',venue:'https://app.hyperliquid-testnet.xyz/'})
});
export const DEPOSIT_MIN=5000000n,WITHDRAWAL_MIN=2000000n,DOCUMENTED_WITHDRAWAL_FEE=1000000n;
export function fundingNetwork(value){if(!Object.hasOwn(FUNDING_NETWORKS,value))throw Error('Unsupported funding network.');return FUNDING_NETWORKS[value];}
export function usd(value,zero=false){if(zero&&/^(?:0|0\.0{1,6})$/.test(String(value)))return 0n;const n=amount(value,6);if(n>2n**64n-1n)throw Error('Amount exceeds the bridge limit.');return n;}
export const usdText=n=>formatUnits(BigInt(n),6);
export function optionalUsd(value){try{if(typeof value!=='string')return null;return usd(value,true);}catch{return null;}}
export function spotAvailable(state){
 if(!Array.isArray(state?.balances))return null;
 const b=state.balances.find(x=>x.token===0&&x.coin==='USDC');
 if(!b)return 0n;
 const total=optionalUsd(b.total),hold=optionalUsd(b.hold);
 return total===null||hold===null||hold>total?null:total-hold;
}
export function fundingIntent({kind,network,account,destination,quantity,toPerp,balances}){
 const net=fundingNetwork(network),owner=address(account),units=usd(quantity);
 if(!balances||!Number.isFinite(balances.at)||Date.now()-balances.at>30000||balances.at>Date.now()+1000)throw Error('Balances are stale. Refresh before reviewing.');
 let available,recipient=owner;
 if(kind==='deposit'){if(units<DEPOSIT_MIN)throw Error('Minimum deposit is 5 USDC. Smaller bridge deposits can be lost.');available=balances.wallet;recipient=address(net.bridge);}
 else if(kind==='withdraw'){
  if(units<WITHDRAWAL_MIN)throw Error('BELTRIX minimum withdrawal is 2 USDC, including the documented 1 USDC venue fee.');
  recipient=address(destination);if([net.bridge,net.token,...Object.values(FUNDING_NETWORKS).flatMap(n=>[n.bridge,n.token])].some(a=>same(a,recipient)))throw Error('Do not withdraw to a bridge or token contract. Use a wallet address.');
  available=balances.perps;
 }else if(kind==='transfer'){
  if(typeof toPerp!=='boolean')throw Error('Select a transfer direction.');
  if(!['disabled','default'].includes(balances.mode))throw Error('Separate Spot/Perps transfers require a standard account. Unified/portfolio or unknown modes are not supported here.');
  available=toPerp?balances.spot:balances.perps;
 }else throw Error('Unsupported funding action.');
 if(typeof available!=='bigint')throw Error('Available balance could not be verified.');
 if(units>available)throw Error('Amount exceeds the available balance.');
 return Object.freeze({kind,network,account:owner,destination:recipient,quantity:usdText(units),units:units.toString(),toPerp:kind==='transfer'?toPerp:undefined});
}
export function depositRequest(intent){
 if(intent.kind!=='deposit')throw Error('Expected a deposit.');
 const net=fundingNetwork(intent.network);if(!same(intent.destination,net.bridge)||usd(intent.quantity)<DEPOSIT_MIN)throw Error('Invalid bridge deposit.');
 return {from:address(intent.account),to:address(net.token),value:0n,data:encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[address(net.bridge),usd(intent.quantity)]})};
}
export function fundingFingerprint(session){return `${session.network}:${session.epoch}:${session.account?.toLowerCase()}`;}
export function assertFundingReview(review,session,now=Date.now()){
 if(!review||now>review.expires||now<review.created-1000)throw Error('Funding review expired. Review again.');
 if(!session.account||session.network!==review.network||session.epoch!==review.epoch||!same(session.account,review.account)||session.provider!==review.provider)throw Error('Funding account or network changed. Review again.');
}
export function matchingDepositTransaction(record,tx){
 const request=depositRequest(record);
 return same(tx.from,record.account)&&same(tx.to,request.to)&&tx.nonce===record.txNonce&&BigInt(tx.value||0)===0n&&String(tx.input||tx.data).toLowerCase()===request.data.toLowerCase();
}
export function transferEvidence(receipt,net,from,to,units){
 if(receipt.status!=='success')return false;
 return parseEventLogs({abi:erc20Abi,eventName:'Transfer',logs:receipt.logs||[],strict:true}).some(l=>same(l.address,net.token)&&same(l.args.from,from)&&same(l.args.to,to)&&l.args.value===BigInt(units));
}
export function matchingWithdrawal(record,log){
 const net=fundingNetwork(record.network),a=log.args;
 return same(log.address,net.bridge)&&a&&same(a.user,record.account)&&same(a.destination,record.destination)&&Number(a.nonce)===record.actionNonce&&a.usd>0n&&a.usd<=BigInt(record.units)&&hashOK(log.transactionHash);
}
export function paymentRequest({recipient,chainId,token,quantity}){
 const owner=address(recipient);if(!Number.isSafeInteger(chainId)||chainId<=0)throw Error('Invalid chain ID.');
 if(!token)return `ethereum:${owner}@${chainId}`;
 const base=`ethereum:${address(token)}@${chainId}/transfer?address=${owner}`;
 return base+(quantity?`&uint256=${usd(quantity)}`:'');
}
/** Parse data only. Never navigate, change networks, approve, or sign from QR contents. */
export function parsePaymentRequest(text,{chainId,token='native',decimals=18}){
 const s=String(text||'').trim();if(s.length>800)throw Error('Payment request is too long.');
 if(/^0x[0-9a-f]{40}$/i.test(s))return {recipient:address(s),quantity:null,networkIncluded:false};
 const m=/^ethereum:(?:pay-)?(0x[0-9a-f]{40})@(\d+)(\/transfer)?(?:\?([^#]*))?$/i.exec(s);
 if(!m)throw Error('Use a wallet address or a supported EIP-681 payment request.');
 if(Number(m[2])!==chainId)throw Error('QR network does not match the selected network.');
 const p=new URLSearchParams(m[4]||''),seen=new Set();for(const [k] of p){if(seen.has(k)||!(m[3]?['address','uint256']:['value']).includes(k))throw Error('Unsupported or duplicate QR parameter.');seen.add(k);}
 let recipient,raw;
 if(m[3]){if(token==='native'||!same(address(m[1]),token))throw Error('QR token does not match the selected asset.');recipient=address(p.get('address'));raw=p.get('uint256');}
 else{recipient=address(m[1]);raw=p.get('value');if(raw!==null&&token!=='native')throw Error('A native-token QR amount cannot be used for an ERC-20 asset.');}
 if(raw!==null&&(!/^[1-9]\d*$/.test(raw)||raw.length>78||BigInt(raw)>=2n**256n))throw Error('Invalid QR amount.');
 return {recipient,quantity:raw===null?null:formatUnits(BigInt(raw),decimals),networkIncluded:true};
}
