import {VENUES} from './venue-registry.js';
import {commercialByVenue} from './commercial-model.js';
import {INITIAL_QUALIFICATION} from './execution-qualification.js';
import {hasVenueMarket} from './market-normalizer.js';
import {currentVenueProfile} from './venue-current-profile.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

function venueHistory(history,venue){
 return (history||[]).map(s=>s?.venues?.[venue]).filter(Boolean);
}
function availabilityRatio(history,venue){
 const rows=venueHistory(history,venue);
 if(!rows.length)return null;
 return rows.filter(x=>x.ok!==false&&x.health!=='unavailable').length/rows.length;
}
function latestState(snapshot,venue){return snapshot?.venues?.[venue]||null}

export function buildVenueComparison({
 asset='BTC',
 latestSnapshot=null,
 history=[],
 intelligenceRows=[]
}={}){
 const mi=new Map((intelligenceRows||[]).map(x=>[x.venue,x]));
 return Object.freeze(VENUES.map(venue=>{
  const state=latestState(latestSnapshot,venue.id)||{};
  const metric=state.metric||{};
  const intel=mi.get(venue.id)||{};
  const commercial=commercialByVenue(venue.id);
  const qualification=INITIAL_QUALIFICATION[venue.id]||null;
  const profile=currentVenueProfile(venue.id);
  return Object.freeze({
   venue:venue.id,
   name:venue.name,
   asset:String(asset||'').toUpperCase(),
   mappedMarket:hasVenueMarket(asset,venue.id),
   marketModel:venue.marketModel,
   integration:Object.freeze([...venue.integration]),
   revenue:Object.freeze([...(commercial?.frontendRevenue||venue.revenue||[])]),
   whiteLabel:Boolean(venue.whiteLabel),
   sharedLiquidity:Boolean(venue.sharedLiquidity),
   executionQualified:Boolean(qualification?.qualified),
   missingExecutionGates:Object.freeze([...(qualification?.missing||[])]),
   dataStatus:intel.dataStatus||state.health||(state.ok===false?'unavailable':null),
   latencyMs:finite(state.latencyMs)?Number(state.latencyMs):null,
   spreadBps:finite(intel.spreadBps??state.spreadBps)?Number(intel.spreadBps??state.spreadBps):null,
   depth25Usd:finite(intel.depth25Usd??state.depth25Usd)?Number(intel.depth25Usd??state.depth25Usd):null,
   minFillRatio:finite(intel.minFillRatio??state.minFillRatio)?Number(intel.minFillRatio??state.minFillRatio):null,
   fundingRate:finite(metric.fundingRate)?Number(metric.fundingRate):null,
   openInterestUsd:finite(metric.openInterestUsd)?Number(metric.openInterestUsd):null,
   volume24hUsd:finite(metric.volume24hUsd)?Number(metric.volume24hUsd):null,
   capacityLongUsd:finite(intel.capacityLongUsd??state.capacityLongUsd)?Number(intel.capacityLongUsd??state.capacityLongUsd):null,
   capacityShortUsd:finite(intel.capacityShortUsd??state.capacityShortUsd)?Number(intel.capacityShortUsd??state.capacityShortUsd):null,
   availabilityRatio:availabilityRatio(history,venue.id),
   integrationModel:profile?.integrationModel||null,
   custodySettlement:profile?.custodySettlement||null,
   portability:profile?.portability||null,
   checkedAt:profile?.checkedAt||commercial?.checkedAt||null,
   sources:Object.freeze([...(profile?.sources||venue.docs||[])])
  });
 }));
}
