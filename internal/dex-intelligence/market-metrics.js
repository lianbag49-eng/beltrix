import {marketRouting,canonicalAsset} from './market-normalizer.js';
import {hyperliquidContexts,paradexMarketSummary,dydxMarkets} from './public-data.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const num=v=>finite(v)?Number(v):null;

function freezeMetric(row){
 return Object.freeze({
  venue:String(row.venue||''),
  asset:String(row.asset||''),
  symbol:String(row.symbol||''),
  ok:Boolean(row.ok),
  markPrice:num(row.markPrice),
  fundingRate:num(row.fundingRate),
  openInterest:num(row.openInterest),
  openInterestUsd:num(row.openInterestUsd),
  openInterestUnit:row.openInterestUnit||null,
  volume24h:num(row.volume24h),
  volume24hUsd:num(row.volume24hUsd),
  volume24hUnit:row.volume24hUnit||null,
  receivedAt:num(row.receivedAt),
  error:row.error?String(row.error):null
 });
}

export async function hyperliquidMarketMetrics(asset,{fetchImpl=fetch}={}){
 const canonical=canonicalAsset(asset);
 const symbol=marketRouting(canonical).symbols.hyperliquid;
 const payload=await hyperliquidContexts({fetchImpl});
 const meta=Array.isArray(payload)?payload[0]:null;
 const contexts=Array.isArray(payload)?payload[1]:null;
 const universe=Array.isArray(meta?.universe)?meta.universe:[];
 const index=universe.findIndex(x=>String(x?.name||'').toUpperCase()===String(symbol).toUpperCase());
 if(index<0||!Array.isArray(contexts)||!contexts[index])throw Error('Hyperliquid metric context not found for '+symbol);
 const ctx=contexts[index];
 const mark=num(ctx.markPx);
 const oiBase=num(ctx.openInterest);
 return freezeMetric({
  venue:'hyperliquid',
  asset:canonical,
  symbol,
  ok:true,
  markPrice:mark,
  fundingRate:ctx.funding,
  openInterest:oiBase,
  openInterestUsd:mark!==null&&oiBase!==null?mark*oiBase:null,
  openInterestUnit:'base',
  volume24h:ctx.dayNtlVlm,
  volume24hUsd:ctx.dayNtlVlm,
  volume24hUnit:'USD-notional',
  receivedAt:Date.now()
 });
}

export async function paradexMarketMetrics(asset,{fetchImpl=fetch}={}){
 const canonical=canonicalAsset(asset);
 const symbol=marketRouting(canonical).symbols.paradex;
 const data=await paradexMarketSummary(symbol,{fetchImpl});
 const rows=Array.isArray(data?.results)?data.results:[];
 const row=rows.find(x=>String(x?.symbol||'')===symbol)||rows[0];
 if(!row)throw Error('Paradex metric summary not found for '+symbol);
 return freezeMetric({
  venue:'paradex',
  asset:canonical,
  symbol,
  ok:true,
  markPrice:row.mark_price,
  fundingRate:row.funding_rate,
  openInterest:row.open_interest,
  openInterestUsd:null,
  openInterestUnit:'venue-native',
  volume24h:row.volume_24h,
  volume24hUsd:null,
  volume24hUnit:'venue-native',
  receivedAt:row.created_at||Date.now()
 });
}

function dydxRow(data,symbol){
 const root=data?.markets??data?.data?.markets??data;
 if(Array.isArray(root))return root.find(x=>String(x?.ticker||x?.symbol||'')===symbol)||null;
 if(root&&typeof root==='object')return root[symbol]||Object.values(root).find(x=>String(x?.ticker||x?.symbol||'')===symbol)||null;
 return null;
}

export async function dydxMarketMetrics(asset,{fetchImpl=fetch}={}){
 const canonical=canonicalAsset(asset);
 const symbol=marketRouting(canonical).symbols.dydx;
 const data=await dydxMarkets({fetchImpl});
 const row=dydxRow(data,symbol);
 if(!row)throw Error('dYdX metric summary not found for '+symbol);
 return freezeMetric({
  venue:'dydx',
  asset:canonical,
  symbol,
  ok:true,
  markPrice:row.oraclePrice??row.indexPrice??row.price,
  fundingRate:row.nextFundingRate??row.fundingRate,
  openInterest:row.openInterest,
  openInterestUsd:null,
  openInterestUnit:'venue-native',
  volume24h:row.volume24H??row.volume24h,
  volume24hUsd:null,
  volume24hUnit:'venue-native',
  receivedAt:Date.now()
 });
}

const METRIC_COLLECTORS=Object.freeze({
 hyperliquid:hyperliquidMarketMetrics,
 paradex:paradexMarketMetrics,
 dydx:dydxMarketMetrics
});

export async function collectMarketMetrics(asset,{fetchImpl=fetch}={}){
 const canonical=canonicalAsset(asset);
 const rows=[];
 for(const [venue,collector] of Object.entries(METRIC_COLLECTORS)){
  const startedAt=Date.now();
  try{
   const row=await collector(canonical,{fetchImpl});
   rows.push(Object.freeze({...row,latencyMs:Math.max(0,Date.now()-startedAt)}));
  }catch(error){
   const symbol=marketRouting(canonical).symbols[venue];
   rows.push(Object.freeze({
    venue,asset:canonical,symbol,ok:false,markPrice:null,fundingRate:null,
    openInterest:null,openInterestUsd:null,openInterestUnit:null,
    volume24h:null,volume24hUsd:null,volume24hUnit:null,
    receivedAt:null,latencyMs:Math.max(0,Date.now()-startedAt),
    error:String(error?.message||error)
   }));
  }
 }
 return Object.freeze(rows);
}
