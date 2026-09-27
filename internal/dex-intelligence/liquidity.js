const finite=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n));

export function normalizeLevels(levels,side){
 const rows=(Array.isArray(levels)?levels:[]).map(row=>{
  if(Array.isArray(row))return {price:Number(row[0]),size:Number(row[1])};
  return {price:Number(row?.price??row?.px),size:Number(row?.size??row?.sz)};
 }).filter(x=>finite(x.price)&&finite(x.size)&&x.price>0&&x.size>=0);

 rows.sort((a,b)=>side==='bid'?b.price-a.price:a.price-b.price);
 return rows;
}

export function bookMetrics({bids=[],asks=[],receivedAt=Date.now(),now=Date.now()}={}){
 const b=normalizeLevels(bids,'bid'),a=normalizeLevels(asks,'ask');
 const bid=b[0]?.price??null,ask=a[0]?.price??null;
 const mid=bid&&ask?(bid+ask)/2:null;
 const spreadBps=mid?((ask-bid)/mid)*10000:null;
 const received=Number(receivedAt||0);
 return Object.freeze({
  bid,ask,mid,spreadBps,
  receivedAt:received||null,
  staleMs:received?Math.max(0,Number(now)-received):null,
  crossed:!!(bid&&ask&&bid>=ask),
  bids:b,asks:a
 });
}

export function depthUsdWithinBps(book,bps){
 const m=book?.mid;if(!m||!finite(bps)||Number(bps)<0)return {bid:0,ask:0,total:0};
 const band=Number(bps)/10000;
 const bidFloor=m*(1-band),askCeil=m*(1+band);
 const bid=(book.bids||[]).filter(x=>x.price>=bidFloor).reduce((s,x)=>s+x.price*x.size,0);
 const ask=(book.asks||[]).filter(x=>x.price<=askCeil).reduce((s,x)=>s+x.price*x.size,0);
 return Object.freeze({bid,ask,total:bid+ask});
}

export function simulateMarketOrder(book,{side,notionalUsd}={}){
 const target=Number(notionalUsd);
 if(!book?.mid||!finite(target)||target<=0)return Object.freeze({filledUsd:0,fillRatio:0,avgPrice:null,impactBps:null});
 const levels=side==='sell'?book.bids:book.asks;
 let remaining=target,filledUsd=0,base=0;
 for(const level of levels||[]){
  const usd=level.price*level.size;
  const take=Math.min(remaining,usd);
  if(take<=0)continue;
  filledUsd+=take;base+=take/level.price;remaining-=take;
  if(remaining<=1e-9)break;
 }
 const avgPrice=base>0?filledUsd/base:null;
 const direction=side==='sell'?-1:1;
 const impactBps=avgPrice?direction*((avgPrice-book.mid)/book.mid)*10000:null;
 return Object.freeze({
  requestedUsd:target,
  filledUsd,
  fillRatio:Math.min(1,filledUsd/target),
  avgPrice,
  impactBps
 });
}

export function estimateExecutionCost(book,{side,notionalUsd,feeBps=null}={}){
 const fill=simulateMarketOrder(book,{side,notionalUsd});
 const fee=finite(feeBps)&&Number(feeBps)>=0?Number(feeBps):null;
 const impact=finite(fill.impactBps)?Number(fill.impactBps):null;
 const effectiveCostBps=fee===null||impact===null?null:impact+fee;
 const estimatedCostUsd=effectiveCostBps===null?null:(fill.filledUsd*effectiveCostBps)/10000;
 return Object.freeze({
  ...fill,
  feeBps:fee,
  marketImpactBps:impact,
  effectiveCostBps,
  estimatedCostUsd
 });
}

export function bookHealth(book,{now=Date.now(),maxStaleMs=15000,notionalUsd=10000,minFillRatio=0.99}={}){
 const reasons=[];
 if(!book?.bid||!book?.ask)reasons.push('missing-side');
 if(book?.crossed)reasons.push('crossed-book');
 const staleMs=book?.receivedAt?Math.max(0,Number(now)-Number(book.receivedAt)):book?.staleMs;
 if(finite(staleMs)&&Number(staleMs)>Number(maxStaleMs))reasons.push('stale');
 const buy=simulateMarketOrder(book,{side:'buy',notionalUsd});
 const sell=simulateMarketOrder(book,{side:'sell',notionalUsd});
 if(buy.fillRatio<minFillRatio||sell.fillRatio<minFillRatio)reasons.push('insufficient-depth');
 return Object.freeze({
  status:reasons.length?'degraded':'healthy',
  staleMs:finite(staleMs)?Number(staleMs):null,
  reasons:Object.freeze(reasons),
  buyFillRatio:buy.fillRatio,
  sellFillRatio:sell.fillRatio
 });
}

export function liquiditySnapshot(input){
 const book=bookMetrics(input);
 const depth={};
 for(const bps of [10,25,50])depth[bps]=depthUsdWithinBps(book,bps);
 const impact={};
 for(const usd of [1000,10000,50000,100000]){
  impact[usd]={
   buy:simulateMarketOrder(book,{side:'buy',notionalUsd:usd}),
   sell:simulateMarketOrder(book,{side:'sell',notionalUsd:usd})
  };
 }
 return Object.freeze({book,depth,impact});
}
