import test from 'node:test';
import assert from 'node:assert/strict';
import {installTradeFocusGuard} from '../trade-focus.js';
class Target {
 constructor(){this.handlers=new Map()}
 addEventListener(k,f){if(!this.handlers.has(k))this.handlers.set(k,new Set());this.handlers.get(k).add(f)}
 removeEventListener(k,f){this.handlers.get(k)?.delete(f)}
 fire(k,p={}){for(const f of this.handlers.get(k)||[])f(p)}
}
function fixture(){
 const win=new Target(),doc=new Target(),ticket=new Target();win.document=doc;
 let docTop=800,scroll=620,time=0,nextId=0;
 const frames=new Map(),observers=[];
 win.innerHeight=844;win.visualViewport=null;win.performance={now:()=>time};win.matchMedia=()=>({matches:true});
 Object.defineProperty(win,'scrollY',{get:()=>scroll});
 doc.scrollingElement={get scrollTop(){return scroll},set scrollTop(v){scroll=v}};
 win.requestAnimationFrame=f=>{const id=++nextId;frames.set(id,f);return id};
 win.cancelAnimationFrame=id=>frames.delete(id);
 win.MutationObserver=class{constructor(cb){observers.push(cb)}observe(){}disconnect(){}};
 const input={matches:()=>true,isConnected:true,getBoundingClientRect:()=>({top:docTop-scroll,height:42}),focus(){doc.activeElement=input}};
 ticket.contains=x=>x===input;doc.activeElement=input;
 const dispose=installTradeFocusGuard({ticket,layoutRoot:ticket,win});
 const flush=()=>{const copy=[...frames.values()];frames.clear();for(const f of copy)f()};
 return {win,doc,ticket,input,frames,dispose,flush,get scroll(){return scroll},arm(){ticket.fire('focusin',{target:input});flush()},shift(v){docTop+=v},move(v){scroll=v},time(v){time=v},mutation(){observers.forEach(f=>f());flush()}};
}
test('controller corrects late layout once and schedules no perpetual frame',()=>{
 const f=fixture();f.arm();f.shift(130);f.mutation();assert.equal(f.scroll,750);assert.equal(f.frames.size,0);f.mutation();assert.equal(f.scroll,750);f.dispose();
});
test('controller never reverses scrollIntoView across market mutations',()=>{
 const f=fixture();f.arm();f.move(1100);for(let i=0;i<8;i++)f.mutation();assert.equal(f.scroll,1100);f.dispose();
});
test('market mutations cannot renew an expired focus window',()=>{
 const f=fixture();f.arm();f.time(1500);f.mutation();f.shift(130);f.mutation();assert.equal(f.scroll,620);f.dispose();
});
test('touch movement releases compensation without waiting for focusout',()=>{
 const f=fixture();f.arm();f.win.fire('touchmove');f.shift(130);f.mutation();assert.equal(f.scroll,620);f.dispose();
});
test('a new user input may arm a fresh independent layout window',()=>{
 const f=fixture();f.arm();f.time(1500);f.mutation();f.ticket.fire('input',{target:f.input});f.flush();f.shift(130);f.mutation();assert.equal(f.scroll,750);f.dispose();
});
test('synthetic chart resize preserves a pending layout correction',()=>{
 const f=fixture();f.arm();f.shift(130);f.win.fire('resize');f.flush();assert.equal(f.scroll,750);f.dispose();
});
test('real keyboard viewport resize releases the correction',()=>{
 const f=fixture();f.arm();f.win.innerHeight=400;f.shift(130);f.win.fire('resize');f.flush();assert.equal(f.scroll,620);f.dispose();
});
test('resuming input after expiry never reuses a stale layout sample',()=>{
 const f=fixture();f.arm();f.time(1500);f.shift(100);f.ticket.fire('input',{target:f.input});f.flush();assert.equal(f.scroll,620);f.shift(30);f.mutation();assert.equal(f.scroll,650);f.dispose();
});
