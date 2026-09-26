import {defineVenueAdapter,normalizeVenueMarket,VENUE_CAPABILITIES} from './venue-adapter.js';

export const HYPERLIQUID_NETWORKS=Object.freeze({
 mainnet:Object.freeze({http:'https://api.hyperliquid.xyz',ws:'wss://api.hyperliquid.xyz/ws',chain:'Mainnet'}),
 testnet:Object.freeze({http:'https://api.hyperliquid-testnet.xyz',ws:'wss://api.hyperliquid-testnet.xyz/ws',chain:'Testnet'})
});

export const HYPERLIQUID_BUILDER_LIMITS=Object.freeze({perp:100,spot:1000}); // tenths of a bp

export function hyperliquidNetwork(network='mainnet'){
 const value=HYPERLIQUID_NETWORKS[network];
 if(!value)throw Error(`Unsupported Hyperliquid network: ${network}`);
 return value;
}

export function hyperliquidBuilderParam(address,feeTenthsBp,marketType='perp'){
 const b=String(address||'').trim();
 const f=Number(feeTenthsBp),limit=HYPERLIQUID_BUILDER_LIMITS[marketType];
 if(!/^0x[0-9a-fA-F]{40}$/.test(b))throw Error('Builder address must be a 20-byte EVM address');
 if(!Number.isInteger(f)||f<0||!Number.isInteger(limit)||f>limit)throw Error(`Builder fee exceeds Hyperliquid ${marketType} limit`);
 return Object.freeze({b,f});
}

export function normalizeHyperliquidMarkets(meta,marketType='perp'){
 if(marketType==='spot'){
  const tokens=Array.isArray(meta?.tokens)?meta.tokens:[];
  return (meta?.universe||[]).map(p=>{
   const base=tokens.find(t=>t.index===p.tokens?.[0]),quote=tokens.find(t=>t.index===p.tokens?.[1]);
   return normalizeVenueMarket({
    venue:'hyperliquid',symbol:p.name,base:base?.name||p.name,quote:quote?.name||'USDC',marketType:'spot',
    nativeId:10000+p.index,minSize:null,maxLeverage:null,raw:{...p,szDecimals:base?.szDecimals}
   });
  });
 }
 return (meta?.universe||[]).map((x,i)=>normalizeVenueMarket({
  venue:'hyperliquid',symbol:x.name,base:x.name,quote:'USDC',marketType:'perp',
  nativeId:i,maxLeverage:x.maxLeverage,raw:x
 })).filter(x=>!x.raw?.isDelisted);
}

export const hyperliquidVenue=defineVenueAdapter({
 id:'hyperliquid',
 label:'Hyperliquid',
 networks:HYPERLIQUID_NETWORKS,
 capabilities:[
  VENUE_CAPABILITIES.MARKET_DATA,VENUE_CAPABILITIES.PERPS,VENUE_CAPABILITIES.SPOT,
  VENUE_CAPABILITIES.TRADING,VENUE_CAPABILITIES.REFERRAL,VENUE_CAPABILITIES.BUILDER_FEES
 ],
 marketInfoPath:'/info',
 exchangePath:'/exchange',
 normalizeMarkets:normalizeHyperliquidMarkets,
 builderParam:hyperliquidBuilderParam
});
