import {VenueRegistry,VENUE_CAPABILITIES} from './venue-adapter.js';
import {hyperliquidVenue,hyperliquidNetwork} from './hyperliquid-venue.js';
import {orderlyVenue,ORDERLY_PUBLIC_BASE,ORDERLY_MARKETS_PATH} from './orderly-venue.js';
import {gmxVenue} from './gmx-venue.js';
import {paradexVenue,PARADEX_NETWORKS} from './paradex-venue.js';

export const marketVenueRegistry=new VenueRegistry();
for(const venue of [hyperliquidVenue,orderlyVenue,gmxVenue,paradexVenue])marketVenueRegistry.register(venue);

export function venueOptions(){
 return marketVenueRegistry.list().map(v=>Object.freeze({
  id:v.id,
  label:v.label,
  tradable:v.capabilities.includes(VENUE_CAPABILITIES.TRADING),
  readOnly:v.capabilities.includes(VENUE_CAPABILITIES.READ_ONLY)
 }));
}

export function venueNetworks(venueId){
 const venue=marketVenueRegistry.get(venueId);
 return Object.entries(venue.networks).map(([id,config])=>Object.freeze({
  id,label:config.label||config.chain||id
 }));
}

export function venueIsTradable(venueId){
 return marketVenueRegistry.get(venueId).capabilities.includes(VENUE_CAPABILITIES.TRADING);
}

async function json(url,options={},fetchImpl=fetch){
 const response=await fetchImpl(url,{...options,headers:{Accept:'application/json',...(options.headers||{})}});
 if(!response.ok)throw Error('HTTP '+response.status);
 return response.json();
}

export async function loadVenueMarkets({venueId='hyperliquid',network='mainnet',marketType='perp',signal,fetchImpl=fetch}={}){
 const venue=marketVenueRegistry.get(venueId);
 if(venueId==='hyperliquid'){
  const cfg=hyperliquidNetwork(network);
  const type=marketType==='spot'?'spotMeta':'meta';
  const payload=await json(cfg.http+'/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type}),signal},fetchImpl);
  return venue.normalizeMarkets(payload,marketType);
 }
 if(venueId==='orderly'){
  const payload=await json(ORDERLY_PUBLIC_BASE+ORDERLY_MARKETS_PATH,{signal},fetchImpl);
  return venue.normalizeMarkets(payload);
 }
 if(venueId==='paradex'){
  const cfg=PARADEX_NETWORKS[network];
  if(!cfg)throw Error('Unsupported Paradex network: '+network);
  const payload=await json(cfg.http+'/markets',{signal},fetchImpl);
  return venue.normalizeMarkets(payload);
 }
 if(venueId==='gmx'){
  const cfg=venue.networks[network];
  if(!cfg)throw Error('Unsupported GMX network: '+network);
  const base=cfg.oracle||cfg.api;
  if(!base)throw Error('GMX market API is unavailable for '+network);
  const payload=await json(base+'/markets',{signal},fetchImpl);
  return venue.normalizeMarkets(payload);
 }
 throw Error('Unsupported venue: '+venueId);
}

export function marketSnapshot(market){
 const raw=market?.raw||{};
 const first=(...keys)=>{
  for(const key of keys){
   const value=key.split('.').reduce((o,k)=>o?.[k],raw);
   const n=Number(value);
   if(Number.isFinite(n))return n;
  }
  return null;
 };
 return Object.freeze({
  mark:first('mark_price','markPrice','markPx','index_price','indexPrice','last_price','lastPrice'),
  oracle:first('oracle_price','oraclePrice','oraclePx','index_price','indexPrice'),
  volume24h:first('volume_24h','volume24h','dayNtlVlm','quote_volume_24h'),
  openInterest:first('open_interest','openInterest','open_interest_usd'),
  funding:first('funding_rate','fundingRate','funding')
 });
}


const CANDLE_MS=Object.freeze({
 '1m':60_000,'5m':300_000,'15m':900_000,'1h':3_600_000,'4h':14_400_000,'1d':86_400_000
});

function candle(t,o,h,l,c,v=0){
 const row={t:Number(t),o:Number(o),h:Number(h),l:Number(l),c:Number(c),v:Number(v??0)};
 return Object.values(row).every(Number.isFinite)?row:null;
}

function aggregateCandles(rows,bucketMs){
 const buckets=new Map();
 for(const row of rows){
  if(!row)continue;
  const key=Math.floor(row.t/bucketMs)*bucketMs;
  const prev=buckets.get(key);
  if(!prev)buckets.set(key,{t:key,o:row.o,h:row.h,l:row.l,c:row.c,v:row.v});
  else{
   prev.h=Math.max(prev.h,row.h);
   prev.l=Math.min(prev.l,row.l);
   prev.c=row.c;
   prev.v+=row.v;
  }
 }
 return [...buckets.values()].sort((a,b)=>a.t-b.t);
}

function orderlyResolution(interval){
 return ({'1m':'1','5m':'5','15m':'15','1h':'60','4h':'240','1d':'1D'})[interval]||'15';
}

function paradexResolution(interval){
 return ({'1m':'1','5m':'5','15m':'15','1h':'60','4h':'60','1d':'60'})[interval]||'15';
}

function normalizeOrderlyTv(payload){
 const t=Array.isArray(payload?.t)?payload.t:[];
 const o=Array.isArray(payload?.o)?payload.o:[];
 const h=Array.isArray(payload?.h)?payload.h:[];
 const l=Array.isArray(payload?.l)?payload.l:[];
 const cc=Array.isArray(payload?.c)?payload.c:[];
 const v=Array.isArray(payload?.v)?payload.v:[];
 return t.map((ts,i)=>candle(Number(ts)*1000,o[i],h[i],l[i],cc[i],v[i]??0)).filter(Boolean);
}

function normalizeGmxCandles(payload){
 return (Array.isArray(payload?.candles)?payload.candles:[]).map(row=>{
  if(!Array.isArray(row)||row.length<5)return null;
  return candle(Number(row[0])*1000,row[1],row[2],row[3],row[4],row[5]??0);
 }).filter(Boolean).sort((a,b)=>a.t-b.t);
}

function normalizeParadexCandles(payload){
 const rows=Array.isArray(payload?.results)?payload.results:Array.isArray(payload)?payload:[];
 return rows.map(row=>{
  if(Array.isArray(row)){
   if(row.length<5)return null;
   const ts=Number(row[0]);
   return candle(ts<10_000_000_000?ts*1000:ts,row[1],row[2],row[3],row[4],row[5]??0);
  }
  const ts=Number(row?.start_at??row?.start_timestamp??row?.timestamp??row?.time??row?.t);
  return candle(ts<10_000_000_000?ts*1000:ts,row?.open??row?.o,row?.high??row?.h,row?.low??row?.l,row?.close??row?.c,row?.volume??row?.v??0);
 }).filter(Boolean).sort((a,b)=>a.t-b.t);
}

export async function loadVenueCandles({
 venueId='hyperliquid',
 network='mainnet',
 market,
 interval='15m',
 limit=600,
 signal,
 fetchImpl=fetch
}={}){
 if(!market?.symbol)throw Error('Market is required for candle loading');
 const span=CANDLE_MS[interval]||CANDLE_MS['15m'];
 const now=Date.now();
 const take=Math.max(50,Math.min(1000,Number(limit)||600));

 if(venueId==='hyperliquid'){
  const cfg=hyperliquidNetwork(network);
  const payload=await json(cfg.http+'/info',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({type:'candleSnapshot',req:{
    coin:market.symbol,
    interval,
    startTime:now-span*take,
    endTime:now
   }}),
   signal
  },fetchImpl);
  return (Array.isArray(payload)?payload:[]).map(row=>candle(row?.t,row?.o,row?.h,row?.l,row?.c,row?.v)).filter(Boolean);
 }

 if(venueId==='orderly'){
  const params=new URLSearchParams({
   symbol:market.symbol,
   resolution:orderlyResolution(interval),
   from:String(Math.floor((now-span*take)/1000)),
   to:String(Math.floor(now/1000))
  });
  const payload=await json(ORDERLY_PUBLIC_BASE+'/v1/tv/history?'+params,{signal},fetchImpl);
  return normalizeOrderlyTv(payload).slice(-take);
 }

 if(venueId==='gmx'){
  const venue=marketVenueRegistry.get('gmx');
  const cfg=venue.networks[network];
  const base=cfg?.oracle;
  if(!base)throw Error('GMX candles are unavailable for '+network);
  const params=new URLSearchParams({
   tokenSymbol:market.base||market.symbol,
   period:interval,
   limit:String(take)
  });
  const payload=await json(base+'/prices/candles?'+params,{signal},fetchImpl);
  return normalizeGmxCandles(payload).slice(-take);
 }

 if(venueId==='paradex'){
  const cfg=PARADEX_NETWORKS[network];
  if(!cfg)throw Error('Unsupported Paradex network: '+network);
  const resolution=paradexResolution(interval);
  const sourceMs=(Number(resolution)||60)*60_000;
  const requested=Math.min(5000,Math.ceil((span*take)/sourceMs)+4);
  const params=new URLSearchParams({
   symbol:market.symbol,
   resolution,
   start_at:String(now-sourceMs*requested),
   end_at:String(now),
   price_kind:'mark'
  });
  const payload=await json(cfg.http+'/markets/klines?'+params,{signal},fetchImpl);
  const rows=normalizeParadexCandles(payload);
  return (interval==='4h'||interval==='1d'?aggregateCandles(rows,span):rows).slice(-take);
 }

 throw Error('Unsupported venue: '+venueId);
}
