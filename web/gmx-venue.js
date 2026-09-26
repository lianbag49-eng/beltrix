import {defineVenueAdapter,normalizeVenueMarket,VENUE_CAPABILITIES} from './venue-adapter.js';

export const GMX_NETWORKS=Object.freeze({
 arbitrum:Object.freeze({chainId:42161,label:'Arbitrum',oracle:'https://arbitrum-api.gmxinfra.io'}),
 avalanche:Object.freeze({chainId:43114,label:'Avalanche',oracle:'https://avalanche-api.gmxinfra.io'}),
 megaeth:Object.freeze({label:'MegaETH',api:'https://megaeth.gmxapi.io/v1'})
});

function rows(payload){
 if(Array.isArray(payload))return payload;
 if(Array.isArray(payload?.markets))return payload.markets;
 if(Array.isArray(payload?.data?.markets))return payload.data.markets;
 return [];
}

function tokenSymbol(value){
 if(typeof value==='string')return value;
 return String(value?.symbol||value?.name||'');
}

export function normalizeGmxMarkets(payload){
 return rows(payload).map((x,i)=>{
  const base=String(
   x?.baseSymbol||
   x?.indexTokenSymbol||
   tokenSymbol(x?.indexToken)||
   x?.base||
   ''
  );
  const quote=String(
   x?.quoteSymbol||
   tokenSymbol(x?.shortToken)||
   tokenSymbol(x?.longToken)||
   'USDC'
  );
  return normalizeVenueMarket({
   venue:'gmx',
   symbol:String(x?.symbol||x?.name||x?.marketTokenSymbol||base+(quote?'/'+quote:'')||('MARKET-'+i)),
   base,
   quote,
   marketType:'perp',
   tickSize:x?.tickSize??x?.priceTickSize??null,
   minSize:x?.minOrderSize??x?.minPositionSize??x?.minPositionSizeUsd??null,
   maxLeverage:x?.maxLeverage??x?.maxLeverageFactor??null,
   nativeId:x?.marketTokenAddress??x?.marketToken?.address??x?.address??x?.symbol??i,
   raw:x
  });
 }).filter(x=>x.base);
}

export const gmxVenue=defineVenueAdapter({
 id:'gmx',
 label:'GMX',
 networks:GMX_NETWORKS,
 capabilities:[
  VENUE_CAPABILITIES.MARKET_DATA,
  VENUE_CAPABILITIES.PERPS,
  VENUE_CAPABILITIES.REFERRAL,
  VENUE_CAPABILITIES.READ_ONLY
 ],
 normalizeMarkets:normalizeGmxMarkets,
 status:'read-only-poc'
});
