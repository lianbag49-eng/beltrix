const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path');
const ORIGIN='https://appassets.androidplatform.net';
const ROOT=path.resolve('android/app/src/main/assets/beltrix');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
test.beforeEach(async({page})=>{
 await page.route('**/*',async r=>{
  const url=new URL(r.request().url());
  if(url.origin!==ORIGIN)return r.abort();
  const name=url.pathname.replace('/assets/beltrix/','');if(!/^[A-Za-z0-9._-]+$/.test(name))return r.fulfill({status:404,body:''});
  try{return r.fulfill({contentType:mime[path.extname(name)]||'application/json',body:await fs.readFile(path.join(ROOT,name))})}catch{return r.fulfill({status:404,body:''})}
 });
 await page.addInitScript(()=>{
  window.nativeMessages=[];window.BeltrixAndroid={postMessage(raw){const m=JSON.parse(raw);nativeMessages.push(m);queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({id:m.id,ok:true,value:'Android prompt handled'})}));}};
  window.WebSocket=class {constructor(){this.readyState=3;}send(){}close(){}};
 });
 await page.goto(ORIGIN+'/assets/beltrix/index.html#wallet');
 await expect(page.locator('html')).toHaveAttribute('data-android-preview','1');
 await expect(page.locator('#walletUsdtEntry')).toBeVisible();
});
async function usdt(page){await page.locator('#walletUsdtEntry').click();await expect(page.locator('#usdtDialog')).toBeVisible();}
async function qr(page){await usdt(page);await page.locator('.usdt-watch > summary').click();await page.locator('#usdtWatchAddress').fill('0x1111111111111111111111111111111111111111');await page.locator('#usdtWatch').click();await expect(page.locator('#usdtQR')).toBeVisible();await expect.poll(()=>page.locator('#usdtQR').evaluate(c=>c.width)).toBeGreaterThan(100);}
test('packaged UI does not inject an account or signer',async({page})=>{
 expect(await page.evaluate(()=>!window.ethereum&&!window.tronWeb&&!window.solana)).toBe(true);
 await page.locator('.bottom-nav [data-page=markets]').click();await expect(page.locator('#futuresLong')).toBeDisabled();await expect(page.locator('#futuresShort')).toBeDisabled();
 await page.locator('#tradeConnect').click();await expect.poll(()=>page.evaluate(()=>nativeMessages.at(-1)?.action)).toBe('wallet');
});
test('eight-network receiving produces a real PNG handed to the native saver',async({page})=>{
 await qr(page);await expect(page.locator('#usdtNetwork option')).toHaveCount(8);await page.locator('#usdtSaveQR').click();
 await expect.poll(()=>page.evaluate(()=>nativeMessages.at(-1)?.action)).toBe('export');
 const data=await page.evaluate(()=>nativeMessages.at(-1));expect(data.mime).toBe('image/png');expect(Buffer.from(data.base64,'base64').subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');expect(data.name).toContain('receive.png');
 await page.screenshot({path:'android-evidence/browser/android-qr.png',fullPage:true});
});
test('address copy and share use explicit native operations without reading clipboard',async({page})=>{
 await qr(page);await page.locator('#usdtCopyAddress').click();await expect.poll(()=>page.evaluate(()=>nativeMessages.at(-1)?.action)).toBe('copy');
 expect(await page.evaluate(()=>nativeMessages.at(-1).text)).toBe('0x1111111111111111111111111111111111111111');
 await page.locator('#usdtShareQR').click();await expect.poll(()=>page.evaluate(()=>nativeMessages.at(-1)?.action)).toBe('shareText');
 expect(await page.evaluate(()=>typeof navigator.clipboard.readText)).toBe('undefined');
});
test('immediately revoked CSV blobs still export; other file types are rejected',async({page})=>{
 await page.evaluate(()=>{const url=URL.createObjectURL(new Blob(['asset,amount\nUSDT,1\n'],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='history.csv';a.click();URL.revokeObjectURL(url);});
 await expect.poll(()=>page.evaluate(()=>nativeMessages.at(-1)?.action)).toBe('export');
 expect(await page.evaluate(()=>nativeMessages.at(-1).mime)).toBe('text/csv');
 await page.evaluate(()=>{const a=document.createElement('a');a.href='data:text/html,<script>bad</script>';a.download='bad.html';a.click();});
 expect(await page.evaluate(()=>nativeMessages.length)).toBe(1);
});
test('Android back dismisses current dialog and retains route and scroll',async({page})=>{
 await page.locator('.bottom-nav [data-page=markets]').click();await page.locator('#tradeSize').scrollIntoViewIfNeeded();
 const before=await page.evaluate(()=>scrollY);await page.evaluate(()=>document.getElementById('tradeDialog').showModal());
 expect(await page.evaluate(()=>BeltrixNative.back())).toBe('handled');await expect(page.locator('#tradeDialog')).not.toBeVisible();
 expect(await page.evaluate(()=>document.body.dataset.page)).toBe('markets');expect(Math.abs(await page.evaluate(()=>scrollY)-before)).toBeLessThanOrEqual(2);
 expect(await page.evaluate(()=>BeltrixNative.back())).toBe('unhandled');
});
test('external URLs cannot navigate the native document or execute intent payloads',async({page})=>{
 await page.evaluate(()=>window.open('https://example.com/details'));
 await expect.poll(()=>page.evaluate(()=>nativeMessages.at(-1)?.action)).toBe('openExternal');
 await page.evaluate(()=>window.open('intent://malicious/#Intent;end'));
 expect(await page.evaluate(()=>nativeMessages.length)).toBe(1);expect(new URL(page.url()).origin).toBe(ORIGIN);
});
test('image import fills only a recipient and cannot enable a watch-only transfer',async({page})=>{
 await qr(page);const png=await page.locator('#usdtQR').evaluate(c=>c.toDataURL('image/png'));
 await page.locator('[data-usdt-tab=send]').click();await page.locator('#usdtQrFile').setInputFiles({name:'qr.png',mimeType:'image/png',buffer:Buffer.from(png.split(',')[1],'base64')});
 await expect(page.locator('#usdtRecipient')).toHaveValue('0x1111111111111111111111111111111111111111');await expect(page.locator('#usdtReview')).toBeDisabled();
});
