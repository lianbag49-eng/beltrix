import {VenueRegistry,VENUE_CAPABILITIES} from './venue-adapter.js';
import {hyperliquidVenue,hyperliquidNetwork} from './hyperliquid-venue.js';
import {orderlyVenue,ORDERLY_PUBLIC_BASE,ORDERLY_MARKETS_PATH} from './orderly-venue.js';
import {gmxVenue} from './gmx-venue.js';
import {paradexVenue,PARADEX_NETWORKS} from './paradex-venue.js';

export const marketVenueRegistry=new VenueRegistry();
for(const venue of [hyperliquidVenue,orderlyVenue,gmxVenue,paradexVenue])marketVenueRegistry.register(venue);

export function venueOptions(){
 return marketVenueRegistry.list().map(v=>Object.freeze({
  id:v.id,
  label:v.label,
  tradable:v.capabilities.includes(VENUE_CAPABILITIES.TRADING),
  readOnly:v.capabilities.includes(VENUE_CAPABILITIES.READ_ONLY)
 }));
}

export function venueNetworks(venueId){
 const venue=marketVenueRegistry.get(venueId);
 return Object.entries(venue.networks).map(([id,config])=>Object.freeze({
  id,label:config.label||config.chain||id
 }));
}

export function venueIsTradable(venueId){
 return marketVenueRegistry.get(venueId).capabilities.includes(VENUE_CAPABILITIES.TRADING);
}

async function json(url,options={},fetchImpl=fetch){
 const response=await fetchImpl(url,{...options,headers:{Accept:'application/json',...(options.headers||{})}});
 if(!response.ok)throw Error('HTTP '+response.status);
 return response.json();
}

export async function loadVenueMarkets({venueId='hyperliquid',network='mainnet',marketType='perp',signal,fetchImpl=fetch}={}){
 const venue=marketVenueRegistry.get(venueId);
 if(venueId==='hyperliquid'){
  const cfg=hyperliquidNetwork(network);
  const type=marketType==='spot'?'spotMeta':'meta';
  const payload=await json(cfg.http+'/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type}),signal},fetchImpl);
  return venue.normalizeMarkets(payload,marketType);
 }
 if(venueId==='orderly'){
  const payload=await json(ORDERLY_PUBLIC_BASE+ORDERLY_MARKETS_PATH,{signal},fetchImpl);
  return venue.normalizeMarkets(payload);
 }
 if(venueId==='paradex'){
  const cfg=PARADEX_NETWORKS[network];
  if(!cfg)throw Error('Unsupported Paradex network: '+network);
  const payload=await json(cfg.http+'/markets',{signal},fetchImpl);
  return venue.normalizeMarkets(payload);
 }
 if(venueId==='gmx'){
  const cfg=venue.networks[network];
  if(!cfg)throw Error('Unsupported GMX network: '+network);
  const base=cfg.oracle||cfg.api;
  if(!base)throw Error('GMX market API is unavailable for '+network);
  const payload=await json(base+'/markets',{signal},fetchImpl);
  return venue.normalizeMarkets(payload);
 }
 throw Error('Unsupported venue: '+venueId);
}

export function marketSnapshot(market){
 const raw=market?.raw||{};
 const first=(...keys)=>{
  for(const key of keys){
   const value=key.split('.').reduce((o,k)=>o?.[k],raw);
   const n=Number(value);
   if(Number.isFinite(n))return n;
  }
  return null;
 };
 return Object.freeze({
  mark:first('mark_price','markPrice','markPx','index_price','indexPrice','last_price','lastPrice'),
  oracle:first('oracle_price','oraclePrice','oraclePx','index_price','indexPrice'),
  volume24h:first('volume_24h','volume24h','dayNtlVlm','quote_volume_24h'),
  openInterest:first('open_interest','openInterest','open_interest_usd'),
  funding:first('funding_rate','fundingRate','funding')
 });
}
