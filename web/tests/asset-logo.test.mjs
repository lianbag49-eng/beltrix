import test from 'node:test';
import assert from 'node:assert/strict';
import {hyperliquidDisplaySymbol,hyperliquidLogoUrl,logoFallbackText} from '../asset-logo.js';

test('Hyperliquid official coin CDN URL uses the displayed base symbol',()=>{
 assert.equal(hyperliquidLogoUrl({base:'BTC'}),'https://app.hyperliquid.xyz/coins/BTC.svg');
 assert.equal(hyperliquidLogoUrl({base:'ETH'}),'https://app.hyperliquid.xyz/coins/ETH.svg');
});

test('Hyperliquid frontend display alias maps UBTC to BTC',()=>{
 assert.equal(hyperliquidDisplaySymbol('UBTC'),'BTC');
 assert.equal(hyperliquidLogoUrl({base:'UBTC'}),'https://app.hyperliquid.xyz/coins/BTC.svg');
});

test('DEX-prefixed symbols reduce to the base asset for logo display',()=>{
 assert.equal(hyperliquidDisplaySymbol('xyz:NVDA'),'NVDA');
 assert.equal(logoFallbackText({base:'kPEPE'}),'KPE');
});
