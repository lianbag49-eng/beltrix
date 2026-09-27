// BELTRIX internal-only public telemetry collectors.
// No wallet, API key, order placement or signing capability exists in this module.

const finite=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const sum=(rows,fn)=>rows.reduce((acc,row)=>{const n=fn(row);return acc+(Number.isFinite(n)?n:0)},0);

async function requestJson(url,options={},fetchImpl=fetch){
 const response=await fetchImpl(url,{...options,headers:{Accept:'application/json',...(options.headers||{})}});
 if(!response.ok)throw Error('HTTP '+response.status+' '+new URL(url).hostname);
 return response.json();
}

export async function collectHyperliquid(fetchImpl=fetch){
 const url='https://api.hyperliquid.xyz/info';
 const payload=await requestJson(url,{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({type:'metaAndAssetCtxs'})
 },fetchImpl);
 const meta=payload?.[0],ctx=Array.isArray(payload?.[1])?payload[1]:[];
 const markets=Array.isArray(meta?.universe)?meta.universe:[];
 const volume24h=sum(ctx,x=>finite(x?.dayNtlVlm));
 const openInterestUsd=sum(ctx,(x,i)=>{
  const oi=finite(x?.openInterest),mark=finite(x?.markPx);
  return oi!==null&&mark!==null?oi*mark:0;
 });
 return {id:'hyperliquid',retrievedAt:new Date().toISOString(),marketCount:markets.filter(x=>!x?.isDelisted).length,volume24h,openInterestUsd,source:url,confidence:'direct'};
}

export async function collectOrderly(fetchImpl=fetch){
 const url='https://api.orderly.org/v1/public/info';
 const payload=await requestJson(url,{},fetchImpl);
 const rows=Array.isArray(payload?.data?.rows)?payload.data.rows:Array.isArray(payload?.rows)?payload.rows:[];
 const volume24h=sum(rows,x=>finite(x?.['24h_amount']??x?.volume_24h??x?.quote_volume_24h));
 const openInterestUsd=sum(rows,x=>finite(x?.open_interest_usd??x?.open_interest));
 return {id:'orderly',retrievedAt:new Date().toISOString(),marketCount:rows.length,volume24h:volume24h||null,openInterestUsd:openInterestUsd||null,source:url,confidence:rows.length?'direct-partial':'unavailable'};
}

export async function collectParadex(fetchImpl=fetch){
 const base='https://api.prod.paradex.trade/v1';
 const marketPayload=await requestJson(base+'/markets',{},fetchImpl);
 const markets=Array.isArray(marketPayload?.results)?marketPayload.results:[];
 let summaries=[];
 try{
  const summary=await requestJson(base+'/markets/summary?market=ALL',{},fetchImpl);
  summaries=Array.isArray(summary?.results)?summary.results:[];
 }catch{}
 const volume24h=sum(summaries,x=>finite(x?.volume_24h??x?.volume??x?.quote_volume));
 const openInterestUsd=sum(summaries,x=>{
  const direct=finite(x?.open_interest_usd);if(direct!==null)return direct;
  const oi=finite(x?.open_interest),mark=finite(x?.mark_price??x?.mark_px??x?.last_traded_price);
  return oi!==null&&mark!==null?oi*mark:0;
 });
 return {id:'paradex',retrievedAt:new Date().toISOString(),marketCount:markets.length,volume24h:volume24h||null,openInterestUsd:openInterestUsd||null,source:base+'/markets',confidence:summaries.length?'direct':'direct-market-count'};
}

export async function collectDydx(fetchImpl=fetch){
 const url='https://indexer.dydx.trade/v4/perpetualMarkets';
 const payload=await requestJson(url,{},fetchImpl);
 const map=payload?.markets&&typeof payload.markets==='object'?payload.markets:{};
 const rows=Object.values(map);
 const volume24h=sum(rows,x=>finite(x?.volume24H??x?.volume24h));
 const openInterestUsd=sum(rows,x=>{
  const oi=finite(x?.openInterest),oracle=finite(x?.oraclePrice);
  return oi!==null&&oracle!==null?oi*oracle:0;
 });
 return {id:'dydx',retrievedAt:new Date().toISOString(),marketCount:rows.length,volume24h:volume24h||null,openInterestUsd:openInterestUsd||null,source:url,confidence:rows.length?'direct':'unavailable'};
}

export async function collectAster(fetchImpl=fetch){
 const base='https://fapi.asterdex.com';
 const url=base+'/fapi/v3/ticker/24hr';
 const payload=await requestJson(url,{},fetchImpl);
 const rows=Array.isArray(payload)?payload:[payload].filter(Boolean);
 const volume24h=sum(rows,x=>finite(x?.quoteVolume??x?.quote_volume??x?.volume));
 return {id:'aster',retrievedAt:new Date().toISOString(),marketCount:rows.length,volume24h:volume24h||null,openInterestUsd:null,source:url,confidence:rows.length?'direct-volume':'unavailable'};
}

export const COLLECTORS=Object.freeze({hyperliquid:collectHyperliquid,orderly:collectOrderly,paradex:collectParadex,dydx:collectDydx,aster:collectAster});

export async function collectVenueTelemetry(ids=Object.keys(COLLECTORS),fetchImpl=fetch){
 const results=[];
 for(const id of ids){
  const fn=COLLECTORS[id];
  if(!fn){results.push({id,retrievedAt:new Date().toISOString(),error:'collector-not-implemented',confidence:'unavailable'});continue}
  try{results.push(await fn(fetchImpl))}
  catch(error){results.push({id,retrievedAt:new Date().toISOString(),error:String(error?.message||error),confidence:'unavailable'})}
 }
 return results;
}
