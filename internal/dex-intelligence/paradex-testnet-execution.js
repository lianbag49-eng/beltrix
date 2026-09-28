export const PARADEX_TESTNET_BASE='https://api.testnet.paradex.trade';
export const PARADEX_MAINNET_BASE='https://api.prod.paradex.trade';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const ORDER_TYPES=new Set(['MARKET','LIMIT','STOP_LIMIT','STOP_MARKET','TAKE_PROFIT_LIMIT','TAKE_PROFIT_MARKET','STOP_LOSS_LIMIT','STOP_LOSS_MARKET']);
const SIDES=new Set(['BUY','SELL']);

function base64Utf8(value){
 if(typeof Buffer!=='undefined')return Buffer.from(String(value),'utf8').toString('base64');
 const bytes=new TextEncoder().encode(String(value));
 let s='';for(const b of bytes)s+=String.fromCharCode(b);
 return btoa(s);
}

export function buildParadexSiweMessage({
 address,
 nonce,
 issuedAt,
 expirationTime,
 chainId=1,
 domain='app.paradex.trade',
 uri='https://app.paradex.trade'
}={}){
 const account=String(address||'').trim();
 if(!/^0x[0-9a-fA-F]{40}$/.test(account))throw Error('Valid EVM address is required for Paradex SIWE authentication.');
 const n=String(nonce||'').trim();
 if(!/^[0-9A-Za-z_-]{8,128}$/.test(n))throw Error('Paradex SIWE nonce is invalid.');
 const issued=new Date(issuedAt||Date.now()),expires=new Date(expirationTime||issued.getTime()+5*60*1000);
 if(!Number.isFinite(issued.getTime())||!Number.isFinite(expires.getTime())||expires<=issued)throw Error('Invalid Paradex SIWE timestamps.');
 return [
  domain+' wants you to sign in with your Ethereum account:',
  account,
  '',
  'Paradex Auth',
  '',
  'URI: '+uri,
  'Version: 1',
  'Chain ID: '+Number(chainId),
  'Nonce: '+n,
  'Issued At: '+issued.toISOString(),
  'Expiration Time: '+expires.toISOString()
 ].join('\n');
}

export async function authenticateParadexEvm({
 provider,
 paradexAccount,
 address,
 nonce,
 now=Date.now(),
 fetchImpl=fetch,
 baseUrl=PARADEX_TESTNET_BASE
}={}){
 const base=String(baseUrl||'').replace(/\/+$/,'');
 if(base!==PARADEX_TESTNET_BASE)throw Error('BELTRIX Paradex execution client is testnet-only until E2E qualification passes.');
 if(!provider?.request)throw Error('EIP-1193 provider is required for Paradex EVM authentication.');
 const account=String(address||'').trim();
 const starknetAccount=String(paradexAccount||'').trim();
 if(!/^0x[0-9a-fA-F]+$/.test(starknetAccount))throw Error('Paradex Starknet account address is required.');
 const issuedAt=new Date(Number(now));
 const expirationTime=new Date(Number(now)+5*60*1000);
 const message=buildParadexSiweMessage({address:account,nonce,issuedAt,expirationTime});
 const signature=await provider.request({method:'personal_sign',params:['0x'+Array.from(new TextEncoder().encode(message),b=>b.toString(16).padStart(2,'0')).join(''),account]});
 const response=await fetchImpl(base+'/v2/auth',{
  method:'POST',
  headers:{
   'Content-Type':'application/json',
   'PARADEX-STARKNET-ACCOUNT':starknetAccount,
   'PARADEX-EVM-SIGNATURE':String(signature),
   'PARADEX-SIWE-MESSAGE':base64Utf8(message)
  }
 });
 let data=null;try{data=await response.json()}catch{}
 if(!response.ok||!data?.jwt_token)throw Error(data?.message||('Paradex auth '+response.status));
 return Object.freeze({
  jwt:String(data.jwt_token),
  expiresAt:expirationTime.toISOString(),
  siweMessage:message
 });
}

export function normalizeParadexOrder(input={},signatureInfo={}){
 const market=String(input.market||'').trim().toUpperCase();
 const side=String(input.side||'').trim().toUpperCase();
 const type=String(input.type||'MARKET').trim().toUpperCase();
 const size=String(input.size??'').trim();
 const signature=String(signatureInfo.signature??input.signature??'').trim();
 const signatureTimestamp=Number(signatureInfo.signatureTimestamp??input.signature_timestamp);
 if(!/^[A-Z0-9]+-USD-PERP$/.test(market))throw Error('Invalid Paradex perpetual market.');
 if(!SIDES.has(side))throw Error('Unsupported Paradex order side.');
 if(!ORDER_TYPES.has(type))throw Error('Unsupported Paradex order type.');
 if(!finite(size)||Number(size)<=0)throw Error('Paradex order size must be positive.');
 if(!/^\[[^\]]+,[^\]]+\]$/.test(signature))throw Error('Paradex order signature must be a string [r,s].');
 if(!Number.isInteger(signatureTimestamp)||signatureTimestamp<=0)throw Error('Paradex signature timestamp is required.');
 const body={
  market,
  price:String(input.price??(type==='MARKET'?'0':'')),
  side,
  size,
  type,
  signature,
  signature_timestamp:signatureTimestamp
 };
 if(type!=='MARKET'&&(!finite(body.price)||Number(body.price)<=0))throw Error('Paradex limit-style order requires a positive price.');
 if(input.client_id??input.clientId)body.client_id=String(input.client_id??input.clientId).slice(0,64);
 if(Array.isArray(input.flags)&&input.flags.length)body.flags=[...input.flags];
 if(input.instruction)body.instruction=String(input.instruction);
 if(input.recv_window!==undefined)body.recv_window=Number(input.recv_window);
 if(input.stp)body.stp=String(input.stp);
 if(input.trigger_price!==undefined)body.trigger_price=String(input.trigger_price);
 if(input.on_behalf_of_account)body.on_behalf_of_account=String(input.on_behalf_of_account);
 return Object.freeze(body);
}

async function jsonResponse(response){
 if(response.status===204)return null;
 let data=null;try{data=await response.json()}catch{}
 if(!response.ok)throw Error(data?.message||data?.error||('Paradex API '+response.status));
 return data;
}

export function createParadexTestnetExecutionClient({
 jwt,
 orderSigner,
 fetchImpl=fetch,
 baseUrl=PARADEX_TESTNET_BASE
}={}){
 const base=String(baseUrl||'').replace(/\/+$/,'');
 if(base!==PARADEX_TESTNET_BASE)throw Error('BELTRIX Paradex execution client is testnet-only until E2E qualification passes.');
 const token=()=>String(typeof jwt==='function'?jwt():jwt||'').trim();
 const headers=()=>{const value=token();if(!value)throw Error('Paradex JWT is required.');return {Accept:'application/json',Authorization:'Bearer '+value}};
 async function request(method,path,{body=null}={}){
  const h=headers();if(body!==null)h['Content-Type']='application/json';
  const response=await fetchImpl(base+path,{method,headers:h,body:body===null?undefined:JSON.stringify(body)});
  return jsonResponse(response);
 }
 return Object.freeze({
  mode:'testnet-only',
  async createOrder(input){
   if(typeof orderSigner!=='function')throw Error('Paradex order signer is required.');
   const timestamp=Date.now();
   const unsigned=Object.freeze({...input,signature_timestamp:timestamp});
   const signed=await orderSigner(unsigned);
   const body=normalizeParadexOrder(input,{signature:signed?.signature,signatureTimestamp:signed?.signatureTimestamp??timestamp});
   return request('POST','/v1/orders',{body});
  },
  cancelOrder(orderId){
   const id=String(orderId||'').trim();
   if(!id)throw Error('Paradex order id is required.');
   return request('DELETE','/v1/orders/'+encodeURIComponent(id));
  },
  getOrder(orderId){
   const id=String(orderId||'').trim();
   if(!id)throw Error('Paradex order id is required.');
   return request('GET','/v1/orders/'+encodeURIComponent(id));
  },
  getOpenOrders(market=''){
   const q=new URLSearchParams();if(market)q.set('market',String(market).toUpperCase());
   return request('GET','/v1/orders'+(q.size?'?'+q.toString():''));
  },
  async reconcilePositions(){
   const data=await request('GET','/v1/positions');
   return Object.freeze({
    positions:Object.freeze(Array.isArray(data?.results)?data.results:[]),
    raw:data
   });
  }
 });
}
