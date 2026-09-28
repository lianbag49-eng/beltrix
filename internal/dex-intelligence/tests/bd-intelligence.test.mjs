import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBdDiligence} from '../bd-intelligence.js';

test('BD diligence keeps research state separate from claimed partnerships',()=>{
 const rows=buildBdDiligence(new Date('2026-09-28T00:00:00Z'));
 const orderly=rows.find(x=>x.venue==='orderly');
 assert.equal(orderly.whiteLabel,true);
 assert.equal(orderly.stage,'contact-ready');
 assert.match(orderly.integrationModel,/Orderly One/);
 assert.ok(orderly.sources.length>0);
});

test('BD diligence includes custody and portability questions',()=>{
 const rows=buildBdDiligence();
 const gmx=rows.find(x=>x.venue==='gmx');
 assert.ok(gmx.custodySettlement);
 assert.ok(gmx.portability);
});
