const json=async(url,options={},fetchImpl=fetch)=>{
 const response=await fetchImpl(url,{...options,headers:{Accept:'application/json',...(options.headers||{})}});
 if(!response.ok)throw Error('HTTP '+response.status+' '+url);
 return response.json();
};

const unwrap=data=>data?.data&&typeof data.data==='object'?data.data:data;

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

export async function orderlyBook(symbol,{maxLevel=100,fetchImpl=fetch}={}){
 const data=await json(
  'https://api.orderly.org/v1/orderbook/'+encodeURIComponent(symbol)+'?max_level='+Math.max(1,Math.min(500,Number(maxLevel)||100)),
  {},
  fetchImpl
 );
 const root=unwrap(data);
 return {
  venue:'orderly',
  symbol,
  receivedAt:Number(root?.timestamp??root?.ts??data?.timestamp)||Date.now(),
  bids:root?.bids||[],
  asks:root?.asks||[]
 };
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

export const READ_ONLY_COLLECTORS=Object.freeze({
 hyperliquid:Object.freeze({book:hyperliquidBook,markets:hyperliquidContexts}),
 orderly:Object.freeze({book:orderlyBook,markets:orderlyMarkets}),
 paradex:Object.freeze({book:paradexBook,markets:paradexMarkets}),
 dydx:Object.freeze({book:dydxBook,markets:dydxMarkets}),
 gmx:Object.freeze({markets:gmxMarketsInfo})
});
