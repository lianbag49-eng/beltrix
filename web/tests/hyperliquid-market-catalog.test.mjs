import test from 'node:test';import assert from 'node:assert/strict';
import {hyperliquidLogoUrl,hyperliquidAssetName,normalizeAllPerpMetas,enrichHyperliquidRow} from '../hyperliquid-market-catalog.js';

test('Hyperliquid official-hosted logo URL follows market asset convention',()=>{
 assert.equal(hyperliquidLogoUrl('BTC'),'https://app.hyperliquid.xyz/coins/BTC_USDC.svg');
 assert.equal(hyperliquidLogoUrl('xyz:XYZ100'),'https://app.hyperliquid.xyz/coins/XYZ100_USDC.svg');
});

test('known asset names are enriched while unknown assets stay readable',()=>{
 assert.equal(hyperliquidAssetName('BTC'),'Bitcoin');
 assert.equal(hyperliquidAssetName('abc:NEWCOIN'),'NEWCOIN');
});

test('allPerpMetas normalizes validator and HIP-3 markets with correct asset ids',()=>{
 const rows=normalizeAllPerpMetas([
  [{universe:[{name:'BTC',szDecimals:5,maxLeverage:50}]},[{markPx:'70000'}]],
  [{universe:[{name:'xyz:XYZ100',szDecimals:2,maxLeverage:20,onlyIsolated:true}]},[{markPx:'10'}]]
 ]);
 assert.equal(rows.length,2);
 assert.equal(rows[0].asset,0);
 assert.equal(rows[0].value,'BTC');
 assert.equal(rows[1].asset,110000);
 assert.equal(rows[1].value,'xyz:XYZ100');
 assert.equal(rows[1].onlyIsolated,true);
 assert.equal(rows[1].tradeSupported,false);
});


test('spot market ids use base token for the official Hyperliquid logo',()=>{
 const row=enrichHyperliquidRow({value:'@107',base:'HYPE',quote:'USDC',spot:true});
 assert.equal(row.logo,'https://app.hyperliquid.xyz/coins/HYPE_USDC.svg');
 assert.equal(row.name,'Hyperliquid');
});
