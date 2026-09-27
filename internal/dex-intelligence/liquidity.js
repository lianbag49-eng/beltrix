const finite=n=>Number.isFinite(Number(n));

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
 return Object.freeze({
  bid,ask,mid,spreadBps,
  staleMs:Math.max(0,Number(now)-Number(receivedAt||0)),
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
  filledUsd,
  fillRatio:Math.min(1,filledUsd/target),
  avgPrice,
  impactBps
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
