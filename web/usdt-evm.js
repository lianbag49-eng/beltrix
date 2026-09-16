import {createPublicClient,http,erc20Abi,encodeFunctionData,decodeFunctionResult,decodeEventLog,toHex,parseAbiItem} from 'viem';
import {usdtRoute} from './usdt-registry.js';
import {canonical,equalAddress,validHash,safeInteger} from './usdt-core.js';

export class EvmUsdtAdapter {
 constructor(routeId,account,provider=null,client=null){
  this.route=usdtRoute(routeId);if(this.route.family!=='evm')throw Error('Expected EVM route.');
  this.account=canonical(routeId,account);this.provider=provider;
  const r=this.route;
  this.client=client||createPublicClient({chain:{id:r.chainId,name:r.name,nativeCurrency:{name:r.native,symbol:r.native,decimals:18},rpcUrls:{default:{http:[r.rpc]}}},transport:http(r.rpc,{retryCount:0,timeout:12000})});
 }
 async network(){if(await this.client.getChainId()!==this.route.chainId)throw Error('RPC returned the wrong network.');}
 async guard(){
  if(!this.provider?.request)throw Error('Connect a signing wallet for this network.');
  const [accounts,chain]=await Promise.all([this.provider.request({method:'eth_accounts'}),this.provider.request({method:'eth_chainId'})]);
  if(!equalAddress(this.route.id,accounts?.[0],this.account)||Number(chain)!==this.route.chainId)throw Error('Wallet account or network changed. Reconnect and review again.');
 }
 async balances(){
  await this.network();const r=this.route;
  const [decimals,raw,native]=await Promise.all([this.client.readContract({address:r.token,abi:erc20Abi,functionName:'decimals'}),this.client.readContract({address:r.token,abi:erc20Abi,functionName:'balanceOf',args:[this.account]}),this.client.getBalance({address:this.account})]);
  if(decimals!==r.decimals||typeof raw!=='bigint'||raw<0n||typeof native!=='bigint'||native<0n)throw Error('Token identity, precision or balance response is invalid.');
  return {raw,native,updated:Date.now()};
 }
 async prepare(recipient,quantity){
  await this.guard();const r=this.route,holdings=await this.balances();
  if(quantity>holdings.raw)throw Error('Insufficient '+r.symbol+' on '+r.name+'.');
  const code=await this.client.getCode({address:this.account});if(code&&code!=='0x')throw Error('This send flow requires a directly signing EOA, not a smart or delegated account.');
  const request={to:r.token,value:0n,data:encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[recipient,quantity]})};
  const [gas,price,nonce,simulation,destinationCode]=await Promise.all([
   this.client.estimateGas({account:this.account,...request}),this.client.getGasPrice(),this.client.getTransactionCount({address:this.account,blockTag:'pending'}),this.client.call({account:this.account,...request}),this.client.getCode({address:recipient})]);
  // Ethereum USDT is a legacy ERC-20: a successful call can return no bytes.
  if(simulation.data&&simulation.data!=='0x'&&decodeFunctionResult({abi:erc20Abi,functionName:'transfer',data:simulation.data})!==true)throw Error('Token transfer simulation failed.');
  if(gas<=0n||price<=0n)throw Error('Reliable network gas estimate is unavailable.');
  const gasLimit=(gas*125n+99n)/100n,gasPrice=(price*130n+99n)/100n,fee=gasLimit*gasPrice;
  if(holdings.native<fee)throw Error('Insufficient '+r.native+' for the estimated gas budget.');
  await this.guard();
  return {recipient,quantity,fee,feeLabel:'Buffered gas estimate; L2 data fees may be additional. Check the wallet total.',contractRecipient:!!destinationCode&&destinationCode!=='0x',request:{...request,gas:gasLimit,gasPrice,nonce:safeInteger(nonce,'account nonce')},proof:{nonce,data:request.data,token:r.token}};
 }
 async recheck(plan){
  const fresh=await this.prepare(plan.recipient,plan.quantity);
  if(fresh.request.nonce!==plan.request.nonce||fresh.request.gas>plan.request.gas||fresh.request.gasPrice>plan.request.gasPrice)throw Error('Nonce or network gas requirements changed. Review again.');
 }
 async submit(plan,hooks){
  await this.guard();hooks.assertCurrent();await hooks.beforeBroadcast(null);
  const p=plan.request;let hash;
  try{hash=await this.provider.request({method:'eth_sendTransaction',params:[{from:this.account,to:p.to,value:'0x0',data:p.data,chainId:toHex(this.route.chainId),gas:toHex(p.gas),gasPrice:toHex(p.gasPrice),nonce:toHex(p.nonce)}]});}
  catch(e){if(e?.code===4001||e?.cause?.code===4001)e.usdtRejected=true;throw e;}
  if(!validHash(this.route.id,hash))throw Error('Wallet returned no verifiable transaction hash. Check its activity; do not repeat the transfer.');
  return hash;
 }
 async confirm(row){
  if(!validHash(this.route.id,row.hash))throw Error('Provide the matching transaction hash from your wallet.');
  await this.network();
  const [tx,receipt,head]=await Promise.all([this.client.getTransaction({hash:row.hash}),this.client.getTransactionReceipt({hash:row.hash}),this.client.getBlockNumber()]);
  if(!equalAddress(this.route.id,tx.from,row.account)||!equalAddress(this.route.id,tx.to,this.route.token)||tx.nonce!==row.proof?.nonce||tx.input?.toLowerCase()!==row.proof?.data?.toLowerCase()||tx.value!==0n)throw Error('Transaction does not match the reviewed sender, token, nonce and transfer.');
  if(receipt.transactionHash?.toLowerCase()!==row.hash.toLowerCase()||!equalAddress(this.route.id,receipt.from,row.account)||!equalAddress(this.route.id,receipt.to,this.route.token))throw Error('Receipt identity does not match.');
  if(receipt.status==='reverted')return {status:'Failed',detail:'Reverted on the selected network.'};
  if(receipt.status!=='success'||receipt.blockNumber===null)return {status:'Submitted',detail:'Waiting for a successful receipt.'};
  const matches=receipt.logs.filter(log=>{
   if(!equalAddress(this.route.id,log.address,this.route.token))return false;
   try{const e=decodeEventLog({abi:erc20Abi,eventName:'Transfer',data:log.data,topics:log.topics});return equalAddress(this.route.id,e.args.from,row.account)&&equalAddress(this.route.id,e.args.to,row.recipient)&&e.args.value===BigInt(row.quantity);}catch{return false;}
  });
  if(matches.length!==1)throw Error('A successful receipt has no unique matching USDT Transfer event.');
  const confirmations=head-receipt.blockNumber+1n;
  return {status:confirmations>=2n?'Confirmed':'Submitted',detail:`${confirmations} block confirmation(s); this is not a claim of L1 finality.`};
 }
 async recent(){
  await this.network();const head=await this.client.getBlockNumber(),fromBlock=head>2000n?head-2000n:0n;
  const event=parseAbiItem('event Transfer(address indexed from,address indexed to,uint256 value)');
  const pages=await Promise.all([this.client.getLogs({address:this.route.token,event,args:{from:this.account},fromBlock,toBlock:head}),this.client.getLogs({address:this.route.token,event,args:{to:this.account},fromBlock,toBlock:head})]);
  const rows=[...new Map(pages.flat().filter(x=>!x.removed).map(x=>[x.transactionHash+':'+x.logIndex,x])).values()].sort((a,b)=>a.blockNumber>b.blockNumber?-1:1).slice(0,20);
  return {scope:'Recent 2,000 blocks only. Not your complete history.',rows:rows.map(x=>({hash:x.transactionHash,amount:x.args.value.toString(),incoming:equalAddress(this.route.id,x.args.to,this.account),detail:'Block '+x.blockNumber}))};
 }
}
