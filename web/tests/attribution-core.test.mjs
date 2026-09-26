import test from 'node:test';import assert from 'node:assert/strict';
import {parseAttribution,mergeAttribution,attributionEvent} from '../attribution-core.js';

test('referral is first-touch while campaign can update',()=>{
 const first=parseAttribution('https://beltrix.trade/?ref=alice&utm_source=telegram&utm_campaign=ru-launch',100);
 const next=parseAttribution('https://beltrix.trade/?ref=bob&utm_source=youtube&utm_campaign=review',200);
 const merged=mergeAttribution(first,next,300);
 assert.equal(merged.referral,'alice');assert.equal(merged.source,'youtube');assert.equal(merged.campaign,'review');
 assert.equal(merged.firstSeenAt,100);assert.equal(merged.lastSeenAt,300);
});
test('unsafe attribution values and secret event fields are discarded',()=>{
 const a=parseAttribution('https://beltrix.trade/?ref=%3Cscript%3E&utm_source=telegram',1);
 assert.equal(a.referral,undefined);assert.equal(a.source,'telegram');
 const e=attributionEvent('first_trade',a,{venue:'hyperliquid',apiKey:'do-not-store',volume:25},2);
 assert.equal(e.apiKey,undefined);assert.equal(e.venue,'hyperliquid');assert.equal(e.volume,25);
});
