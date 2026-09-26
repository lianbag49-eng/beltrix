import test from 'node:test';import assert from 'node:assert/strict';
import {validPartnerCode,buildPartnerLink,summarizeGrowthEvents} from '../partners-core.js';

test('partner links use a clean BELTRIX URL and explicit campaign fields',()=>{
 const link=buildPartnerLink({
  baseUrl:'https://beltrix.example/app?old=1#markets',
  code:'ru-kol.01',source:'telegram',campaign:'launch_1',language:'ru',region:'cis'
 });
 const u=new URL(link);
 assert.equal(u.searchParams.get('ref'),'ru-kol.01');
 assert.equal(u.searchParams.get('utm_source'),'telegram');
 assert.equal(u.searchParams.get('utm_campaign'),'launch_1');
 assert.equal(u.searchParams.get('language'),'ru');
 assert.equal(u.searchParams.get('region'),'cis');
 assert.equal(u.hash,'');assert.equal(u.searchParams.get('old'),null);
});
test('partner input rejects script-like values',()=>{
 assert.equal(validPartnerCode('partner_01'),true);
 assert.equal(validPartnerCode('<script>'),false);
 assert.throws(()=>buildPartnerLink({baseUrl:'https://beltrix.example/',code:'ok',campaign:'bad value'}));
});
test('local growth summary counts conversion stages',()=>{
 const s=summarizeGrowthEvents([
  {type:'page_view'},{type:'page_view'},{type:'wallet_connected'},
  {type:'trade_order_confirmed'},{type:'builder_fee_approved'},{type:'other'}
 ]);
 assert.deepEqual(s,{pageViews:2,walletConnections:1,confirmedOrders:1,builderApprovals:1,total:6});
});
