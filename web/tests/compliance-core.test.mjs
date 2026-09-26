import test from 'node:test';import assert from 'node:assert/strict';
import {FEATURES,policyForCountry,canUseFeature,requireFeature} from '../compliance-core.js';

test('mainland China is market-view only by default',()=>{
 assert.equal(canUseFeature('CN',FEATURES.VIEW_MARKETS),true);
 assert.equal(canUseFeature('CN',FEATURES.TRADE),false);
 assert.throws(()=>requireFeature('CN',FEATURES.TRADE));
});
test('Taiwan follows enabled Chinese-speaking policy',()=>{
 assert.equal(policyForCountry('TW').group,'chinese-speaking');
 assert.equal(canUseFeature('TW',FEATURES.TRADE),true);
});
test('Russia defaults to restricted review for execution and campaigns',()=>{
 assert.equal(canUseFeature('RU',FEATURES.TRADE),false);
 assert.equal(canUseFeature('RU',FEATURES.CAMPAIGN),false);
});
