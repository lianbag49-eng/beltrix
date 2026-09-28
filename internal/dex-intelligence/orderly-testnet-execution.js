export const ORDERLY_TESTNET_BASE='https://testnet-api.orderly.org';
export const ORDERLY_MAINNET_BASE='https://api.orderly.org';

const METHODS=new Set(['GET','POST','PUT','DELETE']);
const ORDER_TYPES=new Set(['LIMIT','MARKET','IOC','FOK','POST_ONLY','ASK','BID']);
const SIDES=new Set(['BUY','SELL']);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export function canonicalOrderlyRequest({timestamp,method,path,body=null}={}){
 const ts=Number(timestamp);
 const verb=String(method||'GET').toUpperCase();
 const target=String(path||'');
 if(!Number.isInteger(ts)||ts<=0)throw Error('Orderly timestamp must be a positive integer in milliseconds.');
 if(!METHODS.has(verb))throw Error('Unsupported Orderly HTTP method.');
 if(!target.startsWith('/')||target.includes('://'))throw Error('Orderly signed path must exclude the base URL.');
 let bodyText='';
 if(body!==null&&body!==undefined){
  bodyText=typeof body==='string'?body:JSON.stringify(body);
  if((verb==='GET'||verb==='DELETE')&&bodyText!=='')throw Error('Orderly GET/DELETE signed requests must not include a body.');
 }
 return String(ts)+verb+target+bodyText;
}

export function normalizeOrderlyOrder(input={}){
 const symbol=String(input.symbol||'').trim().toUpperCase();
 const orderType=String(input.order_type||input.orderType||'MARKET').trim().toUpperCase();
 const side=String(input.side||'').trim().toUpperCase();
 const quantity=Number(input.order_quantity??input.quantity);
 const body={symbol,order_type:orderType,side};
 if(!/^PERP_[A-Z0-9]+_USDC(?:\.e)?$/.test(symbol))throw Error('Invalid Orderly perpetual symbol.');
 if(!ORDER_TYPES.has(orderType))throw Error('Unsupported Orderly order type.');
 if(!SIDES.has(side))throw Error('Unsupported Orderly order side.');
 if(!finite(quantity)||quantity<=0)throw Error('Orderly order quantity must be positive.');
 body.order_quantity=quantity;
 if(!['MARKET','ASK','BID'].includes(orderType)){
  const price=Number(input.order_price??input.price);
  if(!finite(price)||price<=0)throw Error('Orderly limit-style order requires a positive price.');
  body.order_price=price;
 }
 if(input.client_order_id??input.clientOrderId){
  const id=String(input.client_order_id??input.clientOrderId);
  if(id.length>36||id.startsWith('-'))throw Error('Invalid Orderly client_order_id.');
  body.client_order_id=id;
 }
 if(input.reduce_only!==undefined||input.reduceOnly!==undefined)body.reduce_only=Boolean(input.reduce_only??input.reduceOnly);
 if(finite(input.slippage))body.slippage=Number(input.slippage);
 if(input.order_tag)body.order_tag=String(input.order_tag);
 if(input.post_only_adjust!==undefined)body.post_only_adjust=Boolean(input.post_only_adjust);
 return Object.freeze(body);
}

export function orderlyCancelPath({orderId,symbol}={}){
 const id=String(orderId??'').trim(),sym=String(symbol||'').trim().toUpperCase();
 if(!/^\d+$/.test(id))throw Error('Orderly order id is required for cancellation.');
 if(!sym)throw Error('Orderly symbol is required for cancellation.');
 const q=new URLSearchParams();
 q.set('order_id',id);
 q.set('symbol',sym);
 return '/v1/order?'+q.toString();
}

export async function buildSignedOrderlyRequest({
 accountId,
 orderlyKey,
 sign,
 timestamp=Date.now(),
 method='GET',
 path,
 body=null
}={}){
 const account=String(accountId||'').trim(),key=String(orderlyKey||'').trim();
 if(!account)throw Error('Orderly account id is required.');
 if(!/^ed25519:[1-9A-HJ-NP-Za-km-z]+$/.test(key))throw Error('Orderly public key must use ed25519:<base58> format.');
 if(typeof sign!=='function')throw Error('Orderly request signer is required.');
 const verb=String(method).toUpperCase();
 const bodyText=body===null||body===undefined?'':typeof body==='string'?body:JSON.stringify(body);
 const message=canonicalOrderlyRequest({timestamp,method:verb,path,body:bodyText||null});
 const signature=String(await sign(message)||'').trim();
 if(!signature)throw Error('Orderly signer returned an empty signature.');
 return Object.freeze({
  method:verb,
  path,
  body:bodyText||null,
  canonicalMessage:message,
  headers:Object.freeze({
   'Content-Type':verb==='GET'||verb==='DELETE'?'application/x-www-form-urlencoded':'application/json',
   'orderly-timestamp':String(timestamp),
   'orderly-account-id':account,
   'orderly-key':key,
   'orderly-signature':signature
  })
 });
}

async function parseResponse(response){
 let data=null;
 try{data=await response.json()}catch{}
 if(!response.ok||data?.success===false)throw Error(data?.message||data?.data?.error_message||('Orderly API '+response.status));
 return data;
}

export function createOrderlyTestnetExecutionClient({
 accountId,
 orderlyKey,
 sign,
 address,
 fetchImpl=fetch,
 baseUrl=ORDERLY_TESTNET_BASE
}={}){
 const base=String(baseUrl||'').replace(/\/+$/,'');
 if(base!==ORDERLY_TESTNET_BASE)throw Error('BELTRIX Orderly execution client is testnet-only until E2E qualification passes.');
 async function signed(method,path,body=null){
  const req=await buildSignedOrderlyRequest({accountId,orderlyKey,sign,method,path,body});
  const response=await fetchImpl(base+path,{
   method:req.method,
   headers:req.headers,
   body:req.body||undefined
  });
  return parseResponse(response);
 }
 return Object.freeze({
  mode:'testnet-only',
  createOrder(input){
   const body=normalizeOrderlyOrder(input);
   return signed('POST','/v1/order',body);
  },
  cancelOrder(input){
   return signed('DELETE',orderlyCancelPath(input));
  },
  getOrder(orderId){
   const id=String(orderId||'').trim();
   if(!/^\d+$/.test(id))throw Error('Orderly order id is required.');
   return signed('GET','/v1/order/'+encodeURIComponent(id));
  },
  getOrders(query={}){
   const q=new URLSearchParams();
   for(const key of ['symbol','status','side','order_type','page','size']){
    if(query[key]!==undefined&&query[key]!==null&&query[key]!=='')q.set(key,String(query[key]));
   }
   return signed('GET','/v1/orders'+(q.size?'?'+q.toString():''));
  },
  async reconcileAccountState({brokerId=null}={}){
   const wallet=String(address||'').trim();
   if(!/^0x[0-9a-fA-F]{40}$/.test(wallet))throw Error('EVM wallet address is required for Orderly account reconciliation.');
   const payload={type:'accountState',address:wallet,account_id:String(accountId||'')};
   if(brokerId)payload.broker_id=String(brokerId);
   const response=await fetchImpl(base+'/v1/public/query',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
   });
   const data=await parseResponse(response);
   const account=data?.data||null;
   return Object.freeze({
    accountId:account?.account_id||accountId||null,
    accountValue:account?.account_value??null,
    freeCollateral:account?.free_collateral??null,
    positions:Object.freeze(Array.isArray(account?.positions)?account.positions:[]),
    raw:account
   });
  }
 });
}
