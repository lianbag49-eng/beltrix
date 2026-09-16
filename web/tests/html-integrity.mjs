import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const root=resolve(process.argv[2]||'web');
const html=await readFile(resolve(root,'index.html'),'utf8');
assert.match(html,/<\/body>\s*<\/html>\s*$/i,'Document must not be truncated');
for(const id of ['tradeDialog','tradeSubmit','tradeLiveAck','tradePositions','tradeOrders','paperReview','pay','settings','toast'])assert.ok(html.includes(`id="${id}"`),`Missing critical element: ${id}`);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate element IDs');
const paths=[...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="\.\/([^"?#]+)[^"]*"/g)].map(m=>m[1]);
for(const path of paths){assert.ok(!path.includes('..'));assert.ok((await stat(resolve(root,path))).size>0,`Missing/empty asset: ${path}`);}
assert.ok((await stat(resolve(root,'mobile-futures.css'))).size>0,'Missing futures stylesheet');
const trading=await readFile(resolve(root,'trading.bundle.js'),'utf8');
for(const marker of ['fastOrderBar','futuresSizePercent','futuresLong','futuresChart'])assert.ok(trading.includes(marker),`Unwired futures control: ${marker}`);
console.log(`HTML integrity passed: ${ids.length} unique IDs and ${paths.length} local assets (${root})`);

const wallet=await readFile(resolve(root,'wallet.bundle.js'),'utf8');
for(const marker of ['fundingDialog','fundingReceiveQR','fundingSubmit','fundingPaymentImport'])assert.ok(wallet.includes(marker),`Unwired funding control: ${marker}`);
assert.ok((await stat(resolve(root,'funding.css'))).size>0,'Missing funding stylesheet');

assert.ok(wallet.includes('walletUsdtEntry'),'Missing USDT entry point');
for(const name of ['usdt.bundle.js','usdt.css'])assert.ok((await stat(resolve(root,name))).size>0,'Missing USDT asset: '+name);
const usdt=await readFile(resolve(root,'usdt.bundle.js'),'utf8');
for(const marker of ['usdtDialog','usdtRecipientAck','usdtSignAck','usdtNetwork','TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t','Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'])assert.ok(usdt.includes(marker),'Unwired USDT feature: '+marker);

assert.ok((await stat(resolve(root,'trade-simple.css'))).size>0,'Missing simple trading stylesheet');
for(const marker of ['tradeLayoutMode','simpleOrderOptions','simpleMarketDetails','data-trade-product'])assert.ok(trading.includes(marker),'Unwired simple trading UI: '+marker);
