const {test,expect}=require('@playwright/test');
const {setup,connect}=require('./simple-trade-fixture.cjs');

for(const mode of ['simple','advanced']){
 test(`${mode}: focused size input permits scrolling to the original mainnet review`,async({page})=>{
  const {posted}=await setup(page);
  await page.setViewportSize({width:390,height:844});
  await connect(page,'mainnet');
  if(await page.locator('#markets').getAttribute('data-trade-layout')!==mode){
   await page.locator('#tradeLayoutMode').click();
  }
  await expect(page.locator('#markets')).toHaveAttribute('data-trade-layout',mode);
  await page.locator('[data-fast-type=Market]').click();
  await page.locator('#tradeSize').fill('1');
  await expect(page.locator('#tradeSize')).toBeFocused();
  const target=mode==='simple'?'#futuresLong':'#tradeReview';
  // Normal actionability and native scrolling, never force/dispatchEvent clicks.
  await page.locator(target).click({timeout:7000});
  await expect(page.locator('#tradeDialog')).toBeVisible();
  await expect(page.locator('#tradeLiveAckField')).toBeVisible();
  await expect(page.locator('#tradeSubmit')).toBeDisabled();
  expect(posted).toHaveLength(0);
  expect(await page.evaluate(()=>window.calls.filter(x=>/sign|send/i.test(x.method)))).toEqual([]);
  await page.locator('#tradeClose').click();
  await expect(page.locator('#tradeDialog')).not.toBeVisible();
 });
}

test('late layout insertion is corrected once, while subsequent native scrolling stays free',async({page})=>{
 const {posted}=await setup(page);
 await page.setViewportSize({width:390,height:844});
 // Wait for normal boot, then introduce a controlled late insertion above the ticket.
 await expect(page.locator('#wBeltrixVault')).toBeAttached();
 await page.addStyleTag({content:'html,body,#markets{overflow-anchor:none!important}.page{min-height:2600px}'});
 await page.locator('#tradeSize').evaluate(input=>{
  window.scrollTo(0,input.getBoundingClientRect().top+window.scrollY-180);
  input.focus({preventScroll:true});
 });
 await page.keyboard.type('0.5');
 const before=await page.locator('#tradeSize').evaluate(input=>input.getBoundingClientRect().top);
 await page.evaluate(()=>{
  const spacer=document.createElement('div');
  spacer.dataset.testLayoutShift='true';
  spacer.style.height='130px';
  document.querySelector('.trade-layout').before(spacer);
 });
 await expect.poll(async()=>Math.abs((await page.locator('#tradeSize').evaluate(input=>input.getBoundingClientRect().top))-before),{timeout:1000}).toBeLessThanOrEqual(2);
 await expect(page.locator('#tradeSize')).toBeFocused();
 const target=await page.evaluate(()=>{window.scrollBy(0,160);return window.scrollY});
 await page.waitForTimeout(700);
 expect(Math.abs((await page.evaluate(()=>window.scrollY))-target)).toBeLessThanOrEqual(2);
 await expect(page.locator('#tradeSize')).toHaveValue('0.5');
 expect(posted).toHaveLength(0);
});
