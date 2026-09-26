import {defineVenueAdapter,normalizeVenueMarket,VENUE_CAPABILITIES} from './venue-adapter.js';

export const PARADEX_NETWORKS=Object.freeze({
 mainnet:Object.freeze({http:'https://api.prod.paradex.trade/v1',ws:'wss://ws.api.prod.paradex.trade/v1'})
});

function rows(payload){
 if(Array.isArray(payload))return payload;
 if(Array.isArray(payload?.results))return payload.results;
 if(Array.isArray(payload?.data?.results))return payload.data.results;
 return [];
}

export function normalizeParadexMarkets(payload){
 return rows(payload).filter(x=>String(x?.symbol||'').includes('-PERP')).map(x=>{
  const symbol=String(x.symbol);
  const base=symbol.split('-')[0]||x.base_currency;
  return normalizeVenueMarket({
   venue:'paradex',
   symbol,
   base,
   quote:x?.quote_currency||'USDC',
   marketType:'perp',
   tickSize:x?.price_tick_size??null,
   minSize:x?.order_size_increment??x?.min_order_size??null,
   maxLeverage:x?.max_leverage??null,
   nativeId:symbol,
   raw:x
  });
 });
}

export function paradexOnboardingAttribution(input={}){
 const pick=v=>typeof v==='string'&&v.trim()?v.trim().slice(0,96):undefined;
 const out={
  referral_code:pick(input.referral_code||input.referral),
  marketing_code:pick(input.marketing_code||input.campaign),
  utm_source:pick(input.utm_source||input.source),
  utm_medium:pick(input.utm_medium||input.medium),
  utm_campaign:pick(input.utm_campaign||input.campaign)
 };
 return Object.freeze(Object.fromEntries(Object.entries(out).filter(([,v])=>v)));
}

export const paradexVenue=defineVenueAdapter({
 id:'paradex',
 label:'Paradex',
 networks:PARADEX_NETWORKS,
 capabilities:[
  VENUE_CAPABILITIES.MARKET_DATA,
  VENUE_CAPABILITIES.PERPS,
  VENUE_CAPABILITIES.REFERRAL,
  VENUE_CAPABILITIES.READ_ONLY
 ],
 normalizeMarkets:normalizeParadexMarkets,
 onboardingAttribution:paradexOnboardingAttribution,
 status:'read-only-poc'
});
