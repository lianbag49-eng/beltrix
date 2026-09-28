import {createWalletClient,http,toHex} from 'viem';
import {NETWORKS,network} from './wallet-data.js';

const EVENT_NAMES=new Set(['accountsChanged','chainChanged','disconnect','connect']);
const hexBig=value=>{
 if(value===undefined||value===null||value==='')return undefined;
 if(typeof value==='bigint')return value;
 if(typeof value==='number')return BigInt(value);
 const s=String(value);
 if(/^0x[0-9a-f]+$/i.test(s)||/^\d+$/.test(s))return BigInt(s);
 throw Error('Invalid transaction integer field.');
};
const hexNumber=value=>{
 const n=hexBig(value);
 if(n===undefined)return undefined;
 const out=Number(n);
 if(!Number.isSafeInteger(out)||out<0)throw Error('Transaction nonce is outside the supported range.');
 return out;
};
const same=(a,b)=>String(a||'').toLowerCase()===String(b||'').toLowerCase();
const rpcError=(message,code=-32603)=>Object.assign(Error(message),{code});

export function normalizeLocalTransaction(tx={},address){
 if(tx.from&&!same(tx.from,address))throw rpcError('Transaction sender does not match the unlocked BELTRIX wallet.',4100);
 const out={account:address};
 if(tx.to)out.to=tx.to;
 if(tx.data)out.data=tx.data;
 for(const key of ['value','gas','gasPrice','maxFeePerGas','maxPriorityFeePerGas'])if(tx[key]!==undefined)out[key]=hexBig(tx[key]);
 if(tx.nonce!==undefined)out.nonce=hexNumber(tx.nonce);
 if(tx.accessList!==undefined)out.accessList=tx.accessList;
 return out;
}

function walletNetwork(chainId){
 const row=NETWORKS.find(x=>x.chain.id===Number(chainId));
 if(!row)throw rpcError('Unsupported BELTRIX Local Wallet network.',4902);
 return row;
}

export function createBeltrixLocalProvider({
 account,
 initialChainId=1,
 fetchImpl=fetch,
 sendTransactionImpl=null
}={}){
 if(!account?.address||typeof account.signTypedData!=='function'||typeof account.signMessage!=='function')throw Error('BELTRIX Local Provider requires a local signing account.');
 let chainId=walletNetwork(initialChainId).chain.id;
 let locked=false;
 const listeners=new Map();

 const emit=(event,payload)=>{
  for(const fn of listeners.get(event)||[])try{fn(payload)}catch{}
 };
 const assertUnlocked=()=>{
  if(locked)throw rpcError('BELTRIX Wallet is locked.',4100);
 };
 const current=()=>walletNetwork(chainId);
 const forward=async(method,params=[])=>{
  const net=current();
  const response=await fetchImpl(net.rpc,{
   method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})
  });
  if(!response.ok)throw rpcError('Network RPC returned '+response.status);
  const body=await response.json();
  if(body?.error)throw rpcError(body.error.message||'Network RPC request failed.',body.error.code??-32603);
  return body?.result;
 };

 const provider={
  isBeltrixWallet:true,
  get chainId(){return chainId},
  get address(){return account.address},
  async request({method,params=[]}={}){
   const name=String(method||'');
   if(name==='eth_chainId')return toHex(chainId);
   if(name==='eth_accounts'||name==='eth_requestAccounts'){assertUnlocked();return [account.address]}
   if(name==='wallet_getPermissions'){assertUnlocked();return [{parentCapability:'eth_accounts',caveats:[]}]}
   if(name==='wallet_requestPermissions'){assertUnlocked();return [{parentCapability:'eth_accounts',caveats:[]}]}
   if(name==='wallet_switchEthereumChain'){
    assertUnlocked();
    const requested=Number(hexBig(params?.[0]?.chainId));
    const next=walletNetwork(requested);
    if(next.chain.id!==chainId){
     chainId=next.chain.id;
     emit('chainChanged',toHex(chainId));
    }
    return null;
   }
   if(name==='wallet_addEthereumChain'){
    assertUnlocked();
    const requested=Number(hexBig(params?.[0]?.chainId));
    walletNetwork(requested);
    if(requested!==chainId){
     chainId=requested;
     emit('chainChanged',toHex(chainId));
    }
    return null;
   }
   if(name==='eth_signTypedData_v4'){
    assertUnlocked();
    const signer=params?.[0],raw=params?.[1];
    if(!same(signer,account.address))throw rpcError('Typed-data signer does not match BELTRIX Wallet.',4100);
    let typed;
    try{typed=typeof raw==='string'?JSON.parse(raw):raw}catch{throw rpcError('Invalid typed-data payload.',-32602)}
    if(!typed||typeof typed!=='object')throw rpcError('Invalid typed-data payload.',-32602);
    return account.signTypedData(typed);
   }
   if(name==='personal_sign'){
    assertUnlocked();
    const raw=params?.[0],signer=params?.[1];
    if(signer&&!same(signer,account.address))throw rpcError('Message signer does not match BELTRIX Wallet.',4100);
    const message=typeof raw==='string'&&/^0x[0-9a-f]*$/i.test(raw)?{raw}:String(raw??'');
    return account.signMessage({message});
   }
   if(name==='eth_sign')throw rpcError('Legacy eth_sign is disabled by BELTRIX Wallet.',4200);
   if(name==='eth_sendTransaction'){
    assertUnlocked();
    const tx=normalizeLocalTransaction(params?.[0]||{},account.address);
    const net=current();
    if(sendTransactionImpl)return sendTransactionImpl({transaction:tx,account,network:net});
    const client=createWalletClient({account,chain:net.chain,transport:http(net.rpc,{retryCount:0,timeout:20000})});
    return client.sendTransaction(tx);
   }
   return forward(name,params||[]);
  },
  on(event,listener){
   if(!EVENT_NAMES.has(event)||typeof listener!=='function')return provider;
   if(!listeners.has(event))listeners.set(event,new Set());
   listeners.get(event).add(listener);return provider;
  },
  removeListener(event,listener){
   listeners.get(event)?.delete(listener);return provider;
  },
  lock(){
   if(locked)return;
   locked=true;
   emit('accountsChanged',[]);
   emit('disconnect',{code:4900,message:'BELTRIX Wallet locked'});
   listeners.clear();
  }
 };
 queueMicrotask(()=>emit('connect',{chainId:toHex(chainId)}));
 return Object.freeze(provider);
}

export function announceBeltrixProvider(provider,win=window){
 if(!provider?.request||!win?.dispatchEvent)return;
 const icon='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2214%22 fill=%22%23110f0c%22/%3E%3Cpath d=%22M16 15h24l8 8-8 8H24v18h-8z%22 fill=%22%23e6be72%22/%3E%3C/svg%3E';
 const detail={
  info:{uuid:'d15dfb41-9c8b-4ee8-b1fd-beltrixwallet',name:'BELTRIX Wallet',icon,rdns:'app.beltrix.wallet'},
  provider
 };
 win.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail}));
}
