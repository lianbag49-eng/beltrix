import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=new URL(process.argv[2]);if(base.protocol!=='https:')throw Error('Expected HTTPS');
const browser=await chromium.launch();const page=await browser.newPage({serviceWorkers:'block'}),errors=[],submissions=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/exchange',r=>{submissions.push(r.request().url());return r.abort();});
const evidence={url:base.href,checkedAt:new Date().toISOString(),walletConnected:false,viewports:[]};
await mkdir('test-results',{recursive:true});
try{
 base.hash='markets';base.searchParams.set('release',process.env.GITHUB_SHA||'futures-v2');
 await page.goto(base.href,{waitUntil:'domcontentloaded'});await page.waitForSelector('#fastOrderBar');
 for(const width of [320,390,430,1280]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(400);
  assert.equal(await page.locator('#futuresLong').isDisabled(),true);assert.equal(await page.locator('#futuresShort').isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow at ${width}`);
  const a=await page.locator('.order-ticket').boundingBox(),b=await page.locator('.depth').boundingBox();
  if(width<=680){assert.ok(a.x+a.width<=b.x);await page.locator('#futuresChart summary').click();assert.ok(await page.locator('#marketCanvas').isVisible());await page.locator('#futuresChart summary').click();}
  evidence.viewports.push({width,layout:'passed',disconnectedOrderLock:'passed'});
  if(width===390)await page.screenshot({path:'test-results/futures-v2-live-mobile.png',fullPage:true});
 }
 evidence.marketStatus=await page.locator('#marketStatus').innerText();assert.deepEqual(errors,[]);assert.deepEqual(submissions,[]);
 evidence.pageErrors=errors;evidence.exchangeSubmissions=submissions;console.log(JSON.stringify(evidence,null,2));
 await writeFile('test-results/futures-v2-live.json',JSON.stringify(evidence,null,2));
}finally{await browser.close();}
