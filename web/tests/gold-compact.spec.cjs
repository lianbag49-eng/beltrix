const {test,expect}=require('@playwright/test');
const {setup}=require('./simple-trade-fixture.cjs');
async function compact(page){
 const state=await setup(page);
 await expect(page.locator('html')).toHaveAttribute('data-beltrix-theme','black-gold');
 if(await page.locator('#markets').getAttribute('data-trade-layout')!=='simple')await page.locator('#tradeLayoutMode').click();
 return state;
}
test('approved Black Gold layout has one primary action and preserves the original inputs',async({page})=>{
 const {posted}=await compact(page);await page.evaluate(()=>window.goldInput=document.getElementById('tradeSize'));
 for(const product of ['perp','spot']){
  await page.locator(`[data-trade-product=${product}]`).click();await expect(page.locator('#marketType')).toHaveValue(product);
  for(const direction of ['buy','sell']){
   await page.locator(`[data-gold-direction=${direction}]`).click();await expect(page.locator('#tradeSide')).toHaveValue(direction);
   const primary=direction==='buy'?'futuresLong':'futuresShort',other=direction==='buy'?'futuresShort':'futuresLong';
   await expect(page.locator('#'+primary)).toBeVisible();await expect(page.locator('#'+primary)).toBeDisabled();await expect(page.locator('#'+other)).toBeHidden();
  }
  for(const width of [320,390,430,1280]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(180);
   const ticket=await page.locator('.order-ticket').boundingBox(),book=await page.locator('.depth').boundingBox();
   expect(book.x).toBeGreaterThan(ticket.x+ticket.width-1);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await expect(page.locator('#marketCanvas')).toBeVisible();
  }
 }
 expect(await page.evaluate(()=>goldInput===document.getElementById('tradeSize'))).toBe(true);expect(posted).toHaveLength(0);
 expect(await page.evaluate(()=>window.calls.filter(x=>/sign|send/i.test(x.method)))).toEqual([]);
});
test('Black Gold chart returns inline after expanded view on desktop and mobile',async({page})=>{
 await compact(page);
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:844});await page.locator('#tradeSize').fill('0.75');
  await expect(page.locator('#marketCanvas')).toBeVisible();
  await page.locator('#cleanOpenChart').click();await expect(page.locator('#marketCanvas')).toBeVisible();
  await page.locator('#chartExpand').click();await expect(page.locator('#marketCanvas')).toBeVisible();
  await expect(page.locator('#tradeSize')).toHaveValue('0.75');
  expect(await page.locator('#marketCanvas').evaluate(c=>!!c.closest('.trade-layout'))).toBe(true);
  await expect(page.locator('#futuresChart')).toBeHidden();
 }
});
test('capture implemented Black Gold Spot, Futures and chart with labeled test data',async({page,browserName})=>{
 await compact(page);await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{const p=document.createElement('p');p.textContent='UI TEST · SAMPLE DATA · NO CONNECTED ACCOUNT';p.style.cssText='margin:0;padding:6px;text-align:center;font:9px system-ui;color:#d9b66f';document.querySelector('.top').before(p);});
 for(const product of ['perp','spot']){
  await page.locator(`[data-trade-product=${product}]`).click();await expect(page.locator('#marketSymbol')).toHaveValue(product==='spot'?'@0':'ETH');
  await page.locator('[data-fast-type=Market]').click();await page.locator('[data-gold-direction=buy]').click();
  await expect(page.locator('#marketBids .book-level')).toHaveCount(5);await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`test-results/gold-${product}-${browserName}.png`,fullPage:true});
 }
 await page.locator('#cleanOpenChart').click();await page.locator('[data-chart-indicator=macd]').click();await page.locator('[data-chart-indicator=ema]').click();
 await page.evaluate(()=>{const p=document.createElement('p');p.textContent='UI TEST · SIMULATED CANDLES';p.style.cssText='margin:0;padding:6px;text-align:center;font:10px system-ui;color:#d9b66f';document.getElementById('chartFullscreen').prepend(p);});
 await page.waitForTimeout(200);await page.screenshot({path:`test-results/gold-chart-${browserName}.png`});
});
