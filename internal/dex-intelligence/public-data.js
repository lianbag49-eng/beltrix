const json=async(url,options={},fetchImpl=fetch)=>{
 const response=await fetchImpl(url,{...options,headers:{Accept:'application/json',...(options.headers||{})}});
 if(!response.ok)throw Error('HTTP '+response.status+' '+url);
 return response.json();
};

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

export async function paradexBook(symbol,{depth=20,fetchImpl=fetch}={}){
 const data=await json('https://api.prod.paradex.trade/v1/orderbook/'+encodeURIComponent(symbol)+'?depth='+Number(depth),{},fetchImpl);
 return {
  venue:'paradex',
  symbol,
  receivedAt:Date.now(),
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

export const READ_ONLY_COLLECTORS=Object.freeze({
 hyperliquid:Object.freeze({book:hyperliquidBook,markets:hyperliquidContexts}),
 orderly:Object.freeze({markets:orderlyMarkets}),
 paradex:Object.freeze({book:paradexBook,markets:paradexMarkets}),
 dydx:Object.freeze({book:dydxBook,markets:dydxMarkets})
});
