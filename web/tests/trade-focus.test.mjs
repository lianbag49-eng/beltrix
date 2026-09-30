import test from 'node:test';
import assert from 'node:assert/strict';
import {focusLayoutCorrection} from '../trade-focus.js';
const initial = {documentTop:800,scrollY:620,height:42,viewportHeight:844,viewportOffset:0,viewportScale:1};
test('a late layout shift is compensated when the user has not scrolled', () => {
  assert.equal(focusLayoutCorrection(initial,{...initial,documentTop:930}),130);
  assert.equal(focusLayoutCorrection(initial,{...initial,documentTop:730}),-70);
});
test('scrollIntoView to a review button is never undone', () => {
  assert.equal(focusLayoutCorrection(initial,{...initial,scrollY:1100}),0);
});
test('native scroll anchoring is not applied twice', () => {
  assert.equal(focusLayoutCorrection(initial,{...initial,documentTop:930,scrollY:750}),0);
});
test('simultaneous user scroll and layout changes yield to scrolling', () => {
  assert.equal(focusLayoutCorrection(initial,{...initial,documentTop:930,scrollY:800}),0);
});
test('keyboard and visual viewport changes are not fought', () => {
  assert.equal(focusLayoutCorrection(initial,{...initial,documentTop:930,viewportHeight:400}),0);
  assert.equal(focusLayoutCorrection(initial,{...initial,documentTop:930,viewportOffset:120}),0);
  assert.equal(focusLayoutCorrection(initial,{...initial,documentTop:930,viewportScale:2}),0);
});
test('an offscreen input cannot pin the page', () => {
  const hidden={...initial,scrollY:1100};
  assert.equal(focusLayoutCorrection(hidden,{...hidden,documentTop:930}),0);
});
test('steady state and subpixel noise do not trigger writes', () => {
  assert.equal(focusLayoutCorrection(initial,initial),0);
  assert.equal(focusLayoutCorrection(initial,{...initial,documentTop:800.2}),0);
});
test('invalid samples are ignored', () => {
  assert.equal(focusLayoutCorrection(null,initial),0);
  assert.equal(focusLayoutCorrection(initial,{...initial,scrollY:NaN}),0);
});
