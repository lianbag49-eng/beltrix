import {createWalletClient,custom,erc20Abi,encodeFunctionData,decodeFunctionResult,formatUnits,toHex,parseSignature,recoverTypedDataAddress} from 'viem';
import {address,same,hashOK,cleanText} from './wallet-core.js';
import {network,readClient} from './wallet-data.js';
import {fundingRoute,fundingAmount,rawUSDC,withdrawalPayload,BRIDGE_ABI,verifyDepositReceipt,creditedDepositMatches,finalizedWithdrawalMatches} from './funding-core.js';
import {readFundingJournal,saveFundingRecord,assertNoPendingFunding,fundingLock,TERMINAL} from './funding-journal.js';

// No keys, agents, approvals, auto-retries or background writes are used here.
export class FundingService {
 constructor({provider,account,env,assertCurrent,storage=localStorage,locks=navigator.locks,fetcher=fetch}){
  this.provider=provider;this.account=address(account);this.route=fundingRoute(env);
  this.assertCurrent=assertCurrent;this.storage=storage;this.locks=locks;this.fetcher=fetcher.bind(globalThis);
  this.client=readClient(network(this.route.chainId),provider);this.reviews=new WeakSet();
 }
 async guard(){
  this.assertCurrent();
  const [accounts,chain]=await Promise.all([this.provider.request({method:'eth_accounts'}),this.provider.request({method:'eth_chainId'})]);
  this.assertCurrent();
  if(!same(accounts?.[0],this.account)||Number(chain)!==this.route.chainId)throw Error('Funding wallet account or network changed. Connect and review again.');
 }
 async post(path,body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const r=await this.fetcher(this.route.api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
   if(!r.ok)throw Error('Venue response unavailable ('+r.status+').');return await r.json();
  }finally{clearTimeout(timer);}
 }
 info(body){return this.post('/info',body);}
 async bridgeCheck(){
  const r=this.route;
  const [paused,token,decimals,code]=await Promise.all([
   this.client.readContract({address:r.bridge,abi:BRIDGE_ABI,functionName:'paused'}),
   this.client.readContract({address:r.bridge,abi:BRIDGE_ABI,functionName:'usdcToken'}),
   this.client.readContract({address:r.usdc,abi:erc20Abi,functionName:'decimals'}),
   this.client.getCode({address:this.account})]);
  if(paused!==false)throw Error('Bridge is paused or its status is unavailable.');
  if(!same(token,r.usdc)||decimals!==6)throw Error('Bridge token or token precision does not match the documented route.');
  if(code&&code!=='0x')throw Error('Smart-contract and delegated wallets are not supported by this funding flow. Use the official venue.');
 }
 async withdrawable(){const p=await this.info({type:'clearinghouseState',user:this.account});return rawUSDC(p?.withdrawable);}
 async balances(){
  await this.guard();
  const all=await Promise.allSettled([
   this.client.readContract({address:this.route.usdc,abi:erc20Abi,functionName:'balanceOf',args:[this.account]}),
   this.withdrawable()]);
  await this.guard();return {wallet:all[0].status==='fulfilled'?formatUnits(all[0].value,6):null,withdrawable:all[1].status==='fulfilled'?formatUnits(all[1].value,6):null};
 }
 async depositCheck(quantity){
  const request={from:this.account,to:this.route.usdc,value:0n,data:encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[this.route.bridge,quantity]})};
  const [balance,native,gas,price,nonce,simulation]=await Promise.all([
   this.client.readContract({address:this.route.usdc,abi:erc20Abi,functionName:'balanceOf',args:[this.account]}),
   this.client.getBalance({address:this.account}),
   this.client.estimateGas({account:this.account,to:request.to,data:request.data,value:0n}),
   this.client.getGasPrice(),this.client.getTransactionCount({address:this.account,blockTag:'pending'}),
   this.client.call({account:this.account,to:request.to,data:request.data,value:0n})]);
  if(balance<quantity)throw Error('Insufficient native USDC on '+this.route.label+'.');
  if(gas<=0n||price<=0n)throw Error('Reliable network fee estimate is unavailable.');
  if(!simulation.data||decodeFunctionResult({abi:erc20Abi,functionName:'transfer',data:simulation.data})!==true)throw Error('USDC transfer simulation failed.');
  const gasLimit=(gas*120n+99n)/100n,gasPrice=(price*125n+99n)/100n,fee=gasLimit*gasPrice;
  if(native<fee)throw Error('Insufficient ETH for the network gas budget.');
  return {request,gas:gasLimit,gasPrice,fee,nonce};
 }
 async prepare(kind,value,destination=this.account){
  const quantity=fundingAmount(value,kind),recipient=kind==='deposit'?this.route.bridge:address(destination);
  if(kind==='withdraw')withdrawalPayload(this.route.env,recipient,quantity,Date.now());
  await this.guard();assertNoPendingFunding(this.account,this.route.env,this.storage);await this.bridgeCheck();
  let tx=null;
  if(kind==='deposit')tx=await this.depositCheck(quantity);
  else if(quantity>await this.withdrawable())throw Error('Amount exceeds currently withdrawable trading funds.');
  const block=await this.client.getBlockNumber();await this.guard();
  const review=Object.freeze({kind,quantity,recipient,tx:tx?Object.freeze({...tx,request:Object.freeze(tx.request)}):null,account:this.account,env:this.route.env,block:block.toString(),expires:Date.now()+60000});
  this.reviews.add(review);return review;
 }
 checkReview(review){if(!this.reviews.has(review)||Date.now()>=review.expires)throw Error('Funding review expired or is no longer valid. Review again.');this.assertCurrent();}
 async execute(review){
  this.checkReview(review);
  return fundingLock(this.account,this.route.env,async()=>{
   this.checkReview(review);await this.guard();assertNoPendingFunding(this.account,this.route.env,this.storage);await this.bridgeCheck();
   if(review.kind==='deposit'){
    const fresh=await this.depositCheck(review.quantity);
    if(fresh.nonce!==review.tx.nonce||fresh.gas>review.tx.gas||fresh.gasPrice>review.tx.gasPrice)throw Error('Nonce or network fees changed. Review the deposit again.');
   }else if(review.quantity>await this.withdrawable())throw Error('Withdrawable balance changed. Review again.');
   await this.guard();this.checkReview(review);
   const past=readFundingJournal(this.storage).filter(x=>x.kind==='withdraw').map(x=>x.nonce);
   const nonce=review.kind==='deposit'?review.tx.nonce:Math.max(Date.now(),...past.map(n=>n+1));
   const row={id:crypto.randomUUID(),kind:review.kind,env:this.route.env,account:this.account,recipient:review.recipient,quantity:review.quantity.toString(),nonce,created:Date.now(),block:review.block,status:'Signing',hash:null};
   saveFundingRecord(row,this.storage);this.reviews.delete(review);let sent=false;
   try{
    if(review.kind==='deposit'){
     const t=review.tx;
     sent=true;
     const hash=await this.provider.request({method:'eth_sendTransaction',params:[{from:this.account,to:t.request.to,value:'0x0',data:t.request.data,chainId:toHex(this.route.chainId),gas:toHex(t.gas),gasPrice:toHex(t.gasPrice),nonce:toHex(t.nonce)}]});
     if(!hashOK(hash))throw Error('Wallet did not return a valid deposit transaction hash.');
     row.hash=hash;row.status='Submitted';
    }else{
     const payload=withdrawalPayload(this.route.env,review.recipient,review.quantity,nonce);
     const wallet=createWalletClient({account:this.account,chain:network(this.route.chainId).chain,transport:custom(this.provider,{retryCount:0})});
     const signature=await wallet.signTypedData(payload.typed);
     // A late signature or changed wallet must never be forwarded to the venue.
     await this.guard();if(Date.now()>=review.expires)throw Error('Signature arrived after the review expired. Nothing was submitted.');
     if(!same(await recoverTypedDataAddress({...payload.typed,signature}),this.account))throw Error('Signature does not belong to the reviewed wallet.');
     if(review.quantity>await this.withdrawable())throw Error('Withdrawable balance changed while signing. Nothing was submitted.');
     await this.guard();if(Date.now()>=review.expires)throw Error('Review expired. Nothing was submitted.');
     const sig=parseSignature(signature);const v=Number(sig.v??BigInt(27+sig.yParity));
     if(v!==27&&v!==28)throw Error('Unsupported signature format.');
     sent=true;
     const response=await this.post('/exchange',{action:payload.action,nonce:payload.nonce,signature:{r:sig.r,s:sig.s,v}});
     if(response.status==='err'){row.status='Rejected';throw Error('Venue rejected withdrawal: '+cleanText(response.response,180));}
     if(response.status!=='ok'||response.response?.type!=='default')throw Error('Withdrawal acknowledgement is unconfirmed. Do not resend.');
     row.status='Awaiting settlement';
    }
    row.updated=Date.now();saveFundingRecord(row,this.storage);return row;
   }catch(e){
    const rejected=e?.code===4001||e?.cause?.code===4001||e?.cause?.cause?.code===4001;
    if(row.status!=='Rejected')row.status=rejected?'Rejected':sent?'Unknown':'Not submitted';
    row.error=cleanText(e?.shortMessage||e?.message,220);row.updated=Date.now();saveFundingRecord(row,this.storage);
    throw Error(row.error+(row.status==='Unknown'?' Check Funding history. Do not repeat this request.':''));
   }
  },this.locks);
 }
 async ledger(){const rows=await this.info({type:'userNonFundingLedgerUpdates',user:this.account,startTime:Date.now()-30*86400000});if(!Array.isArray(rows))throw Error('Funding ledger unavailable.');return rows.slice(-100).reverse();}
 async reconcile(id,providedHash=''){
  return fundingLock(this.account,this.route.env,async()=>{
   const row=readFundingJournal(this.storage).find(r=>r.id===id&&r.env===this.route.env&&same(r.account,this.account));
   if(!row)throw Error('Funding record not found for this account.');if(TERMINAL.has(row.status))return row;
   // Verify on the record's chain even if the browser's signing chain changed.
   const client=readClient(network(this.route.chainId));
   const hash=providedHash.trim()||row.hash;
   if(hash&&!hashOK(hash))throw Error('Enter a valid transaction hash.');
   if(row.kind==='deposit'){
    if(!hash)throw Error('Find the deposit hash in your wallet activity and paste it here.');
    const [tx,receipt]=await Promise.all([client.getTransaction({hash}),client.getTransactionReceipt({hash})]);
    row.status=verifyDepositReceipt(row,tx,receipt);row.hash=hash;
    if(row.status==='Awaiting credit'){
     try{const ledger=await this.info({type:'userNonFundingLedgerUpdates',user:row.account,startTime:row.created-60000});
      if(Array.isArray(ledger)&&ledger.some(x=>creditedDepositMatches(row,x)))row.status='Credited';
      else row.note='Arbitrum confirmed. A matching Hyperliquid credit has not been verified.';
     }catch{row.note='Arbitrum confirmed; Hyperliquid credit lookup is unavailable.';}
    }
   }else{
    let logs=[];
    if(hash){const receipt=await client.getTransactionReceipt({hash});if(receipt.status!=='success')throw Error('Withdrawal settlement transaction is not successful.');logs=receipt.logs;}
    else{const tip=await client.getBlockNumber(),start=BigInt(row.block),from=start>tip-2000n?start:tip>2000n?tip-2000n:0n;
     logs=await client.getLogs({address:this.route.bridge,event:BRIDGE_ABI.find(x=>x.type==='event'),args:{user:row.account},fromBlock:from,toBlock:tip});}
    const exact=logs.find(l=>finalizedWithdrawalMatches(row,l));
    if(exact){row.status='Settled';row.hash=hash||exact.transactionHash;row.note='Exact bridge finalization matched account, destination, amount and withdrawal nonce.';}
    else throw Error('Exact withdrawal settlement not yet verified. Recent scan covers at most 2,000 blocks; paste the settlement hash for older activity. Do not resend.');
   }
   row.updated=Date.now();saveFundingRecord(row,this.storage);return row;
  },this.locks);
 }
}
