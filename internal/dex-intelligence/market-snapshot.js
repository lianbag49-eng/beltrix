import {marketRouting,canonicalAsset} from './market-normalizer.js';
import {hyperliquidBook,orderlyBook,paradexBook,dydxBook,gmxMarketsInfo} from './public-data.js';
import {liquiditySnapshot,estimateExecutionCost,bookHealth} from './liquidity.js';

const BOOK_COLLECTORS=Object.freeze({
 hyperliquid:hyperliquidBook,
 orderly:orderlyBook,
 paradex:paradexBook,
 dydx:dydxBook
});

export const BOOK_VENUES=Object.freeze(Object.keys(BOOK_COLLECTORS));

export async function collectAssetBooks(asset,{fetchImpl=fetch,notionalUsd=10000,feeBpsByVenue={},now=Date.now()}={}){
 const route=marketRouting(asset);
 const rows=[];
 for(const venue of BOOK_VENUES){
  const symbol=route.symbols[venue];
  try{
   const raw=await BOOK_COLLECTORS[venue](symbol,{fetchImpl});
   const snapshot=liquiditySnapshot(raw);
   const feeBps=Number.isFinite(Number(feeBpsByVenue[venue]))?Number(feeBpsByVenue[venue]):null;
   rows.push(Object.freeze({
    venue,
    asset:route.asset,
    symbol,
    ok:true,
    receivedAt:raw.receivedAt,
    snapshot,
    buy:estimateExecutionCost(snapshot.book,{side:'buy',notionalUsd,feeBps}),
    sell:estimateExecutionCost(snapshot.book,{side:'sell',notionalUsd,feeBps}),
    health:bookHealth(snapshot.book,{now,notionalUsd})
   }));
  }catch(error){
   rows.push(Object.freeze({
    venue,
    asset:route.asset,
    symbol,
    ok:false,
    error:String(error?.message||error),
    receivedAt:null,
    snapshot:null,
    buy:null,
    sell:null,
    health:Object.freeze({status:'unavailable',reasons:['collector-error']})
   }));
  }
 }
 return Object.freeze(rows);
}

export async function collectGmxState(asset,{chain='arbitrum',fetchImpl=fetch}={}){
 const canonical=canonicalAsset(asset);
 try{
  const payload=await gmxMarketsInfo({chain,fetchImpl});
  const rows=Array.isArray(payload)?payload:Array.isArray(payload?.data)?payload.data:[];
  const matches=rows.filter(row=>{
   const haystack=JSON.stringify({
    name:row?.name,
    symbol:row?.symbol,
    marketName:row?.marketName,
    indexToken:row?.indexToken?.symbol,
    longToken:row?.longToken?.symbol,
    shortToken:row?.shortToken?.symbol
   }).toUpperCase();
   return haystack.includes(canonical);
  });
  return Object.freeze({
   venue:'gmx',
   asset:canonical,
   chain,
   ok:true,
   marketCount:rows.length,
   matchingMarkets:matches.length,
   receivedAt:Date.now(),
   note:'GMX is an oracle/liquidity-pool venue; CLOB depth and orderbook impact are intentionally not fabricated.'
  });
 }catch(error){
  return Object.freeze({
   venue:'gmx',
   asset:canonical,
   chain,
   ok:false,
   marketCount:0,
   matchingMarkets:0,
   receivedAt:null,
   error:String(error?.message||error)
  });
 }
}
