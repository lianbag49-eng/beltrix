import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPaper,openPaper,closePaper,validPaper} from '../paper-core.js';
const order={coin:'BTC',side:'long',margin:1000,leverage:5,price:50000};
test('opening reserves margin and fee; closing realizes net PnL',()=>{
 const opened=openPaper(initialPaper(),order);assert.equal(opened.cash,98997.5);assert.equal(opened.position.size,.1);
 const closed=closePaper(opened,51000);assert.equal(closed.cash,100094.95);assert.equal(closed.position,null);assert.ok(Math.abs(closed.history[0].pnl-94.95)<1e-9);
});
test('short profit, margin-loss cap and invalid orders',()=>{
 const s=openPaper(initialPaper(),{...order,side:'short'});assert.ok(closePaper(s,49000).cash>100000);
 assert.equal(closePaper(s,100000).cash,s.cash);
 for(const patch of [{margin:100000},{leverage:21},{price:NaN},{side:'buy'},{margin:-1}])assert.throws(()=>openPaper(initialPaper(),{...order,...patch}));
 assert.throws(()=>openPaper(s,order));assert.throws(()=>closePaper(initialPaper(),1));assert.throws(()=>closePaper(s,Infinity));
});
test('stored state validation rejects invalid cash and position',()=>{
 assert.ok(validPaper(initialPaper()));assert.equal(validPaper({...initialPaper(),cash:-1}),false);
 assert.equal(validPaper({...initialPaper(),position:{...order,size:NaN}}),false);
});
