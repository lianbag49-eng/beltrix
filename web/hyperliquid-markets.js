import {hyperliquidNetwork} from './hyperliquid-venue.js';

async function json(base,body,signal,fetchImpl=fetch){
 const r=await fetchImpl(base+'/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
 if(!r.ok)throw Error('HTTP '+r.status);
 return r.json();
}

function logoSymbol(name){
 const raw=String(name||'');
 const part=raw.includes(':')?raw.split(':').at(-1):raw;
 return part.replace(/^@\d+$/,'').replace(/[^A-Za-z0-9._-]/g,'').toUpperCase();
}

export function hyperliquidLogoUrl(name){
 const symbol=logoSymbol(name);
 return symbol?'https://app.hyperliquid.xyz/coins/'+encodeURIComponent(symbol)+'.svg':'';
}

export async function loadHyperliquidMarkets({network='mainnet',marketType='perp',signal,fetchImpl=fetch}={}){
 const cfg=hyperliquidNetwork(network);
 if(marketType==='spot'){
  const meta=await json(cfg.http,{type:'spotMeta'},signal,fetchImpl);
  const tokens=Array.isArray(meta?.tokens)?meta.tokens:[];
  return (meta?.universe||[]).map(pair=>{
   const base=tokens.find(t=>t.index===pair.tokens?.[0]);
   const quote=tokens.find(t=>t.index===pair.tokens?.[1]);
   const baseName=base?.name||pair.name;
   return Object.freeze({value:pair.name,label:baseName+' / '+(quote?.name||'USDC'),displaySymbol:baseName,base:baseName,quote:quote?.name||'USDC',asset:10000+Number(pair.index),szDecimals:base?.szDecimals,spot:true,dex:'',logo:hyperliquidLogoUrl(baseName),raw:pair});
  });
 }
 const perps=await json(cfg.http,{type:'perpDexs'},signal,fetchImpl);
 const dexRows=Array.isArray(perps)?perps:[null];
 const out=[];
 for(let dexIndex=0;dexIndex<dexRows.length;dexIndex++){
  const row=dexRows[dexIndex];
  const dex=dexIndex===0?'':String(row?.name||'').trim();
  if(dexIndex>0&&!dex)continue;
  let meta;
  try{meta=await json(cfg.http,{type:'meta',...(dex?{dex}:{})},signal,fetchImpl)}catch{continue}
  for(let i=0;i<(meta?.universe||[]).length;i++){
   const x=meta.universe[i];
   if(x?.isDelisted)continue;
   const rawName=String(x.name||'');
   const display=rawName.includes(':')?rawName.split(':').at(-1):rawName;
   const asset=dexIndex===0?i:100000+dexIndex*10000+i;
   out.push(Object.freeze({value:rawName,label:display+' / USDC'+(dex?' · '+dex:''),displaySymbol:display,base:display,quote:'USDC',asset,szDecimals:x.szDecimals,spot:false,maxLeverage:x.maxLeverage,onlyIsolated:x.onlyIsolated,dex,dexIndex,logo:hyperliquidLogoUrl(display),raw:x}));
  }
 }
 return out;
}

export async function loadHyperliquidContext({network='mainnet',market,signal,fetchImpl=fetch}={}){
 const cfg=hyperliquidNetwork(network);
 if(!market)return null;
 if(market.spot){
  const rows=await json(cfg.http,{type:'spotMetaAndAssetCtxs'},signal,fetchImpl);
  const i=rows?.[0]?.universe?.findIndex(x=>x.name===market.value);
  return i>=0?rows?.[1]?.[i]||null:null;
 }
 const rows=await json(cfg.http,{type:'metaAndAssetCtxs',...(market.dex?{dex:market.dex}:{})},signal,fetchImpl);
 const i=rows?.[0]?.universe?.findIndex(x=>x.name===market.value);
 return i>=0?rows?.[1]?.[i]||null:null;
}