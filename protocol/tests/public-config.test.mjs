import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalPublicConfig,publicConfigFingerprint,buildDisclosureBundle,stablePublicConfigJson} from '../public-config.js';

test('public config is deterministic and fingerprinted',()=>{
 const input={
  revision:3,network:'testnet',stage:'hybrid',
  ownership:{owner:'0x1111111111111111111111111111111111111111'},
  governance:{quorum:2,signers:['0x2','0x1']},
  oracle:{quorum:2,operators:['0xa','0xb']},
  markets:[{id:'BTC-PERP'}],
  settlements:[{id:'hyperliquid'}],
  generatedAt:'2026-09-27T00:00:00Z'
 };
 const a=canonicalPublicConfig(input),b=canonicalPublicConfig({...input});
 assert.equal(stablePublicConfigJson(a),stablePublicConfigJson(b));
 assert.equal(publicConfigFingerprint(a),publicConfigFingerprint(b));
 assert.match(publicConfigFingerprint(a),/^sha256:[0-9a-f]{64}$/);
});

test('disclosure bundle explicitly excludes secrets',()=>{
 const bundle=buildDisclosureBundle({revision:1,network:'testnet'});
 assert.equal(bundle.disclosure.containsPrivateKeys,false);
 assert.equal(bundle.disclosure.containsSecrets,false);
});

test('secret-like public config keys are rejected',()=>{
 assert.throws(()=>canonicalPublicConfig({
  revision:1,
  ownership:{privateKey:'0xabc'}
 }),/forbidden secret-like key/);
});
