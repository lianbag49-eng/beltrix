import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=new URL(process.argv[2]);if(base.protocol!=='https:')throw Error('Expected HTTPS');
const browser=await chromium.launch();const page=await browser.newPage({serviceWorkers:'block'}),errors=[],submissions=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/exchange',r=>{submissions.push(r.request().url());return r.abort();});
const evidence={url:base.href,checkedAt:new Date().toISOString(),walletConnected:false,viewports:[],scrollChecks:[]};
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
  if(width===390){
   await page.evaluate(()=>{
    window.liveScrollProbe={routes:[],scrolls:[]};
    const open=window.openPage,scroll=window.scrollTo.bind(window);
    window.openPage=(...a)=>{window.liveScrollProbe.routes.push(a[0]);return open(...a);};
    window.scrollTo=(...a)=>{window.liveScrollProbe.scrolls.push(a);return scroll(...a);};
   });
   for(const selector of ['#tradeSize','[data-account-tab=orders]']){
    const el=page.locator(selector);
    await el.evaluate(e=>window.scrollTo({top:Math.max(40,e.getBoundingClientRect().top+scrollY-180),behavior:'instant'}));
    await page.waitForTimeout(100);
    const before=await page.evaluate(()=>scrollY);
    assert.ok(before>0,'Scroll regression must start below the top');
    await page.evaluate(()=>{window.liveScrollProbe.routes=[];window.liveScrollProbe.scrolls=[];});
    await el.click();await page.waitForTimeout(100);
    const after=await page.evaluate(()=>scrollY);
    assert.deepEqual(await page.evaluate(()=>window.liveScrollProbe),{routes:[],scrolls:[]});
    assert.ok(Math.abs(after-before)<=2,`Unexpected scroll after ${selector}: ${before} -> ${after}`);
    if(selector==='#tradeSize')assert.ok(await el.evaluate(e=>document.activeElement===e),'Quantity input lost focus');
    evidence.scrollChecks.push({selector,before,after,result:'passed'});
   }
  }
  if(width===390)await page.screenshot({path:'test-results/futures-v2-live-mobile.png',fullPage:true});
 }
 // Read-only funding UI smoke: no account request, signature or transfer.
 await page.setViewportSize({width:390,height:844});
 await page.locator('#markets [data-funding=deposit]').click();
 assert.ok(await page.locator('#fundingWalletChoice').isVisible());
 await page.locator('#fundingTradingChoice').click();
 assert.ok(await page.locator('#fundingReview').isDisabled());
 assert.ok((await page.locator('#fundingBody').innerText()).includes('minimum 5 USDC'));
 await page.locator('#fundingClose').click();
 await page.locator('#markets [data-funding=withdraw]').click();
 await page.locator('#fundingTradingChoice').click();
 assert.ok(await page.locator('#fundingDestination').isVisible());
 assert.ok(await page.locator('#fundingReview').isDisabled());
 await page.screenshot({path:'test-results/funding-live-mobile.png',fullPage:true});
 await page.locator('#fundingClose').click();
 evidence.fundingUI={deposit:'passed',withdrawal:'passed',disconnectedSubmissionLock:'passed'};
 // USDT lazy entry is checked on the public site without a wallet or any write.
 await page.locator('#markets [data-usdt-open]').click();await page.waitForSelector('#usdtDialog[open]');
 assert.equal(await page.locator('#usdtNetwork option').count(),8);
 for(const id of ['ethereum','bnb','arbitrum','optimism','polygon','avalanche','tron','solana']){
  await page.locator('#usdtNetwork').selectOption(id);await page.locator('[data-usdt-tab=send]').click();
  assert.ok(await page.locator('#usdtReview').isDisabled());
 }
 await page.screenshot({path:'test-results/usdt-live-mobile.png',fullPage:true});
 await page.locator('#usdtClose').click();evidence.usdtUI={routes:8,entry:'passed',disconnectedSubmissionLock:'passed'};
 evidence.marketStatus=await page.locator('#marketStatus').innerText();assert.deepEqual(errors,[]);assert.deepEqual(submissions,[]);
 evidence.pageErrors=errors;evidence.exchangeSubmissions=submissions;console.log(JSON.stringify(evidence,null,2));
 await writeFile('test-results/futures-v2-live.json',JSON.stringify(evidence,null,2));
}finally{await browser.close();}
