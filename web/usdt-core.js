import {getAddress,isAddress,formatUnits} from 'viem';
import {TronWeb} from 'tronweb';
import {PublicKey} from '@solana/web3.js';
import bs58 from 'bs58';
import {usdtRoute} from './usdt-registry.js';

export const units=(raw,decimals)=>formatUnits(BigInt(raw),decimals);
export function quantity(text,decimals,max=2n**256n-1n){
 const s=String(text??'').trim();
 if(s.length>90||!/^(0|[1-9]\d*)(\.\d+)?$/.test(s))throw Error('Enter a positive amount without commas or exponents.');
 const [whole,fraction='']=s.split('.');if(fraction.length>decimals)throw Error(`This asset supports ${decimals} decimal places.`);
 const raw=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
 if(raw<=0n||raw>max)throw Error('Amount is outside the supported range.');return raw;
}
export function canonical(routeId,value){
 const r=usdtRoute(routeId),s=String(value??'').trim();if(!s||s.length>100)throw Error('Enter a valid address for '+r.name+'.');
 try{
  if(r.family==='evm'){if(!isAddress(s,{strict:true})||/^0x0{40}$/i.test(s))throw Error();return getAddress(s);}
  if(r.family==='tron'){if(!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s)||!TronWeb.isAddress(s))throw Error();return TronWeb.address.fromHex(TronWeb.address.toHex(s));}
  const key=new PublicKey(s);if(key.toBase58()!==s||s==='11111111111111111111111111111111')throw Error();return s;
 }catch{throw Error('Invalid '+r.name+' address. Check the complete address and network.');}
}
export const equalAddress=(route,a,b)=>{try{return canonical(route,a)===canonical(route,b)}catch{return false}};
export function checkRecipient(routeId,account,recipient){
 const r=usdtRoute(routeId),to=canonical(routeId,recipient);
 if(equalAddress(routeId,to,r.token)||equalAddress(routeId,to,account))throw Error('Do not send to the token contract, token mint, or the sending address itself.');
 if(r.family==='evm'&&['0x2df1c51e09aecf9cacb7bc98cb1742757f163df7','0x08cfc1b6b2dcf36a1480b99353a354aa8ac56f89'].includes(to.toLowerCase()))throw Error('This is a USDC-only trading bridge, not a USDT recipient.');
 return to;
}
export function validHash(routeId,value){
 const r=usdtRoute(routeId);if(r.family==='evm')return /^0x[0-9a-f]{64}$/i.test(value||'');
 if(r.family==='tron')return /^[0-9a-f]{64}$/i.test(value||'');
 try{return typeof value==='string'&&value.length<=90&&bs58.decode(value).length===64;}catch{return false;}
}
export function paymentRequest(routeId,recipient,value='',addressOnly=false){
 const r=usdtRoute(routeId),to=canonical(routeId,recipient);if(addressOnly||r.family==='tron')return to;
 const raw=value?quantity(value,r.decimals,r.family==='solana'?2n**64n-1n:undefined):null;
 if(r.family==='evm')return `ethereum:${r.token}@${r.chainId}/transfer?address=${to}`+(raw!==null?'&uint256='+raw:'');
 return `solana:${to}?spl-token=${r.token}`+(raw!==null?'&amount='+units(raw,r.decimals):'');
}
export function parsePayment(routeId,text){
 const r=usdtRoute(routeId),s=String(text??'').trim();if(s.length>1000)throw Error('Payment request is too long.');
 if(!s.includes(':'))return {recipient:canonical(routeId,s),amount:''};
 let recipient,amount='';
 if(r.family==='evm'){
  const match=/^ethereum:(0x[0-9a-fA-F]{40})@(\d+)\/transfer\?([^#]+)$/.exec(s);
  if(!match||Number(match[2])!==r.chainId||!equalAddress(routeId,match[1],r.token))throw Error('QR network or USDT contract does not match the selected route.');
  const p=new URLSearchParams(match[3]);if([...p.keys()].some(k=>!['address','uint256'].includes(k))||p.getAll('address').length!==1||p.getAll('uint256').length>1)throw Error('Unsupported payment request fields.');
  recipient=canonical(routeId,p.get('address'));
  if(p.has('uint256')){const raw=p.get('uint256');if(!/^\d{1,78}$/.test(raw)||BigInt(raw)<=0n||BigInt(raw)>=2n**256n)throw Error('Invalid exact token amount.');amount=units(raw,r.decimals);}
 }else if(r.family==='solana'){
  const match=/^solana:([1-9A-HJ-NP-Za-km-z]{32,44})\?([^#]+)$/.exec(s);if(!match)throw Error('Only a Solana USDT transfer request is supported, not a transaction URL.');
  const p=new URLSearchParams(match[2]);if([...p.keys()].some(k=>!['spl-token','amount'].includes(k))||p.getAll('spl-token').length!==1||p.get('spl-token')!==r.token||p.getAll('amount').length>1)throw Error('QR mint or payment fields do not match Solana USDT.');
  recipient=canonical(routeId,match[1]);if(p.has('amount'))amount=units(quantity(p.get('amount'),r.decimals,2n**64n-1n),r.decimals);
 }else throw Error('For TRON, paste or scan a TRON address only. Select the amount separately.');
 return {recipient,amount};
}
export function explorerTx(routeId,hash){if(!validHash(routeId,hash))throw Error('Invalid transaction reference.');const r=usdtRoute(routeId);return r.explorer+(r.family==='tron'?'/transaction/':'/tx/')+hash;}
export function explorerAccount(routeId,account){const r=usdtRoute(routeId);return r.explorer+'/address/'+canonical(routeId,account);}
export function safeInteger(value,label){const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid '+label+'.');return n;}
export function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)&&!(x instanceof Uint8Array))freeze(x);});}return value;}
