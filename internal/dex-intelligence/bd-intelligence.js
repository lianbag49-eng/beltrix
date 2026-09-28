import {VENUES} from './venue-registry.js';
import {commercialByVenue} from './commercial-model.js';
import {researchCoverage} from './venue-research.js';
import {currentVenueProfile} from './venue-current-profile.js';
import {INITIAL_BD_PIPELINE,nextActionState} from './bd-pipeline.js';

export function buildBdDiligence(now=new Date()){
 const leads=new Map(INITIAL_BD_PIPELINE.map(x=>[x.venueId,x]));
 return Object.freeze(VENUES.map(venue=>{
  const commercial=commercialByVenue(venue.id);
  const profile=currentVenueProfile(venue.id);
  const research=researchCoverage(venue.id);
  const lead=leads.get(venue.id)||null;
  const unresolved=[];
  if(!profile)unresolved.push('current capability profile');
  if(profile?.portability?.toLowerCase().includes('require'))unresolved.push('portability / migration diligence');
  if(venue.executionCandidate&&!venue.sharedLiquidity&&venue.marketModel!=='oracle-liquidity-pool')unresolved.push('liquidity sourcing');
  return Object.freeze({
   venue:venue.id,
   name:venue.name,
   stage:lead?.stage||'research',
   actionState:lead?nextActionState(lead,now):'unscheduled',
   nextAction:lead?.nextAction||null,
   objectives:Object.freeze([...(lead?.objectives||[])]),
   whiteLabel:Boolean(venue.whiteLabel),
   sharedLiquidity:Boolean(venue.sharedLiquidity),
   revenueModes:Object.freeze([...(commercial?.frontendRevenue||venue.revenue||[])]),
   feeControl:commercial?.feeControl||null,
   integrationModel:profile?.integrationModel||null,
   custodySettlement:profile?.custodySettlement||null,
   portability:profile?.portability||null,
   executionSurface:profile?.executionSurface||null,
   researchCoverage:research.knownRatio,
   unresolved:Object.freeze(unresolved),
   checkedAt:profile?.checkedAt||commercial?.checkedAt||null,
   sources:Object.freeze([...(profile?.sources||[])])
  });
 }));
}
