import {VENUES} from './venue-registry.js';
import {INITIAL_QUALIFICATION} from './execution-qualification.js';
import {hasVenueMarket,venueSymbol,canonicalAsset} from './market-normalizer.js';

const SIDE=new Set(['buy','sell']);
const ORDER_TYPE=new Set(['market','limit']);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export function normalizeTradeIntent(input={}){
 const asset=canonicalAsset(input.asset);
 const side=String(input.side||'').toLowerCase();
 const orderType=String(input.orderType||'market').toLowerCase();
 const notionalUsd=Number(input.notionalUsd);
 const preferredVenues=Array.isArray(input.preferredVenues)?input.preferredVenues.map(String):[];
 const excludedVenues=Array.isArray(input.excludedVenues)?input.excludedVenues.map(String):[];
 const errors=[];
 if(!asset)errors.push('asset_required');
 if(!SIDE.has(side))errors.push('invalid_side');
 if(!ORDER_TYPE.has(orderType))errors.push('invalid_order_type');
 if(!finite(notionalUsd)||notionalUsd<=0)errors.push('invalid_notional');
 if(orderType==='limit'&&!finite(input.limitPrice))errors.push('limit_price_required');
 if(finite(input.maxSlippageBps)&&Number(input.maxSlippageBps)<0)errors.push('invalid_max_slippage');
 return Object.freeze({
  version:1,
  asset,side,orderType,
  notionalUsd:finite(notionalUsd)?Number(notionalUsd):null,
  limitPrice:finite(input.limitPrice)?Number(input.limitPrice):null,
  reduceOnly:Boolean(input.reduceOnly),
  maxSlippageBps:finite(input.maxSlippageBps)?Number(input.maxSlippageBps):null,
  preferredVenues:Object.freeze(preferredVenues),
  excludedVenues:Object.freeze(excludedVenues),
  clientIntentId:String(input.clientIntentId||'').trim()||null,
  errors:Object.freeze(errors),
  valid:errors.length===0
 });
}

function stateFor(states,venue){return states?.[venue]||null}
function isLive(state){
 if(!state)return true;
 return state.ok!==false&&!['unavailable','down'].includes(String(state.health||state.dataStatus||'').toLowerCase());
}
function knownCost(intent,state){
 const direct=intent.side==='buy'
  ?state?.buyEffectiveCostBps??state?.buy?.effectiveCostBps
  :state?.sellEffectiveCostBps??state?.sell?.effectiveCostBps;
 if(finite(direct))return Number(direct);
 if(finite(state?.effectiveCostBps))return Number(state.effectiveCostBps);
 return null;
}

export function buildExecutionPlan(input,{venueStates={},qualification=INITIAL_QUALIFICATION}={}){
 const intent=input?.valid===undefined?normalizeTradeIntent(input):input;
 if(!intent.valid)return Object.freeze({status:'blocked',reason:'invalid_intent',intent,candidates:Object.freeze([]),route:null});
 const preferred=new Set(intent.preferredVenues);
 const excluded=new Set(intent.excludedVenues);
 const candidates=[];
 for(const venue of VENUES){
  if(excluded.has(venue.id))continue;
  const q=qualification[venue.id];
  if(!q?.qualified)continue;
  if(!hasVenueMarket(intent.asset,venue.id))continue;
  const state=stateFor(venueStates,venue.id);
  if(!isLive(state))continue;
  const costBps=knownCost(intent,state);
  candidates.push(Object.freeze({
   venue:venue.id,
   symbol:venueSymbol(intent.asset,venue.id),
   adapterKey:venue.id==='hyperliquid'?'hypercore':'venue-'+venue.id,
   settlementKey:venue.id==='hyperliquid'?'hyperliquid-bootstrap':venue.id,
   costBps,
   preferred:preferred.has(venue.id),
   qualificationReviewedAt:q.reviewedAt||null
  }));
 }
 candidates.sort((a,b)=>{
  if(a.preferred!==b.preferred)return a.preferred?-1:1;
  if(a.costBps!==null&&b.costBps!==null)return a.costBps-b.costBps;
  if(a.costBps!==null)return -1;
  if(b.costBps!==null)return 1;
  return a.venue.localeCompare(b.venue);
 });
 const route=candidates[0]||null;
 return Object.freeze({
  status:route?'ready':'blocked',
  reason:route?'qualified_route_available':'no_qualified_live_route',
  intent,
  candidates:Object.freeze(candidates),
  route,
  executionMode:'plan-only'
 });
}

export function executionAdapterInventory(){
 return Object.freeze(VENUES.map(v=>{
  const q=INITIAL_QUALIFICATION[v.id];
  return Object.freeze({
   venue:v.id,
   adapterKey:v.id==='hyperliquid'?'hypercore':'venue-'+v.id,
   mode:q?.qualified?'execution':'research-only',
   missing:Object.freeze([...(q?.missing||[])])
  });
 }));
}
