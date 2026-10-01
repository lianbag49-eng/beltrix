const {test,expect}=require('@playwright/test');
const {setup,connect}=require('./simple-trade-fixture.cjs');

for(const width of [1024,1366,1920]){
 test(`desktop ${width}px exposes chart, book and order ticket without overlap`,async({page})=>{
  await page.setViewportSize({width,height:960});
  const {posted}=await setup(page);
  await expect(page.locator('#markets')).toHaveAttribute('data-trade-surface','desktop');
  await expect(page.locator('.trade-layout>.chart-panel')).toBeVisible();
  await expect(page.locator('#marketCanvas')).toBeVisible();
  await expect(page.locator('#futuresChart')).toBeHidden();
  const chart=await page.locator('.chart-panel').boundingBox();
  const book=await page.locator('.depth').boundingBox();
  const ticket=await page.locator('.order-ticket').boundingBox();
  const account=await page.locator('.terminal-account').boundingBox();
  expect(chart.width).toBeGreaterThan(width*0.30);
  expect(chart.x+chart.width).toBeLessThanOrEqual(book.x+1);
  expect(book.x+book.width).toBeLessThanOrEqual(ticket.x+1);
  expect(Math.abs(book.y-ticket.y)).toBeLessThan(2);
  expect(account.y).toBeGreaterThanOrEqual(Math.max(chart.y+chart.height,book.y+book.height,ticket.y+ticket.height)-1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('#pcSidebar')).toBeHidden();
  await expect(page.locator('#pcRightRail')).toBeVisible();
  for(const theme of ['light','dark']){
   if(theme==='dark')await page.locator('#pcThemeToggle').click();
   await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
   await expect(page.locator('#marketCanvas')).toBeVisible();
   if(width===1366)await page.screenshot({path:`test-results/beltrix-desktop-${theme}.png`,fullPage:true});
  }
  expect(posted).toEqual([]);
 });
}

test('desktop/mobile switching preserves inputs and restores the same chart after fullscreen',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 const {posted}=await setup(page);await connect(page);
 await page.locator('#tradeSize').fill('0.2500');
 await page.evaluate(()=>{window.originalSizeInput=document.querySelector('#tradeSize');window.originalChart=document.querySelector('#marketCanvas')});
 await page.locator('#cleanOpenChart').click();
 await expect(page.locator('#chartFullscreen')).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 await page.locator('#chartExpand').click();
 await expect(page.locator('#markets')).toHaveAttribute('data-trade-surface','mobile');
 await expect(page.locator('#futuresChart')).toBeVisible();
 await expect(page.locator('#simpleMarketDetails')).not.toHaveAttribute('open','');
 const ticket=await page.locator('.order-ticket').boundingBox(),book=await page.locator('.depth').boundingBox();
 expect(ticket.x+ticket.width).toBeLessThanOrEqual(book.x+1);
 await expect(page.locator('#tradeSize')).toHaveValue('0.2500');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/beltrix-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 await expect(page.locator('.trade-layout>.chart-panel')).toBeVisible();
 expect(await page.evaluate(()=>document.querySelector('#tradeSize')===window.originalSizeInput&&document.querySelector('#marketCanvas')===window.originalChart)).toBe(true);
 expect(posted).toEqual([]);
 expect(await page.evaluate(()=>window.calls.filter(c=>/sign|sendTransaction/.test(c.method)))).toEqual([]);
});

test('tablet and compact phones retain navigation and fit the viewport',async({page})=>{
 await setup(page);
 for(const width of [320,390,768,960]){
  await page.setViewportSize({width,height:900});
  await expect(page.locator('#markets')).toHaveAttribute('data-trade-surface','mobile');
  await expect(page.locator('.bottom-nav')).toBeVisible();
  await expect(page.locator('#pcSidebar')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
