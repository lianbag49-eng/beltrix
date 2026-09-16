import {TronWeb,utils as tronUtils} from 'tronweb';
import {usdtRoute,TRANSFER_TOPIC} from './usdt-registry.js';
import {canonical,validHash,safeInteger} from './usdt-core.js';
const hex=a=>TronWeb.address.toHex(a).toLowerCase();
const base58=a=>/^41[0-9a-f]{40}$/i.test(a||'')?TronWeb.address.fromHex(a):a;
export const tronTransferData=(recipient,raw)=>'a9059cbb'+hex(recipient).slice(2).padStart(64,'0')+raw.toString(16).padStart(64,'0');
export function validateTronTransfer(tx,{account,recipient,quantity,feeLimit},now=Date.now()){
 if(!tx||typeof tx.raw_data_hex!=='string'||tx.raw_data_hex.length>4096||!validHash('tron',tx.txID)||!tronUtils.transaction.txCheck(tx))throw Error('TRON transaction bytes and hash do not match.');
 const r=tx.raw_data,c=r?.contract?.[0],v=c?.parameter?.value;
 if(!/^[0-9a-f]{4}$/i.test(r.ref_block_bytes||'')||!/^[0-9a-f]{16}$/i.test(r.ref_block_hash||''))throw Error('Invalid TRON block reference.');
 if(r.contract.length!==1||c.type!=='TriggerSmartContract'||c.parameter.type_url!=='type.googleapis.com/protocol.TriggerSmartContract'||(c.Permission_id??c.permission_id??0)!==0)throw Error('Only one owner-authorized TRC-20 transfer is allowed.');
 if(hex(base58(v.owner_address))!==hex(account)||hex(base58(v.contract_address))!==hex(usdtRoute('tron').token)||v.data?.toLowerCase()!==tronTransferData(recipient,quantity)||(v.call_value||0)!==0||(v.call_token_value||0)!==0||(v.token_id||0)!==0)throw Error('TRON transaction changed the sender, token, recipient, amount or call.');
 if(safeInteger(r.fee_limit,'TRON fee limit')!==feeLimit||r.data||!Number.isSafeInteger(r.expiration)||r.expiration<=now||r.expiration>now+180000||!Number.isSafeInteger(r.timestamp)||Math.abs(now-r.timestamp)>180000)throw Error('Unexpected TRON fee limit, memo or expiration.');
 return tx;
}
export class TronUsdtAdapter {
 constructor(account,connection=null,client=null,fetcher=globalThis.fetch?.bind(globalThis)){
  this.route=usdtRoute('tron');this.account=canonical('tron',account);this.connection=connection;
  this.client=client||new TronWeb({fullHost:this.route.rpc});this.client.setAddress?.(this.account);this.fetcher=fetcher;
 }
 wallet(){const web=this.connection?.web?.();if(!web?.trx?.sign)throw Error('Connect a TRON wallet with transaction signing support.');return web;}
 async guard(){
  const wallet=this.wallet();if(wallet.defaultAddress?.base58!==this.account)throw Error('TRON account changed. Reconnect and review.');
  const [selected,expected]=await Promise.all([wallet.trx.getBlock(0),this.client.trx.getBlock(0)]);
  if(!/^[0-9a-f]{64}$/i.test(expected?.blockID||'')||selected?.blockID!==expected.blockID)throw Error('Switch your TRON wallet to Mainnet.');
  if(this.wallet()!==wallet||wallet.defaultAddress.base58!==this.account)throw Error('TRON wallet changed during network verification.');
 }
 async constant(selector,parameters=[]){
  const result=await this.client.transactionBuilder.triggerConstantContract(this.route.token,selector,{},parameters,this.account);
  if(result?.result?.result!==true)throw Error('TRON contract simulation was rejected or unavailable.');return result;
 }
 async balances(){
  const [d,b,native]=await Promise.all([this.constant('decimals()'),this.constant('balanceOf(address)',[{type:'address',value:this.account}]),this.client.trx.getBalance(this.account)]);
  if(!/^[0-9a-f]{64}$/i.test(d.constant_result?.[0]||'')||BigInt('0x'+d.constant_result[0])!==6n||!/^[0-9a-f]{64}$/i.test(b.constant_result?.[0]||''))throw Error('TRON USDT decimals or balance response is invalid.');
  return {raw:BigInt('0x'+b.constant_result[0]),native:BigInt(safeInteger(native,'TRX balance')),updated:Date.now()};
 }
 async estimate(recipient,quantity){
  const [holdings,simulation,params,owner]=await Promise.all([this.balances(),this.constant('transfer(address,uint256)',[{type:'address',value:recipient},{type:'uint256',value:quantity.toString()}]),this.client.trx.getChainParameters(),this.client.trx.getAccount(this.account)]);
  if(quantity>holdings.raw)throw Error('Insufficient TRON USDT.');
  if(simulation.constant_result?.[0]&&BigInt('0x'+simulation.constant_result[0])!==1n)throw Error('TRON USDT transfer returned failure.');
  if(owner.type==='Contract'||owner.owner_permission&&(owner.owner_permission.threshold!==1||owner.owner_permission.keys?.length!==1||hex(base58(owner.owner_permission.keys[0].address))!==hex(this.account)||owner.owner_permission.keys[0].weight!==1))throw Error('TRON multisignature/permission-managed accounts are not supported.');
  const energy=safeInteger(simulation.energy_used,'Energy estimate'),energyPrice=safeInteger(params.find(x=>x.key==='getEnergyFee')?.value,'Energy price'),bandwidthPrice=safeInteger(params.find(x=>x.key==='getTransactionFee')?.value,'Bandwidth price');
  if(!energy||!energyPrice||!bandwidthPrice)throw Error('TRON resource fee data is unavailable.');
  const feeLimit=Math.ceil(energy*1.3)*energyPrice,bandwidth=1500*bandwidthPrice,fee=BigInt(feeLimit+bandwidth);
  if(!Number.isSafeInteger(feeLimit)||feeLimit<=0||feeLimit>300000000)throw Error('TRON Energy budget exceeds the 300 TRX safety cap.');
  if(holdings.native<fee)throw Error('Insufficient TRX for the conservative Energy and Bandwidth budget. Staked resources are not deducted from this estimate.');
  return {feeLimit,fee};
 }
 async prepare(recipient,quantity){
  await this.guard();const estimate=await this.estimate(recipient,quantity);
  const result=await this.client.transactionBuilder.triggerSmartContract(this.route.token,'transfer(address,uint256)',{feeLimit:estimate.feeLimit,callValue:0},[{type:'address',value:recipient},{type:'uint256',value:quantity.toString()}],this.account);
  if(result?.result?.result!==true)throw Error('TRON transfer construction failed.');
  const tx=validateTronTransfer(result.transaction,{account:this.account,recipient,quantity,feeLimit:estimate.feeLimit});
  if(tx.signature?.length)throw Error('Unsigned transaction was already signed.');await this.guard();
  return {recipient,quantity,...estimate,expires:tx.raw_data.expiration-1000,feeLabel:'Conservative TRX budget: 30% Energy buffer + up to 1,500 bytes of Bandwidth. Resource discounts are not assumed.',transaction:tx,proof:{raw:tx.raw_data_hex,expectedHash:tx.txID,feeLimit:estimate.feeLimit}};
 }
 async recheck(plan){
  await this.guard();validateTronTransfer(plan.transaction,{...plan,account:this.account});const fresh=await this.estimate(plan.recipient,plan.quantity);
  if(fresh.feeLimit>plan.feeLimit||fresh.fee>plan.fee)throw Error('TRON resource requirements changed. Review again.');
 }
 async submit(plan,hooks){
  const wallet=this.wallet();const signed=await wallet.trx.sign(structuredClone(plan.transaction));
  hooks.assertCurrent();await this.guard();await this.recheck(plan);hooks.assertCurrent();
  validateTronTransfer(signed,{...plan,account:this.account});
  if(signed.raw_data_hex!==plan.transaction.raw_data_hex||signed.txID!==plan.transaction.txID||signed.signature?.length!==1||!/^([0-9a-f]{130})$/i.test(signed.signature[0])||hex(TronWeb.address.fromHex(tronUtils.crypto.ecRecover(signed.txID,signed.signature[0])))!==hex(this.account))throw Error('TRON signed bytes or signature do not match the reviewed transfer.');
  await hooks.beforeBroadcast(signed.txID);
  const result=await this.client.trx.sendRawTransaction(signed);
  if(result?.result!==true||result.txid&&result.txid!==signed.txID)throw Error('TRON broadcast outcome is unconfirmed. Reconcile the recorded transaction ID.');return signed.txID;
 }
 async confirm(row){
  const hash=row.hash||row.proof?.expectedHash;if(!validHash('tron',hash))throw Error('Missing TRON transaction ID.');
  const [tx,info]=await Promise.all([this.client.trx.getConfirmedTransaction(hash),this.client.trx.getTransactionInfo(hash)]);
  if(tx.txID!==hash||tx.raw_data_hex!==row.proof?.raw||!tronUtils.transaction.txCheck(tx)||info?.id!==hash)throw Error('Solidified TRON transaction does not match the reviewed bytes.');
  if(info.receipt?.result&&info.receipt.result!=='SUCCESS'||tx.ret?.[0]?.contractRet&&tx.ret[0].contractRet!=='SUCCESS')return {status:'Failed',detail:'TRON contract execution failed.'};
  if(!Number.isSafeInteger(info.blockNumber)||info.receipt?.result!=='SUCCESS')return {status:'Submitted',detail:'Waiting for solidified execution receipt.'};
  const match=(info.log||[]).filter(log=>log.address?.toLowerCase()===hex(this.route.token).slice(2)&&log.topics?.length===3&&log.topics[0]?.toLowerCase()===TRANSFER_TOPIC&&log.topics[1]?.toLowerCase()===hex(row.account).slice(2).padStart(64,'0')&&log.topics[2]?.toLowerCase()===hex(row.recipient).slice(2).padStart(64,'0')&&/^[0-9a-f]{64}$/i.test(log.data||'')&&BigInt('0x'+log.data)===BigInt(row.quantity));
  if(match.length!==1)throw Error('No unique matching TRON USDT Transfer event.');return {status:'Confirmed',detail:'Solidified TRON transfer with exact token and amount verified.'};
 }
 async recent(){
  const url=this.route.rpc+'/v1/accounts/'+this.account+'/transactions/trc20?limit=20&only_confirmed=true&contract_address='+this.route.token;
  const response=await this.fetcher(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('TRON history service unavailable ('+response.status+').');const data=await response.json();
  if(!Array.isArray(data.data))throw Error('TRON history is incomplete.');
  const rows=data.data.filter(x=>x.type==='Transfer'&&x.token_info?.address===this.route.token&&Number(x.token_info?.decimals)===6&&/^\d{1,78}$/.test(x.value||'')&&validHash('tron',x.transaction_id)&&(x.from===this.account||x.to===this.account));
  return {scope:'Up to 20 confirmed transfers from TronGrid. Not complete history.',rows:rows.map(x=>({hash:x.transaction_id,amount:x.value,incoming:x.to===this.account,detail:new Date(x.block_timestamp).toLocaleString()}))};
 }
}
