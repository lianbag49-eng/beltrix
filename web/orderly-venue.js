import {defineVenueAdapter,normalizeVenueMarket,VENUE_CAPABILITIES} from './venue-adapter.js';

export const ORDERLY_PUBLIC_BASE='https://api.orderly.org';
export const ORDERLY_MARKETS_PATH='/v1/public/info';

function rows(payload){
 if(Array.isArray(payload))return payload;
 if(Array.isArray(payload?.data))return payload.data;
 if(Array.isArray(payload?.data?.rows))return payload.data.rows;
 if(Array.isArray(payload?.rows))return payload.rows;
 return [];
}

export function normalizeOrderlyMarkets(payload){
 return rows(payload).filter(x=>String(x?.symbol||'').startsWith('PERP_')).map(x=>{
  const parts=String(x.symbol).split('_');
  return normalizeVenueMarket({
   venue:'orderly',
   symbol:x.symbol,
   base:parts[1]||x.base_asset,
   quote:parts[2]||x.quote_asset||'USDC',
   marketType:'perp',
   tickSize:x.quote_tick??x.tick_size??null,
   minSize:x.base_min??x.min_notional??null,
   maxLeverage:x.max_leverage??null,
   nativeId:x.symbol,
   raw:x
  });
 });
}

export const orderlyVenue=defineVenueAdapter({
 id:'orderly',
 label:'Orderly',
 networks:{mainnet:Object.freeze({http:ORDERLY_PUBLIC_BASE})},
 capabilities:[VENUE_CAPABILITIES.MARKET_DATA,VENUE_CAPABILITIES.PERPS,VENUE_CAPABILITIES.READ_ONLY],
 marketsPath:ORDERLY_MARKETS_PATH,
 normalizeMarkets:normalizeOrderlyMarkets,
 status:'read-only-poc'
});
