import {Connection,PublicKey,Transaction,VersionedTransaction,SystemProgram,ComputeBudgetProgram} from '@solana/web3.js';
import {Buffer} from 'buffer';
import bs58 from 'bs58';
import {usdtRoute} from './usdt-registry.js';
import {canonical,safeInteger,validHash} from './usdt-core.js';
import {TOKEN_PROGRAM,associated,decodeMint,decodeToken,createATA,checkedTransfer} from './usdt-solana-token.js';

export const SOLANA_MAINNET_GENESIS='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const b64=b=>Buffer.from(b).toString('base64');
const key=s=>new PublicKey(s);
export class SolanaUsdtAdapter {
 constructor(account,provider=null,client=null){this.route=usdtRoute('solana');this.account=canonical('solana',account);this.provider=provider;this.client=client||new Connection(this.route.rpc,{commitment:'confirmed',disableRetryOnRateLimit:true});this.owner=key(this.account);this.mint=key(this.route.token);}
 async network(){if(await this.client.getGenesisHash()!==SOLANA_MAINNET_GENESIS)throw Error('RPC is not Solana mainnet. No request will be signed.');}
 async guard(){if(!this.provider?.signTransaction||canonical('solana',this.provider.publicKey?.toString())!==this.account)throw Error('Connect the selected Solana account in a signing wallet.');await this.network();if(this.provider.publicKey?.toString()!==this.account)throw Error('Solana account changed.');}
 async balances(){
  await this.network();const [mint,rows,native]=await Promise.all([this.client.getAccountInfo(this.mint,'confirmed'),this.client.getTokenAccountsByOwner(this.owner,{mint:this.mint},'confirmed'),this.client.getBalance(this.owner,'confirmed')]);
  if(decodeMint(mint).decimals!==6)throw Error('Unexpected Solana USDT precision.');
  if(!Array.isArray(rows.value)||rows.value.length>100)throw Error('Too many or malformed USDT accounts.');
  const accounts=rows.value.map(x=>{const t=decodeToken(x.account);if(!t.mint.equals(this.mint)||!t.owner.equals(this.owner))throw Error('RPC returned a different owner or mint.');return {address:x.pubkey.toBase58(),amount:t.amount,frozen:t.frozen};}).sort((a,b)=>a.address.localeCompare(b.address));
  return {raw:accounts.filter(x=>!x.frozen).reduce((v,x)=>v+x.amount,0n),native:BigInt(safeInteger(native,'SOL balance')),accounts,locked:accounts.filter(x=>x.frozen).reduce((v,x)=>v+x.amount,0n)};
 }
 async recipient(to){
  const entered=key(to),info=await this.client.getAccountInfo(entered,'confirmed');
  if(info?.executable)throw Error('Recipient is an executable program.');
  if(info?.owner.equals(TOKEN_PROGRAM)){
   const t=decodeToken(info);if(!t.mint.equals(this.mint)||t.frozen)throw Error('Recipient token account has a different mint or is frozen.');
   if(t.owner.equals(this.owner))throw Error('Recipient token account belongs to the sending wallet.');
   return {token:entered,owner:t.owner,create:false,direct:true};
  }
  if(!PublicKey.isOnCurve(entered.toBytes())||(info&&!info.owner.equals(SystemProgram.programId)))throw Error('Use a normal Solana wallet or an existing USDT token account.');
  const ata=associated(entered,this.mint),ataInfo=await this.client.getAccountInfo(ata,'confirmed');
  if(ataInfo){const t=decodeToken(ataInfo);if(!t.mint.equals(this.mint)||!t.owner.equals(entered)||t.frozen)throw Error('Destination associated token account is invalid or frozen.');}
  return {token:ata,owner:entered,create:!ataInfo,direct:false};
 }
 async prepare(to,raw){
  await this.guard();const [balance,destination,latest]=await Promise.all([this.balances(),this.recipient(to),this.client.getLatestBlockhash('confirmed')]);
  if(raw>balance.raw)throw Error('Insufficient spendable Solana USDT.');
  let remaining=raw;const sources=[];
  for(const x of balance.accounts){if(x.frozen||!x.amount)continue;const value=x.amount<remaining?x.amount:remaining;if(value){sources.push({address:x.address,amount:value.toString()});remaining-=value;}if(!remaining)break;}
  if(remaining||sources.length>8)throw Error('This transfer requires too many token accounts. Consolidate your USDT first.');
  const rent=destination.create?BigInt(safeInteger(await this.client.getMinimumBalanceForRentExemption(165,'confirmed'),'rent')):0n;
  const tx=new Transaction({feePayer:this.owner,recentBlockhash:latest.blockhash});
  // A bounded, explicit priority fee. Never take a fee from QR input or a third party.
  const computeLimit=Math.min(400000,60000+sources.length*25000);
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({units:computeLimit}),ComputeBudgetProgram.setComputeUnitPrice({microLamports:10000n}));
  if(destination.create)tx.add(createATA(this.owner,destination.owner,this.mint));
  for(const source of sources)tx.add(checkedTransfer(key(source.address),this.mint,destination.token,this.owner,BigInt(source.amount),6));
  const message=tx.compileMessage();const feeReply=await this.client.getFeeForMessage(message,'confirmed');if(feeReply.value===null)throw Error('Solana fee or blockhash is unavailable. Review again.');
  const fee=BigInt(safeInteger(feeReply.value,'Solana network fee'));
  if(fee<=0n||balance.native<fee+rent)throw Error('Insufficient SOL for network fee and any new token-account rent.');
  const sim=await this.client.simulateTransaction(new VersionedTransaction(message),{sigVerify:false,replaceRecentBlockhash:false,commitment:'confirmed'});
  if(sim.value?.err)throw Error('USDT transfer simulation failed. Nothing was sent.');
  return {recipient:to,quantity:raw,fee,extraFee:rent,feeLabel:'SOL fee including a bounded priority fee; token-account rent is shown separately.',recipientDetail:(destination.direct?'Token account owned by ':'Wallet owner: ')+destination.owner.toBase58(),unsigned:b64(tx.serialize({requireAllSignatures:false,verifySignatures:false})),proof:{message:b64(message.serialize()),token:this.route.token,destination:destination.token.toBase58(),recipientOwner:destination.owner.toBase58(),sources,blockhash:latest.blockhash,lastValidBlockHeight:safeInteger(latest.lastValidBlockHeight,'block height'),rent:rent.toString(),fee:fee.toString()}};
 }
 async recheck(review){
  await this.guard();const [balance,height,recipient]=await Promise.all([this.balances(),this.client.getBlockHeight('confirmed'),this.recipient(review.recipient)]);
  if(height>review.proof.lastValidBlockHeight-2)throw Error('Solana blockhash is expiring. Prepare a new review.');
  if(recipient.token.toBase58()!==review.proof.destination||recipient.owner.toBase58()!==review.proof.recipientOwner)throw Error('Destination token account changed.');
  if(balance.native<review.fee+review.extraFee)throw Error('SOL balance changed. Review again.');
  for(const source of review.proof.sources){const row=balance.accounts.find(x=>x.address===source.address);if(!row||row.frozen||row.amount<BigInt(source.amount))throw Error('USDT source balance changed.');}
  const tx=Transaction.from(Buffer.from(review.unsigned,'base64'));if(b64(tx.serializeMessage())!==review.proof.message)throw Error('Reviewed Solana message changed.');
  const sim=await this.client.simulateTransaction(new VersionedTransaction(tx.compileMessage()),{sigVerify:false,replaceRecentBlockhash:false,commitment:'confirmed'});if(sim.value?.err)throw Error('Transfer is no longer executable.');
 }
 async submit(review,hooks){
  await this.guard();hooks.assertCurrent();let signed;
  try{signed=await this.provider.signTransaction(Transaction.from(Buffer.from(review.unsigned,'base64')));}catch(e){if(e?.code===4001)e.usdtRejected=true;throw e;}
  hooks.assertCurrent();await this.recheck(review);hooks.assertCurrent();
  if(!signed?.serializeMessage||b64(signed.serializeMessage())!==review.proof.message||signed.signatures?.length!==1||!signed.signatures[0].publicKey.equals(this.owner)||!signed.verifySignatures())throw Error('Wallet returned a changed message or invalid Solana signature.');
  const hash=bs58.encode(signed.signature),bytes=signed.serialize();if(!validHash('solana',hash))throw Error('Invalid Solana signature.');
  await hooks.beforeBroadcast(hash);const returned=await this.client.sendRawTransaction(bytes,{skipPreflight:false,maxRetries:0,preflightCommitment:'confirmed'});
  if(returned!==hash)throw Error('RPC returned a different Solana signature. Check History.');return hash;
 }
 async confirm(row){
  if(!row.hash)return {status:'Unknown',detail:'Find the original transaction signature in your wallet. Never resend an uncertain transfer.'};
  await this.network();const tx=await this.client.getTransaction(row.hash,{commitment:'finalized',maxSupportedTransactionVersion:0});
  if(!tx)return {status:'Submitted',detail:'Not yet finalized or RPC has no record. No automatic retry.'};
  if(tx.transaction.signatures[0]!==row.hash||b64(tx.transaction.message.serialize())!==row.proof?.message)throw Error('Transaction does not match the exact reviewed Solana message.');
  if(!tx.meta)throw Error('Transaction metadata is unavailable.');
  if(tx.meta.err)return {status:'Failed',detail:'Exact reviewed transaction finalized with an error; network fees may still apply.'};
  return {status:'Confirmed',detail:'Exact reviewed USDT transfer finalized successfully on Solana.'};
 }
 async recent(){
  const balance=await this.balances(),signatures=new Map();
  for(const a of balance.accounts.slice(0,3)){const rows=await this.client.getSignaturesForAddress(key(a.address),{limit:5},'finalized');for(const r of rows)if(validHash('solana',r.signature))signatures.set(r.signature,r);}
  const output=[];
  for(const [hash,row] of [...signatures].slice(0,8)){
   const tx=await this.client.getTransaction(hash,{commitment:'finalized',maxSupportedTransactionVersion:0});if(!tx?.meta||tx.meta.err)continue;
   const sum=list=>(list||[]).filter(t=>t.mint===this.route.token&&t.owner===this.account&&t.uiTokenAmount?.decimals===6).reduce((v,t)=>v+BigInt(t.uiTokenAmount.amount),0n);
   const delta=sum(tx.meta.postTokenBalances)-sum(tx.meta.preTokenBalances);if(!delta)continue;
   output.push({hash,direction:delta>0n?'Net received':'Net sent',quantity:(delta<0n?-delta:delta).toString(),time:row.blockTime?row.blockTime*1000:null});
  }
  return {rows:output,partial:true,detail:'Recent net USDT changes from up to 3 currently owned token accounts; not complete wallet history. Swap activity can be included.'};
 }
}
