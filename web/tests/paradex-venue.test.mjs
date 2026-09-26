import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeParadexMarkets,paradexOnboardingAttribution} from '../paradex-venue.js';

test('Paradex perps normalize and spot-like rows are ignored',()=>{
 const rows=normalizeParadexMarkets({results:[
  {symbol:'BTC-USD-PERP',quote_currency:'USDC',price_tick_size:'0.1',order_size_increment:'0.001'},
  {symbol:'ETH-USD'}
 ]});
 assert.equal(rows.length,1);
 assert.equal(rows[0].venue,'paradex');
 assert.equal(rows[0].base,'BTC');
});
test('Paradex onboarding attribution maps BELTRIX campaign fields',()=>{
 assert.deepEqual(paradexOnboardingAttribution({referral:'alice',source:'telegram',campaign:'ru-launch'}),{
  referral_code:'alice',marketing_code:'ru-launch',utm_source:'telegram',utm_campaign:'ru-launch'
 });
});
