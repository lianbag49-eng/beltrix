import {toHex} from 'viem';
import {canonical,equalAddress} from './usdt-core.js';
import {usdtRoute} from './usdt-registry.js';
import {EvmUsdtAdapter} from './usdt-evm.js';
import {TronUsdtAdapter} from './usdt-tron.js';
import {SolanaUsdtAdapter} from './usdt-solana.js';

export function providersFor(routeId,win=window){
 const route=usdtRoute(routeId),out=[],seen=new Set();
 const add=(id,name,provider,web=null)=>{if(!provider||seen.has(provider))return;seen.add(provider);out.push({id,name,provider,web});};
 if(route.family==='evm'){
  add('connected','Connected wallet',win.beltrixWallet?.provider);add('okx','OKX Wallet',win.okxwallet);
  for(const [i,p] of (win.ethereum?.providers||[]).entries())add('evm-'+i,p.isMetaMask?'MetaMask':'Browser wallet',p);
  add('ethereum',win.ethereum?.isMetaMask?'MetaMask':'Browser wallet',win.ethereum);
  return out.filter(x=>typeof x.provider.request==='function');
 }
 if(route.family==='tron'){
  add('okx-tron','OKX Wallet · TRON',win.okxwallet?.tronLink||win.okxwallet?.tron,()=>win.okxwallet?.tronWeb||win.okxwallet?.tronLink?.tronWeb||win.okxwallet?.tron?.tronWeb);
  add('tron-modern','TRON wallet',win.tron,()=>win.tron?.tronWeb);
  add('tronlink','TronLink',win.tronLink,()=>win.tronWeb||win.tronLink?.tronWeb);
  return out.filter(x=>x.provider.request&&x.web);
 }
 add('okx-solana','OKX Wallet · Solana',win.okxwallet?.solana);add('phantom','Phantom',win.phantom?.solana);add('solana','Solana wallet',win.solana);
 return out.filter(x=>typeof x.provider.connect==='function'&&typeof x.provider.signTransaction==='function');
}
export async function connectUsdt(routeId,choice){
 const route=usdtRoute(routeId),p=choice?.provider;if(!p)throw Error('Choose an available wallet.');let account;
 if(route.family==='evm'){
  const rows=await p.request({method:'eth_requestAccounts'});account=canonical(routeId,rows?.[0]);
  if(Number(await p.request({method:'eth_chainId'}))!==route.chainId)await p.request({method:'wallet_switchEthereumChain',params:[{chainId:toHex(route.chainId)}]});
  if(Number(await p.request({method:'eth_chainId'}))!==route.chainId||canonical(routeId,(await p.request({method:'eth_accounts'}))?.[0])!==account)throw Error('Wallet account or network does not match.');
 }else if(route.family==='tron'){
  const result=await p.request({method:choice.id==='tron-modern'?'eth_requestAccounts':'tron_requestAccounts'});
  if(result?.code&&result.code!==200)throw Error('TRON wallet did not authorize connection.');
  account=canonical(routeId,choice.web()?.defaultAddress?.base58);
 }else{const result=await p.connect();account=canonical(routeId,result?.publicKey?.toString()||p.publicKey?.toString());}
 const session={...choice,account,family:route.family};await adapterFor(routeId,session).guard();return session;
}
export function adapterFor(routeId,session){
 const r=usdtRoute(routeId);if(!session?.account||session.family!==r.family)throw Error('Connect or enter an address for '+r.name+'.');
 return r.family==='evm'?new EvmUsdtAdapter(routeId,session.account,session.provider):r.family==='tron'?new TronUsdtAdapter(session.account,session.provider?session:null):new SolanaUsdtAdapter(session.account,session.provider);
}
export function watchSession(routeId,value){const r=usdtRoute(routeId);if(equalAddress(routeId,value,r.token)||(r.family==='evm'&&['0x2df1c51e09aecf9cacb7bc98cb1742757f163df7','0x08cfc1b6b2dcf36a1480b99353a354aa8ac56f89'].includes(String(value).toLowerCase())))throw Error('Use your wallet address, not a token contract or shared trading bridge.');return {family:r.family,account:canonical(routeId,value),provider:null,name:'Watch-only'};}
export function subscribeSession(session,invalidate,win=window){
 const p=session.provider,events=session.family==='evm'?['accountsChanged','chainChanged','disconnect']:['accountChanged','accountsChanged','chainChanged','disconnect'];
 for(const e of events)p?.on?.(e,invalidate);
 // Legacy TronLink events only invalidate; they are never trusted as account data.
 const message=e=>{if(e.source!==win)return;const action=e.data?.message?.action;if(['accountsChanged','setAccount','setNode','disconnect'].includes(action))invalidate();};
 if(session.family==='tron')win.addEventListener('message',message);
 return ()=>{for(const e of events)p?.removeListener?.(e,invalidate);win.removeEventListener('message',message);};
}
