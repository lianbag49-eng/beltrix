// Shared EVM write coordination. This contains no chain SDK, keys or RPC calls.
import {USDT_ROUTES} from './usdt-registry.js';
export function walletWriteLockName(chainId,account){return `beltrix-wallet-write:${Number(chainId)}:${String(account).toLowerCase()}`;}
export async function withWalletWriteLock(chainId,account,task,locks=navigator.locks){
 if(!locks?.request)throw Error('Web Locks are required to coordinate wallet requests safely.');
 return locks.request(walletWriteLockName(chainId,account),{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Error('Another BELTRIX wallet or funding request is open in a different tab.');return task();});
}
export function assertNoUsdtWrite(chainId,account,storage=localStorage){
 const raw=storage.getItem('beltrix-usdt-transfers-v1');if(!raw)return;let data;try{data=JSON.parse(raw)}catch{throw Error('USDT transfer history is unreadable. Reconcile it before sending.');}
 if(data?.version!==1||!Array.isArray(data.records))throw Error('USDT transfer history is invalid.');
 const done=new Set(['Confirmed','Failed','Rejected','Not submitted']);
 for(const row of data.records){const route=USDT_ROUTES.find(r=>r.id===row.route);if(!route||typeof row.status!=='string'||typeof row.account!=='string')throw Error('USDT history contains an invalid record.');if(route.family==='evm'&&route.chainId===Number(chainId)&&row.account.toLowerCase()===String(account).toLowerCase()&&!done.has(row.status))throw Error('An unresolved USDT transfer exists. Check USDT History before another wallet or funding request.');}
}
