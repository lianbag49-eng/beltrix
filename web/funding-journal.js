import {address,same,hashOK} from './wallet-core.js';
import {fundingRoute} from './funding-core.js';
export const FUNDING_JOURNAL='beltrix-funding-journal-v1';
export const TERMINAL=new Set(['Credited','Settled','Failed','Rejected','Not submitted']);
const STATES=new Set([...TERMINAL,'Signing','Submitted','Awaiting credit','Awaiting settlement','Unknown']);
export function readFundingJournal(storage=localStorage){
 const raw=storage.getItem(FUNDING_JOURNAL);if(raw===null)return [];
 let data;try{data=JSON.parse(raw)}catch{throw Error('Funding history is unreadable. Do not clear it or repeat a transfer; reconcile on the venue.');}
 if(data?.version!==1||!Array.isArray(data.records)||data.records.length>1000)throw Error('Funding journal format is invalid.');
 for(const r of data.records){
  fundingRoute(r.env);address(r.account);address(r.recipient);
  if(!r.id||!STATES.has(r.status)||!['deposit','withdraw'].includes(r.kind)||!/^\d+$/.test(r.quantity)||!Number.isSafeInteger(r.nonce)||!Number.isFinite(r.created)||(r.hash&&!hashOK(r.hash)))throw Error('Funding history contains an invalid record. Reconciliation is required.');
 }
 return data.records;
}
export function saveFundingRecord(row,storage=localStorage){
 const records=readFundingJournal(storage).filter(r=>r.id!==row.id);records.unshift(row);
 const active=records.filter(r=>!TERMINAL.has(r.status));const completed=records.filter(r=>TERMINAL.has(r.status)).slice(0,200);
 if(active.length>100)throw Error('Too many unresolved funding actions. Reconcile them first.');
 storage.setItem(FUNDING_JOURNAL,JSON.stringify({version:1,records:[...active,...completed]}));
}
export function assertNoPendingFunding(account,env,storage=localStorage){
 if(readFundingJournal(storage).some(r=>r.env===env&&same(r.account,account)&&!TERMINAL.has(r.status)))throw Error('An earlier funding action is unresolved. Check Funding history before trying again.');
 // Never start a bridge operation during a known unresolved wallet/order write.
 for(const key of ['beltrix-transactions-v1','beltrix-trade-submissions-v1']){
  const raw=storage.getItem(key);if(!raw)continue;let data;try{data=JSON.parse(raw)}catch{throw Error('Existing transaction history is unreadable.');}
  if(key==='beltrix-transactions-v1'){
   if(!Array.isArray(data))throw Error('Wallet transaction history is invalid.');
   if(data.some(r=>same(r.account,account)&&r.chainId===fundingRoute(env).chainId&&['Preparing','Pending','Unknown'].includes(r.status)))throw Error('Wait for or reconcile the existing wallet transaction first.');
  }else if(data?.[`${env}:${account.toLowerCase()}`]||(env==='testnet'&&data?.[account.toLowerCase()]))throw Error('Resolve the earlier trading submission before funding.');
 }
}
export async function fundingLock(account,env,task,locks=navigator.locks){
 if(!locks?.request)throw Error('This browser cannot safely coordinate funding requests. Use a current browser or the official venue.');
 return locks.request(`beltrix-funding:${env}:${account.toLowerCase()}`,{mode:'exclusive',ifAvailable:true},lock=>{
  if(!lock)throw Error('A funding request is already open in another tab.');
  return task();
 });
}
