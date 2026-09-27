import {marketRouting,canonicalAsset} from './market-normalizer.js';
import {hyperliquidBook,orderlyBook,paradexBook,dydxBook,gmxMarketsInfo,gmxTradingCapacity} from './public-data.js';
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
  const startedAt=Date.now();
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
    health:bookHealth(snapshot.book,{now,notionalUsd}),
    latencyMs:Math.max(0,Date.now()-startedAt)
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
    health:Object.freeze({status:'unavailable',reasons:['collector-error']}),
    latencyMs:Math.max(0,Date.now()-startedAt)
   }));
  }
 }
 return Object.freeze(rows);
}

const gmxMatch=(rows,canonical)=>rows.find(row=>{
 const haystack=JSON.stringify({
  name:row?.name,
  symbol:row?.symbol,
  marketName:row?.marketName,
  indexToken:row?.indexToken?.symbol,
  longToken:row?.longToken?.symbol,
  shortToken:row?.shortToken?.symbol
 }).toUpperCase();
 return haystack.includes(canonical);
})||null;

const gmxSymbol=row=>row?.symbol||row?.name||row?.marketName||null;

export async function collectGmxState(asset,{chain='arbitrum',fetchImpl=fetch}={}){
 const canonical=canonicalAsset(asset);
 const startedAt=Date.now();
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
  const matched=gmxMatch(rows,canonical);
  const symbol=gmxSymbol(matched);
  let long=null,short=null,capacityError=null;
  if(symbol){
   const result=await Promise.allSettled([
    gmxTradingCapacity(symbol,{direction:'long',chain,fetchImpl}),
    gmxTradingCapacity(symbol,{direction:'short',chain,fetchImpl})
   ]);
   if(result[0].status==='fulfilled')long=result[0].value;
   if(result[1].status==='fulfilled')short=result[1].value;
   const errors=result.filter(x=>x.status==='rejected').map(x=>String(x.reason?.message||x.reason));
   if(errors.length)capacityError=errors.join(' | ');
  }
  return Object.freeze({
   venue:'gmx',
   asset:canonical,
   chain,
   ok:true,
   marketCount:rows.length,
   matchingMarkets:matches.length,
   matchedSymbol:symbol,
   capacity:Object.freeze({long,short}),
   capacityError,
   receivedAt:Date.now(),
   latencyMs:Math.max(0,Date.now()-startedAt),
   note:'GMX uses oracle/pool execution. Capacity is JIT-aware indicative increase capacity, not a CLOB depth substitute or request-specific prepare-order guarantee.'
  });
 }catch(error){
  return Object.freeze({
   venue:'gmx',
   asset:canonical,
   chain,
   ok:false,
   marketCount:0,
   matchingMarkets:0,
   matchedSymbol:null,
   capacity:Object.freeze({long:null,short:null}),
   capacityError:null,
   receivedAt:null,
   latencyMs:Math.max(0,Date.now()-startedAt),
   error:String(error?.message||error)
  });
 }
}
