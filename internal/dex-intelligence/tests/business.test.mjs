import test from 'node:test';import assert from 'node:assert/strict';
import {COMMERCIAL_MODELS,commercialByVenue} from '../commercial-model.js';
import {INITIAL_QUALIFICATION,qualifyExecutionVenue,executionChecklist} from '../execution-qualification.js';
import {normalizeBdLead,bdStageProgress} from '../bd-pipeline.js';

test('commercial models are sourced and time stamped',()=>{
 assert.ok(COMMERCIAL_MODELS.length>=6);
 for(const row of COMMERCIAL_MODELS){assert.ok(row.checkedAt);assert.ok(row.sources.length);}
 assert.equal(commercialByVenue('gmx').whiteLabel,true);
});

test('only fully evidenced venue is qualified by the gate',()=>{
 assert.equal(INITIAL_QUALIFICATION.hyperliquid.qualified,true);
 assert.equal(INITIAL_QUALIFICATION.orderly.qualified,false);
 assert.ok(INITIAL_QUALIFICATION.orderly.missing.includes('orderLifecycle'));
 const checks=executionChecklist();
 const all=qualifyExecutionVenue({venue:'x',evidence:Object.fromEntries(checks.map(x=>[x,true]))});
 assert.equal(all.qualified,true);
});

test('BD leads use explicit stage and next action',()=>{
 const lead=normalizeBdLead({id:'o-1',name:'Orderly',venueId:'orderly',type:'infrastructure',stage:'qualified',objectives:['white-label'],nextAction:'Request builder terms'});
 assert.equal(lead.stage,'qualified');
 assert.equal(lead.objectives[0],'white-label');
 assert.ok(bdStageProgress('contract')>bdStageProgress('lead'));
});
