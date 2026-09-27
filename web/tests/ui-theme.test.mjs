import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeTheme,nextTheme,themeMetaColor,BELTRIX_THEMES,THEME_STORAGE_KEY} from '../ui-theme-core.js';

test('Pearl Cobalt defaults to light and accepts only supported themes',()=>{
 assert.equal(normalizeTheme(null),'light');
 assert.equal(normalizeTheme('LIGHT'),'light');
 assert.equal(normalizeTheme('dark'),'dark');
 assert.equal(normalizeTheme('blue'),'light');
 assert.deepEqual(BELTRIX_THEMES,['light','dark']);
});

test('theme toggle alternates light and dark',()=>{
 assert.equal(nextTheme('light'),'dark');
 assert.equal(nextTheme('dark'),'light');
});

test('theme metadata matches the active surface',()=>{
 assert.equal(themeMetaColor('light'),'#f5f8ff');
 assert.equal(themeMetaColor('dark'),'#07111f');
 assert.equal(THEME_STORAGE_KEY,'beltrix-ui-theme-v1');
});
