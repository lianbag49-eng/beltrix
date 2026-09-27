import test from 'node:test';import assert from 'node:assert/strict';
import {alertsToBdEvents,summarizeBdEvents} from '../bd-events.js';

test('warning and critical alerts become internal BD follow-up events',()=>{
 const events=alertsToBdEvents([
  {venue:'gmx',key:'api-latency',severity:'warning',message:'slow',evidence:{avgLatencyMs:2000}},
  {venue:'orderly',key:'collector-unavailable',severity:'critical',message:'down',evidence:{}},
  {venue:'x',key:'info',severity:'info',message:'note',evidence:{}}
 ],{asset:'BTC',timestamp:123});
 assert.equal(events.length,2);
 assert.equal(events.find(x=>x.venue==='gmx').priority,'medium');
 assert.equal(events.find(x=>x.venue==='orderly').priority,'high');
 assert.ok(events.every(x=>x.source==='market-intelligence'));
});

test('BD event summary is descriptive by venue',()=>{
 const events=[
  {venue:'gmx',priority:'high',timestamp:10},
  {venue:'gmx',priority:'medium',timestamp:20},
  {venue:'orderly',priority:'low',timestamp:5}
 ];
 const s=summarizeBdEvents(events);
 assert.equal(s.gmx.total,2);
 assert.equal(s.gmx.high,1);
 assert.equal(s.gmx.lastAt,20);
});
