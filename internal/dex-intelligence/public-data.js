const json=async(url,options={},fetchImpl=fetch)=>{
 const response=await fetchImpl(url,{...options,headers:{Accept:'application/json',...(options.headers||{})}});
 if(!response.ok)throw Error('HTTP '+response.status+' '+url);
 return response.json();
};

const unwrap=data=>data?.data&&typeof data.data==='object'?data.data:data;
const GMX_NETWORKS=Object.freeze(['arbitrum','avalanche','megaeth']);
const USD30=10n**30n;

export function usd30ToNumber(value){
 if(value===null||value===undefined||value==='')return null;
 try{
  const raw=BigInt(String(value));
  const whole=raw/USD30;
  const rem=raw%USD30;
  const micro=rem/(10n**24n);
  return Number(whole)+Number(micro)/1e6;
 }catch{
  return null;
 }
}

export async function hyperliquidBook(symbol,{fetchImpl=fetch}={}){
 const data=await json('https://api.hyperliquid.xyz/info',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({type:'l2Book',coin:symbol})
 },fetchImpl);
 return {
  venue:'hyperliquid',
  symbol,
  receivedAt:Number(data?.time)||Date.now(),
  bids:data?.levels?.[0]||[],
  asks:data?.levels?.[1]||[]
 };
}

export async function orderlyBook(symbol,{maxLevel=100,fetchImpl=fetch,WebSocketCtor=globalThis.WebSocket,timeoutMs=5000}={}){
 // Orderly's REST /v1/orderbook route is authenticated. Production collection uses
 // the documented unauthenticated public WebSocket snapshot topic instead.
 if(fetchImpl!==fetch){
  const data=await json(
   'https://api.orderly.org/v1/orderbook/'+encodeURIComponent(symbol)+'?max_level='+Math.max(1,Math.min(500,Number(maxLevel)||100)),
   {},
   fetchImpl
  );
  const root=unwrap(data);
  return {
   venue:'orderly',symbol,
   receivedAt:Number(root?.timestamp??root?.ts??data?.timestamp)||Date.now(),
   bids:(root?.bids||[]).slice(0,maxLevel),
   asks:(root?.asks||[]).slice(0,maxLevel),
   transport:'fixture-rest'
  };
 }
 if(typeof WebSocketCtor!=='function')throw Error('Orderly public WebSocket is unavailable in this runtime');
 const topic=String(symbol)+'@orderbook';
 return new Promise((resolve,reject)=>{
  let settled=false,timer=null,ws;
  const finish=(error,value)=>{
   if(settled)return;settled=true;
   if(timer)clearTimeout(timer);
   try{ws?.close?.()}catch{}
   error?reject(error):resolve(value);
  };
  const orderlyClientId='OqdphuyCtYWxwzhxyLLjOWNdFP7sQt8RPWzmb5xY';
  try{ws=new WebSocketCtor('wss://ws-evm.orderly.org/ws/stream/'+orderlyClientId)}
  catch(error){finish(error);return}
  timer=setTimeout(()=>finish(Error('Orderly public orderbook timeout')),Math.max(1000,Number(timeoutMs)||5000));
  ws.onopen=()=>ws.send(JSON.stringify({id:'beltrix-'+Date.now(),event:'subscribe',topic}));
  ws.onerror=()=>finish(Error('Orderly public WebSocket connection failed'));
  ws.onmessage=event=>{
   let msg;try{msg=JSON.parse(typeof event.data==='string'?event.data:String(event.data))}catch{return}
   if(msg?.event==='ping'){try{ws.send(JSON.stringify({event:'pong'}))}catch{};return}
   if(msg?.success===false){finish(Error('Orderly subscription failed: '+(msg.errorMsg||'unknown error')));return}
   if(msg?.topic!==topic||!msg?.data)return;
   const bids=Array.isArray(msg.data.bids)?msg.data.bids.slice(0,maxLevel):[];
   const asks=Array.isArray(msg.data.asks)?msg.data.asks.slice(0,maxLevel):[];
   if(!bids.length||!asks.length)return;
   finish(null,{
    venue:'orderly',symbol,
    receivedAt:Number(msg.ts??msg.data.ts)||Date.now(),
    bids,asks,transport:'public-websocket'
   });
  };
 });
}

export async function paradexBook(symbol,{depth=20,fetchImpl=fetch}={}){
 const data=await json('https://api.prod.paradex.trade/v1/orderbook/'+encodeURIComponent(symbol)+'?depth='+Number(depth),{},fetchImpl);
 return {
  venue:'paradex',
  symbol,
  receivedAt:Number(data?.last_updated_at)||Date.now(),
  bids:data?.bids||data?.results?.bids||[],
  asks:data?.asks||data?.results?.asks||[]
 };
}

export async function dydxBook(symbol,{fetchImpl=fetch}={}){
 const data=await json('https://indexer.dydx.trade/v4/orderbooks/perpetualMarket/'+encodeURIComponent(symbol),{},fetchImpl);
 return {
  venue:'dydx',
  symbol,
  receivedAt:Date.now(),
  bids:data?.bids||[],
  asks:data?.asks||[]
 };
}

export async function orderlyMarkets({fetchImpl=fetch}={}){
 return json('https://api.orderly.org/v1/public/info',{},fetchImpl);
}

export async function paradexMarkets({fetchImpl=fetch}={}){
 return json('https://api.prod.paradex.trade/v1/markets',{},fetchImpl);
}

export async function paradexMarketSummary(symbol,{fetchImpl=fetch}={}){
 return json('https://api.prod.paradex.trade/v1/markets/summary?market='+encodeURIComponent(symbol),{},fetchImpl);
}

export async function dydxMarkets({fetchImpl=fetch}={}){
 return json('https://indexer.dydx.trade/v4/perpetualMarkets',{},fetchImpl);
}

export async function hyperliquidContexts({fetchImpl=fetch}={}){
 return json('https://api.hyperliquid.xyz/info',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({type:'metaAndAssetCtxs'})
 },fetchImpl);
}

export async function gmxMarketsInfo({chain='arbitrum',fetchImpl=fetch}={}){
 const network=String(chain||'arbitrum').toLowerCase();
 if(!['arbitrum','avalanche'].includes(network))throw Error('Unsupported GMX oracle network: '+network);
 return json('https://'+network+'-api.gmxinfra.io/markets/info',{},fetchImpl);
}

async function gmxApiJson(path,{chain='arbitrum',fetchImpl=fetch}={}){
 const network=String(chain||'arbitrum').toLowerCase();
 if(!GMX_NETWORKS.includes(network))throw Error('Unsupported GMX API network: '+network);
 const peers=[
  'https://'+network+'.gmxapi.io/v1',
  'https://'+network+'.gmxapi.ai/v1'
 ];
 let lastError;
 for(const base of peers){
  try{return await json(base+path,{},fetchImpl)}
  catch(error){lastError=error}
 }
 throw lastError||Error('GMX API peers unavailable');
}

export async function gmxTradingCapacity(symbol,{direction='long',chain='arbitrum',fetchImpl=fetch}={}){
 const side=String(direction||'').toLowerCase();
 if(!['long','short'].includes(side))throw Error('Invalid GMX trading-capacity direction: '+side);
 const data=await gmxApiJson(
  '/markets/trading-capacity?symbol='+encodeURIComponent(symbol)+'&direction='+side,
  {chain,fetchImpl}
 );
 const root=unwrap(data);
 return Object.freeze({
  venue:'gmx',
  symbol:String(symbol),
  direction:side,
  availableLiquidityRaw:root?.availableLiquidity==null?null:String(root.availableLiquidity),
  baseAvailableLiquidityRaw:root?.baseAvailableLiquidity==null?null:String(root.baseAvailableLiquidity),
  jitAvailableLiquidityRaw:root?.jitAvailableLiquidity==null?null:String(root.jitAvailableLiquidity),
  availableLiquidityUsd:usd30ToNumber(root?.availableLiquidity),
  baseAvailableLiquidityUsd:usd30ToNumber(root?.baseAvailableLiquidity),
  jitAvailableLiquidityUsd:usd30ToNumber(root?.jitAvailableLiquidity),
  limitingFactor:root?.limitingFactor||null,
  jitDataStatus:root?.jitDataStatus||null,
  marketDataStatus:root?.marketDataStatus||null,
  receivedAt:Date.now()
 });
}

export const READ_ONLY_COLLECTORS=Object.freeze({
 hyperliquid:Object.freeze({book:hyperliquidBook,markets:hyperliquidContexts}),
 orderly:Object.freeze({book:orderlyBook,markets:orderlyMarkets}),
 paradex:Object.freeze({book:paradexBook,markets:paradexMarkets,summary:paradexMarketSummary}),
 dydx:Object.freeze({book:dydxBook,markets:dydxMarkets}),
 gmx:Object.freeze({markets:gmxMarketsInfo,capacity:gmxTradingCapacity})
});
