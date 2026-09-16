import {usdtRoute} from './usdt-registry.js';
import {canonical,checkRecipient,quantity,freeze,validHash} from './usdt-core.js';
import {readJournal,saveRecord,assertClear,sendLock} from './usdt-journal.js';

export class UsdtTransferService {
 constructor(adapter,{storage=localStorage,locks=navigator.locks,isCurrent=()=>true,clock=()=>Date.now()}={}){
  this.adapter=adapter;this.route=usdtRoute(adapter.route.id);this.account=canonical(this.route.id,adapter.account);this.storage=storage;this.locks=locks;this.isCurrent=isCurrent;this.clock=clock;this.reviews=new WeakSet();
 }
 current(){if(!this.isCurrent())throw Error('View, account or network changed. Connect and review again.');}
 reviewValid(review){this.current();if(!this.reviews.has(review)||this.clock()>=review.expires)throw Error('Review expired or was already used. Prepare a new review.');}
 async prepare(recipient,input){
  this.current();const to=checkRecipient(this.route.id,this.account,recipient),raw=quantity(input,this.route.decimals,this.route.family==='solana'?2n**64n-1n:undefined);
  assertClear(this.route.id,this.account,this.storage);await this.adapter.guard();const plan=await this.adapter.prepare(to,raw);this.current();await this.adapter.guard();
  const review=freeze({...plan,route:this.route.id,account:this.account,expires:Math.min(this.clock()+60000,plan.expires||Infinity)});this.reviews.add(review);return review;
 }
 async execute(review){
  this.reviewValid(review);
  return sendLock(this.route.id,this.account,async()=>{
   this.reviewValid(review);assertClear(this.route.id,this.account,this.storage);await this.adapter.guard();await this.adapter.recheck(review);this.reviewValid(review);
   const row={id:crypto.randomUUID(),route:this.route.id,account:this.account,recipient:review.recipient,quantity:review.quantity.toString(),created:this.clock(),status:'Signing',hash:null,proof:review.proof};
   saveRecord(row,this.storage);this.reviews.delete(review);let broadcast=false;
   const assertCurrent=()=>{this.current();if(this.clock()>=review.expires)throw Error('Signature arrived after review expiry. Nothing new was broadcast.');};
   try{
    const hash=await this.adapter.submit(review,{assertCurrent,beforeBroadcast:async hash=>{assertCurrent();row.hash=hash;row.status='Submitted';saveRecord(row,this.storage);broadcast=true;}});
    if(!validHash(this.route.id,hash))throw Error('No verifiable transaction reference returned.');
    row.hash=hash;row.status='Submitted';row.detail='Submitted, not yet confirmed. Use Check status; never repeat an uncertain transfer.';saveRecord(row,this.storage);return row;
   }catch(e){
    row.status=e?.usdtRejected?'Rejected':broadcast?'Unknown':'Not submitted';row.detail=String(e?.shortMessage||e?.message||'Transfer did not complete.').slice(0,350);saveRecord(row,this.storage);
    const error=Error(row.detail+(broadcast&&!e?.usdtRejected?' Check History before trying again.':''));error.record=row;throw error;
   }
  },this.locks);
 }
 async check(id,providedHash=''){
  const row=readJournal(this.storage).find(x=>x.id===id);if(!row||row.route!==this.route.id||canonical(row.route,row.account)!==this.account)throw Error('Record belongs to a different account or route.');
  if(providedHash){if(!validHash(row.route,providedHash))throw Error('Invalid transaction reference.');if(row.hash&&row.hash!==providedHash)throw Error('Reference differs from the recorded transaction.');row.hash=providedHash;}
  const result=await this.adapter.confirm(row);row.status=result.status;row.detail=result.detail;row.checked=this.clock();saveRecord(row,this.storage);return row;
 }
}
