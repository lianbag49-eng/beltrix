const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};

export function normalizeBook({bids=[],asks=[]}={}){
 const norm=(rows,side)=>rows.map(row=>{
  const price=n(Array.isArray(row)?row[0]:row?.price??row?.px);
  const size=n(Array.isArray(row)?row[1]:row?.size??row?.sz);
  return price>0&&size>=0?{price,size,notional:price*size,side}:null;
 }).filter(Boolean);
 const b=norm(bids,'bid').sort((a,z)=>z.price-a.price),a=norm(asks,'ask').sort((x,z)=>x.price-z.price);
 return {bids:b,asks:a};
}

export function bookMetrics(book,{depthBps=[5,10,25,50]}={}){
 const {bids,asks}=normalizeBook(book),bid=bids[0]?.price,ask=asks[0]?.price;
 if(!(bid>0&&ask>=bid))return {mid:null,spreadBps:null,depth:{}};
 const mid=(bid+ask)/2,spreadBps=(ask-bid)/mid*10_000;
 const depth={};
 for(const bps of depthBps){
  const bidFloor=mid*(1-bps/10_000),askCeil=mid*(1+bps/10_000);
  depth[bps]={bidUsd:bids.filter(x=>x.price>=bidFloor).reduce((s,x)=>s+x.notional,0),askUsd:asks.filter(x=>x.price<=askCeil).reduce((s,x)=>s+x.notional,0)};
 }
 return {mid,spreadBps,depth};
}

export function estimateMarketImpact(book,side,notionalUsd){
 if(!(notionalUsd>0))return {filledUsd:0,avgPrice:null,impactBps:null,complete:false};
 const {bids,asks}=normalizeBook(book),rows=side==='sell'?bids:asks;
 if(!rows.length)return {filledUsd:0,avgPrice:null,impactBps:null,complete:false};
 const best=rows[0].price;let remaining=notionalUsd,base=0,spent=0;
 for(const row of rows){
  const capacity=row.notional,take=Math.min(remaining,capacity),qty=take/row.price;
  base+=qty;spent+=take;remaining-=take;if(remaining<=1e-8)break;
 }
 const avg=base>0?spent/base:null;
 const impact=avg===null?null:Math.abs(avg-best)/best*10_000;
 return {filledUsd:spent,avgPrice:avg,impactBps:impact,complete:remaining<=1e-8};
}
