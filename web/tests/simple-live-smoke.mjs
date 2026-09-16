import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url=new URL(process.argv[2]);assert.equal(url.protocol,'https:');url.hash='markets';url.searchParams.set('simple-release',process.env.GITHUB_SHA||'simple-v1');
const browser=await chromium.launch();
const page=await browser.newPage({serviceWorkers:'block'}),errors=[],writes=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/exchange',r=>{writes.push(r.request().url());return r.abort();});
const evidence={url:url.href,checkedAt:new Date().toISOString(),walletConnected:false,products:[]};
await mkdir('test-results',{recursive:true});
try{
 await page.goto(url.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.simpleTrade==='v1');
 assert.equal(await page.locator('#markets').getAttribute('data-trade-layout'),'simple');
 for(const product of ['perp','spot']){
  await page.locator(`[data-trade-product=${product}]`).click();
  await page.waitForFunction(p=>document.querySelector('#marketType').value===p&&document.querySelector('#futuresLong').textContent===(p==='spot'?'Buy':'Open Long'),product);
  for(const width of [320,390,430,1280]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(250);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Document overflow');
   assert.ok(await page.locator('#tradeSize').isVisible());assert.ok(await page.locator('#marketNetwork').isVisible());
   for(const id of ['marketType','tradeSide','tradeReview'])assert.equal(await page.locator('#'+id).isVisible(),false);
   for(const id of ['futuresLong','futuresShort'])assert.ok(await page.locator('#'+id).isDisabled());
   if(product==='spot')assert.equal(await page.locator('.fast-open-close').isVisible(),false);
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`test-results/simple-${product}-live-mobile.png`,fullPage:true});
  evidence.products.push({product,viewports:[320,390,430,1280],layout:'passed',disconnectedLock:'passed'});
 }
 await page.locator('#tradeSize').fill('0.25');
 await page.locator('#tradeLayoutMode').click();assert.equal(await page.locator('#markets').getAttribute('data-trade-layout'),'advanced');assert.equal(await page.locator('#tradeSize').inputValue(),'0.25');
 await page.locator('#tradeLayoutMode').click();assert.equal(await page.locator('#markets').getAttribute('data-trade-layout'),'simple');assert.equal(await page.locator('#tradeSize').inputValue(),'0.25');
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);evidence.valuePreservation='passed';evidence.pageErrors=errors;evidence.exchangeSubmissions=writes;
 await writeFile('test-results/simple-trading-live.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}catch(e){await page.screenshot({path:'test-results/simple-live-failed.png',fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();}
