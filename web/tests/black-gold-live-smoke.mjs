import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url=new URL(process.argv[2]);assert.equal(url.protocol,'https:');url.hash='markets';url.searchParams.set('gold-release',process.env.GITHUB_SHA||'black-gold');
const browser=await chromium.launch(),page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}});
const errors=[],writes=[],evidence={url:url.href,checkedAt:new Date().toISOString(),walletConnected:false,products:[]};
page.on('pageerror',e=>errors.push(e.message));await page.route('**/exchange',r=>{writes.push(r.request().url());return r.abort();});
await mkdir('test-results',{recursive:true});
try{
 await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.beltrixTheme==='black-gold');
 assert.equal(await page.locator('.app>.nav').isVisible(),false);assert.equal(await page.locator('nav').evaluateAll(ns=>ns.filter(n=>n.getClientRects().length).length),1);
 for(const product of ['perp','spot']){
  await page.locator(`[data-trade-product=${product}]`).click();await page.waitForFunction(p=>document.querySelector('#marketType').value===p,product);
  await page.locator('[data-gold-direction=buy]').click();
  for(const width of [320,390,430,1280]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(200);
   const a=await page.locator('.order-ticket').boundingBox(),b=await page.locator('.depth').boundingBox();assert.ok(a.x+a.width<=b.x+1,'Ticket must be left of book');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');
   await expect(page.locator('#futuresLong')).toBeVisible();await expect(page.locator('#futuresShort')).toBeHidden();
   await expect(page.locator('#futuresLong')).toBeDisabled();await expect(page.locator('#marketCanvas')).toBeHidden();
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/black-gold-${product}-live.png`,fullPage:true});
  await page.locator('[data-gold-direction=sell]').click();await page.waitForFunction(()=>document.querySelector('#markets').dataset.compactDirection==='sell');
  await expect(page.locator('#futuresShort')).toBeVisible();await expect(page.locator('#futuresLong')).toBeHidden();await expect(page.locator('#futuresShort')).toBeDisabled();
  evidence.products.push({product,layout:'passed',viewports:[320,390,430,1280],singleReviewAction:'passed',disconnectedLock:'passed'});
 }
 await page.locator('#tradeSize').fill('0.25');await page.locator('#cleanOpenChart').click();await page.waitForSelector('#chartFullscreen[open]');
 for(const id of ['volume','rsi','macd','ma','ema','boll'])await expect(page.locator(`[data-chart-indicator=${id}]`)).toBeVisible();
 await page.locator('[data-chart-indicator=macd]').click();await expect(page.locator('[data-chart-indicator=macd]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#chartMuteIndicators').click();await expect(page.locator('[data-chart-indicator=macd]')).toHaveAttribute('aria-pressed','false');
 await page.locator('#chartMuteIndicators').click();await expect(page.locator('[data-chart-indicator=macd]')).toHaveAttribute('aria-pressed','true');
 evidence.candlesAvailable=Number(await page.locator('#marketCanvas').getAttribute('data-chart-bars'))||0;evidence.marketStatus=await page.locator('#marketStatus').textContent();
 await page.screenshot({path:'test-results/black-gold-chart-live.png'});await page.locator('#chartExpand').click();
 await expect(page.locator('#marketCanvas')).toBeHidden();await expect(page.locator('#tradeSize')).toHaveValue('0.25');
 await page.locator('#tradeLayoutMode').click();await page.locator('#tradeLayoutMode').click();await expect(page.locator('#tradeSize')).toHaveValue('0.25');
 evidence.chartControls='passed';evidence.inputPreservation='passed';assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);evidence.pageErrors=errors;evidence.exchangeSubmissions=writes;
 await writeFile('test-results/black-gold-live.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}catch(e){await page.screenshot({path:'test-results/black-gold-live-failed.png',fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();}
