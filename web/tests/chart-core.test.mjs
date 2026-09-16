import {test} from 'node:test';import assert from 'node:assert/strict';
import {sma,ema,rsi,bollinger,macd,chartPreferences,normalizeCandles,visibleWindow,calculateIndicators} from '../chart-core.js';
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test('SMA and EMA have exact warm-up and SMA seed, no invented zero',()=>{
 assert.deepEqual(sma([1,2,3,4,5],3),[null,null,2,3,4]);assert.deepEqual(ema([1,2,3,4,5],3),[null,null,2,3,4]);
 assert.deepEqual(ema([2,2,2,8,8],3),[null,null,2,5,6.5]);assert.deepEqual(sma([1,null,2,3,4],3),[null,null,null,null,3]);
 assert.throws(()=>rsi([1,2],0));assert.throws(()=>ema([1],1.5));
});
test('Wilder RSI matches a fixed reference price sequence',()=>{
 const close=[44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46.00,46.03,46.41,46.22,45.64,46.21];
 const out=rsi(close);assert.equal(out.slice(0,14).every(x=>x===null),true);near(out[14],70.464135021097,1e-8);near(out[15],66.249618553555,1e-8);
 assert.equal(rsi(Array(30).fill(2)).at(-1),50);assert.equal(rsi(Array.from({length:30},(_,i)=>i)).at(-1),100);assert.equal(rsi(Array.from({length:30},(_,i)=>40-i)).at(-1),0);
});
test('Bollinger population deviation and flat values',()=>{
 const b=bollinger([1,2,3,4,5],3,2);near(b.upper[2],2+2*Math.sqrt(2/3));near(b.lower[2],2-2*Math.sqrt(2/3));
 assert.deepEqual(bollinger([8,8,8],3),{middle:[null,null,8],upper:[null,null,8],lower:[null,null,8]});
});
test('MACD warm-up, histogram identity and no look-ahead',()=>{
 const values=Array.from({length:90},(_,i)=>100+i+Math.sin(i));const a=macd(values);
 assert.equal(a.line.slice(0,25).every(x=>x===null),true);assert.equal(a.signal.slice(0,33).every(x=>x===null),true);
 for(let i=33;i<90;i++)near(a.histogram[i],a.line[i]-a.signal[i]);
 const prefix=macd(values.slice(0,60));assert.deepEqual(a.line.slice(0,60),prefix.line);
 assert.throws(()=>macd(values,26,12));
});
test('Malformed quotes, duplicates and saved settings are bounded',()=>{
 const good={t:100,o:2,c:3,l:1,h:4,v:0};
 assert.equal(normalizeCandles([good,{...good,c:2.5},{...good,t:50}, {...good,t:200,v:-1},{...good,t:300,c:null}]).length,2);
 assert.equal(normalizeCandles([good,{...good,c:2.5}])[0].c,2.5);
 const p=chartPreferences({rsiPeriod:999,maPeriod:7,muted:true,evil:'x',ema:'yes'});assert.equal(p.rsiPeriod,14);assert.equal(p.maPeriod,7);assert.equal(p.muted,true);assert.equal(p.ema,false);assert.equal(p.evil,undefined);
});
test('Visible window stays bounded under zoom and panning',()=>{
 assert.deepEqual(visibleWindow(100,20,10),{start:70,end:90,offset:10,count:20});assert.deepEqual(visibleWindow(100,20,1000),{start:0,end:20,offset:80,count:20});assert.equal(visibleWindow(0).count,0);
});
test('Updating an incomplete candle replaces indicators, never adds a duplicate bar',()=>{
 const rows=Array.from({length:50},(_,i)=>({t:1000+i,o:100+i,c:101+i,l:99+i,h:102+i,v:5}));
 const changed=normalizeCandles([...rows,{...rows.at(-1),c:rows.at(-1).c-1}]);assert.equal(changed.length,50);
 const original=calculateIndicators(rows,{}),next=calculateIndicators(changed,{});assert.deepEqual(original.rsi.slice(0,49),next.rsi.slice(0,49));assert.notEqual(original.ma[49],next.ma[49]);
});
