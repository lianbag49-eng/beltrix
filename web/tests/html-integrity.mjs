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
