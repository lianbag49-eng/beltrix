import test from 'node:test';
import assert from 'node:assert/strict';
import {sizeFraction,closingSide} from '../futures-sizing.js';
test('percentages use exact venue quantities with downward precision',()=>{assert.equal(sizeFraction('10.12349',50,4,200),'4.9605');assert.equal(sizeFraction('9.98765',50,4,200),'4.8939');});
test('MAX retains a buffer only on opens',()=>{assert.equal(sizeFraction('10',100,4,200),'9.8');assert.equal(sizeFraction('2',100,4),'2');});
test('zero, dust and integer markets do not round upward',()=>{assert.equal(sizeFraction('0.00009',100,4),'0');assert.equal(sizeFraction('3',50,0),'1');assert.equal(sizeFraction('3',0,4),'0');});
test('large decimal strings retain precision',()=>assert.equal(sizeFraction('123456789012345.12345678',100,8),'123456789012345.12345678'));
test('invalid raw data fails closed',()=>{for(const value of ['—','NaN','-1','1e6','0x10','1,000','',null])assert.throws(()=>sizeFraction(value,50,4));for(const pct of [-1,101,2.5])assert.throws(()=>sizeFraction('1',pct,4));assert.throws(()=>sizeFraction('1',50,9));});
test('close side is opposite to the existing position',()=>{assert.equal(closingSide('2'),'sell');assert.equal(closingSide('-2'),'buy');assert.equal(closingSide('0'),null);assert.equal(closingSide('unavailable'),null);});
