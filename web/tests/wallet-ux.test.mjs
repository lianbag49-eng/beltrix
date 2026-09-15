import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWalletRoute, walletAssetMatches } from '../wallet-ux.js';

test('wallet is the default; known pages and legacy links stay valid', () => {
  assert.equal(resolveWalletRoute(''), 'wallet');
  assert.equal(resolveWalletRoute('#assets'), 'wallet');
  assert.equal(resolveWalletRoute('#discover'), 'explore');
  for (const page of ['wallet', 'markets', 'swap', 'settings', 'explore', 'defi', 'boost']) assert.equal(resolveWalletRoute('#' + page), page);
});
test('untrusted hashes cannot target dialogs, prototypes or external addresses', () => {
  for (const hash of ['#wDialog', '#__proto__', '#constructor', '#https://example.test', '#<script>', null]) assert.equal(resolveWalletRoute(hash), 'wallet');
  assert.equal(resolveWalletRoute('#bad', 'markets'), 'markets');
  assert.equal(resolveWalletRoute('#bad', 'constructor'), 'wallet');
});
test('asset filtering handles blank, Unicode and case-insensitive symbols', () => {
  assert.equal(walletAssetMatches(' ', 'ETH', 'native'), true);
  assert.equal(walletAssetMatches(' ＥＴＨ ', 'ETH', 'native'), true);
  assert.equal(walletAssetMatches('usdc', 'USDC', '0x123'), true);
  assert.equal(walletAssetMatches('btc', 'ETH', 'native'), false);
});
test('contract filters are literal, not executable selectors or regexes', () => {
  assert.equal(walletAssetMatches('0xABC', 'TOKEN', '0xabcdef'), true);
  assert.equal(walletAssetMatches('.*', 'ETH', 'native'), false);
  assert.equal(walletAssetMatches('[', 'ETH', 'native'), false);
  assert.equal(walletAssetMatches('onerror=', 'ETH', 'native'), false);
});
