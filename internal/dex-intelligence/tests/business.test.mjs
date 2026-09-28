import test from 'node:test';import assert from 'node:assert/strict';
import {COMMERCIAL_MODELS,commercialByVenue} from '../commercial-model.js';
import {INITIAL_QUALIFICATION,qualifyExecutionVenue,executionChecklist,executableVenues} from '../execution-qualification.js';
import {normalizeBdLead,bdStageProgress,nextActionState,INITIAL_BD_PIPELINE} from '../bd-pipeline.js';

test('commercial models are sourced and time stamped',()=>{
 assert.ok(COMMERCIAL_MODELS.length>=6);
 for(const row of COMMERCIAL_MODELS){assert.ok(row.checkedAt);assert.ok(row.sources.length);}
 assert.equal(commercialByVenue('gmx').whiteLabel,true);
});

test('only fully evidenced venue is qualified by the gate',()=>{
 assert.equal(INITIAL_QUALIFICATION.hyperliquid.qualified,true);
 assert.equal(INITIAL_QUALIFICATION.orderly.qualified,false);
 assert.ok(INITIAL_QUALIFICATION.orderly.missing.includes('paperOrTestnetE2E'));
 assert.ok(INITIAL_QUALIFICATION.orderly.missing.includes('failureRecovery'));
 assert.ok(INITIAL_QUALIFICATION.paradex.missing.includes('paperOrTestnetE2E'));
 const checks=executionChecklist();
 const all=qualifyExecutionVenue({venue:'x',evidence:Object.fromEntries(checks.map(x=>[x,true]))});
 assert.equal(all.qualified,true);
 assert.deepEqual(executableVenues(),['hyperliquid']);
});

test('BD leads use explicit stage and next action without implying outreach',()=>{
 const lead=normalizeBdLead({id:'o-1',name:'Orderly',venueId:'orderly',type:'infrastructure',stage:'contact-ready',objectives:['white-label'],nextAction:'Request builder terms'});
 assert.equal(lead.stage,'contact-ready');
 assert.equal(lead.objectives[0],'white-label');
 assert.ok(bdStageProgress('contract')>bdStageProgress('research'));
 const orderly=INITIAL_BD_PIPELINE.find(x=>x.venueId==='orderly');
 assert.equal(orderly.stage,'contact-ready');
 assert.match(orderly.notes,/no outreach/i);
});

test('BD next action state is deterministic',()=>{
 const lead=normalizeBdLead({nextActionAt:'2026-09-30T09:00:00+09:00'});
 assert.equal(nextActionState(lead,new Date('2026-09-27T09:00:00+09:00')),'due-soon');
 assert.equal(nextActionState(lead,new Date('2026-10-01T09:00:00+09:00')),'overdue');
});
