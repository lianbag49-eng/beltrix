import {withWalletWriteLock} from './wallet-write-coordination.js';
import {canonical,validHash,equalAddress} from './usdt-core.js';
import {usdtRoute} from './usdt-registry.js';
export const USDT_JOURNAL='beltrix-usdt-transfers-v1';
export const DONE=new Set(['Confirmed','Failed','Rejected','Not submitted']);
const STATES=new Set([...DONE,'Signing','Submitted','Unknown']);
export function readJournal(storage=localStorage){
 const raw=storage.getItem(USDT_JOURNAL);if(raw===null)return [];
 let data;try{data=JSON.parse(raw)}catch{throw Error('USDT history is unreadable. Do not clear it or repeat a transfer.');}
 if(data?.version!==1||!Array.isArray(data.records)||data.records.length>500)throw Error('USDT history is invalid. Reconcile before sending.');
 for(const row of data.records){const r=usdtRoute(row.route);canonical(r.id,row.account);canonical(r.id,row.recipient);if(typeof row.id!=='string'||!STATES.has(row.status)||!/^\d{1,78}$/.test(row.quantity)||BigInt(row.quantity)<=0n||!Number.isFinite(row.created)||(row.hash&&!validHash(row.route,row.hash)))throw Error('USDT history contains an invalid record.');}
 return data.records;
}
export function saveRecord(row,storage=localStorage){
 const old=readJournal(storage).filter(x=>x.id!==row.id),all=[row,...old];
 const active=all.filter(x=>!DONE.has(x.status));if(active.length>50)throw Error('Too many unresolved transfers. Check history first.');
 storage.setItem(USDT_JOURNAL,JSON.stringify({version:1,records:[...active,...all.filter(x=>DONE.has(x.status)).slice(0,200)]}));
}
export function assertClear(routeId,account,storage=localStorage){
 if(readJournal(storage).some(x=>x.route===routeId&&equalAddress(routeId,x.account,account)&&!DONE.has(x.status)))throw Error('An earlier USDT transfer is unresolved. Check its status in History before sending again.');
 const r=usdtRoute(routeId);if(r.family!=='evm')return;
 for(const key of ['beltrix-transactions-v1','beltrix-funding-journal-v1']){
  const raw=storage.getItem(key);if(!raw)continue;let data;try{data=JSON.parse(raw)}catch{throw Error('Existing wallet history is unreadable.');}
  const records=Array.isArray(data)?data:data?.records;if(!Array.isArray(records))throw Error('Existing wallet history is invalid.');
  if(records.some(x=>String(x.account).toLowerCase()===account.toLowerCase()&&(x.chainId===r.chainId||(r.chainId===42161&&x.env==='mainnet'))&&['Preparing','Pending','Unknown','Signing','Submitted','Awaiting credit','Awaiting settlement'].includes(x.status)))throw Error('Wait for or reconcile your other BELTRIX wallet/funding request first.');
 }
}
export async function sendLock(routeId,account,fn,locks=navigator.locks){
 if(usdtRoute(routeId).family==='evm')return withWalletWriteLock(usdtRoute(routeId).chainId,account,fn,locks);
 if(!locks?.request)throw Error('A browser with Web Locks is required to coordinate transfers safely.');
 return locks.request('beltrix-usdt:'+routeId+':'+canonical(routeId,account),{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Error('Another tab is already processing a transfer.');return fn();});
}
