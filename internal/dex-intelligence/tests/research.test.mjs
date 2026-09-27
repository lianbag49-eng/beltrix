import test from 'node:test';import assert from 'node:assert/strict';
import {VENUE_RESEARCH,researchProfile,flattenResearch,researchCoverage,RESEARCH_STATUSES} from '../venue-research.js';

test('venue research is sourced and separates documentation from testing',()=>{
 for(const venue of ['orderly','gmx','paradex','dydx']){
  const profile=researchProfile(venue);
  assert.equal(profile.venue,venue);
  assert.equal(profile.checkedAt,'2026-09-27');
  for(const row of flattenResearch(profile)){
   assert.ok(RESEARCH_STATUSES.includes(row.status));
   if(row.status==='documented')assert.ok(row.sources.length>0);
  }
 }
});

test('Orderly white-label research is documented but exit dependency remains open',()=>{
 const p=VENUE_RESEARCH.orderly;
 assert.equal(p.whiteLabel.launch.status,'documented');
 assert.equal(p.whiteLabel.economics.status,'documented');
 assert.equal(p.whiteLabel.operationalExit.status,'unknown');
});

test('documented competitor execution is not misrepresented as tested',()=>{
 assert.equal(VENUE_RESEARCH.paradex.execution.auth.status,'documented');
 assert.equal(VENUE_RESEARCH.paradex.execution.testnetE2E.status,'blocked');
 assert.equal(VENUE_RESEARCH.dydx.execution.testnet.status,'documented');
 assert.equal(VENUE_RESEARCH.dydx.execution.testnetE2E.status,'blocked');
 assert.ok(researchCoverage('paradex').knownRatio>0);
});
