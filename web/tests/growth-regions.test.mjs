import test from 'node:test';import assert from 'node:assert/strict';
import {GROWTH_REGIONS,campaignDimensions,creatorEconomics} from '../growth-regions.js';

test('CIS and Chinese-speaking channel plans are explicit',()=>{
 assert.ok(GROWTH_REGIONS.cis.primaryChannels.includes('telegram'));
 assert.ok(GROWTH_REGIONS.chineseSpeaking.primaryChannels.includes('youtube'));
});
test('campaign dimensions are normalized without secrets',()=>{
 const d=campaignDimensions({region:'cis',language:'ru',source:'telegram',campaign:'launch',creatorId:'kol-1'});
 assert.equal(d.region,'cis');assert.equal(d.creatorId,'kol-1');
});
test('creator economics uses activated trader and net contribution metrics',()=>{
 const e=creatorEconomics({spend:100,activatedTraders:20,feeRevenue:400,payout:50});
 assert.equal(e.costPerActivatedTrader,5);assert.equal(e.netContribution,250);
});
