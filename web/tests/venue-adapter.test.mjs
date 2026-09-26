import test from 'node:test';import assert from 'node:assert/strict';
import {VenueRegistry,defineVenueAdapter,normalizeVenueMarket,VENUE_CAPABILITIES} from '../venue-adapter.js';

test('venue registry filters capabilities and networks',()=>{
 const r=new VenueRegistry();
 r.register(defineVenueAdapter({id:'alpha',label:'Alpha',networks:{mainnet:{}},capabilities:[VENUE_CAPABILITIES.MARKET_DATA]}));
 r.register(defineVenueAdapter({id:'beta',label:'Beta',networks:{testnet:{}},capabilities:[VENUE_CAPABILITIES.MARKET_DATA,VENUE_CAPABILITIES.TRADING]}));
 assert.equal(r.get('alpha').label,'Alpha');
 assert.deepEqual(r.select({requires:[VENUE_CAPABILITIES.TRADING]}).map(x=>x.id),['beta']);
 assert.deepEqual(r.select({network:'mainnet'}).map(x=>x.id),['alpha']);
 assert.throws(()=>r.register(r.get('alpha')));
});
test('normalized markets reject invalid numeric metadata',()=>{
 assert.equal(normalizeVenueMarket({venue:'x',symbol:'BTC',marketType:'perp',maxLeverage:50}).maxLeverage,50);
 assert.throws(()=>normalizeVenueMarket({venue:'x',symbol:'BTC',tickSize:0}));
 assert.throws(()=>normalizeVenueMarket({venue:'',symbol:'BTC'}));
});
