import {defineVenueAdapter,normalizeVenueMarket,VENUE_CAPABILITIES} from './venue-adapter.js';

export const GMX_NETWORKS=Object.freeze({
 arbitrum:Object.freeze({chainId:42161,label:'Arbitrum'}),
 avalanche:Object.freeze({chainId:43114,label:'Avalanche'})
});

function rows(payload){
 if(Array.isArray(payload))return payload;
 if(Array.isArray(payload?.markets))return payload.markets;
 if(Array.isArray(payload?.data?.markets))return payload.data.markets;
 return [];
}

export function normalizeGmxMarkets(payload){
 return rows(payload).map((x,i)=>normalizeVenueMarket({
  venue:'gmx',
  symbol:String(x?.symbol||x?.name||x?.marketTokenSymbol||('MARKET-'+i)),
  base:String(x?.baseSymbol||x?.indexTokenSymbol||x?.base||''),
  quote:String(x?.quoteSymbol||x?.longTokenSymbol||'USDC'),
  marketType:'perp',
  tickSize:x?.tickSize??null,
  minSize:x?.minOrderSize??x?.minPositionSize??null,
  maxLeverage:x?.maxLeverage??null,
  nativeId:x?.marketTokenAddress??x?.address??x?.symbol??i,
  raw:x
 })).filter(x=>x.base);
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
