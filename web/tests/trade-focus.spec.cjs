const {test,expect}=require('@playwright/test');
const {setup,connect}=require('./simple-trade-fixture.cjs');

for(const layout of ['simple','advanced']){
 test(`${layout}: scroll from a focused quantity to review and cancel without signing`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const {posted}=await setup(page);
  if(await page.locator('#markets').getAttribute('data-trade-layout')!==layout)await page.locator('#tradeLayoutMode').click();
  await connect(page,'mainnet');
  await page.locator('[data-fast-type=Market]').click();
  const input=page.locator('#tradeSize');
  await input.fill('1');
  await expect(input).toBeFocused();
  const review=page.locator('#futuresLong');
  await review.scrollIntoViewIfNeeded();
  // Real market updates continue while the input stays focused. They may not
  // resurrect the old viewport anchor or pull the review button off screen.
  const target=await review.boundingBox();
  await page.waitForTimeout(1800);
  const stable=await review.boundingBox();
  expect(Math.abs(stable.y-target.y)).toBeLessThanOrEqual(2);
  await review.click();
  await expect(page.locator('#tradeDialog')).toBeVisible();
  await expect(page.locator('#tradeSubmit')).toBeDisabled();
  await expect(page.locator('#tradeLiveAck')).not.toBeChecked();
  expect(posted).toHaveLength(0);
  expect(await page.evaluate(()=>window.calls.filter(x=>/sign|send/i.test(x.method)))).toEqual([]);
  await page.locator('#tradeClose').click();
  await expect(page.locator('#tradeDialog')).not.toBeVisible();
  await expect(input).toHaveValue('1');
 });
}

test('layout compensation does not undo a user scroll during subsequent quotes',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await setup(page);
 await page.addStyleTag({content:'.page{min-height:2600px}'});
 const input=page.locator('#tradeSize');
 await input.fill('0.5');
 const requested=await page.evaluate(()=>{const scroller=document.scrollingElement;scroller.scrollTop+=200;return scroller.scrollTop;});
 await page.waitForTimeout(1800);
 expect(Math.abs(await page.evaluate(()=>scrollY)-requested)).toBeLessThanOrEqual(2);
 await expect(input).toHaveValue('0.5');
});

test('a late layout insertion and chart resize preserve a focused quantity',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const {posted}=await setup(page);
 await expect(page.locator('#wBeltrixVault')).toBeAttached();
 await connect(page,'mainnet');
 await page.locator('[data-fast-type=Market]').click();
 await page.addStyleTag({content:'html,body{overflow-anchor:none}.page{min-height:2600px}'});
 const input=page.locator('#tradeSize');
 await input.evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-180));
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await input.click();
 await page.keyboard.type('0.5');
 const before=await input.evaluate(e=>({top:e.getBoundingClientRect().top,documentTop:e.getBoundingClientRect().top+scrollY}));
 await page.evaluate(()=>{
  const spacer=document.createElement('div');
  spacer.id='focus-test-late-widget';
  spacer.style.cssText='display:block;height:130px;min-height:130px;margin:0;padding:0;border:0;';
  document.querySelector('.order-ticket').prepend(spacer);
  window.dispatchEvent(new Event('resize'));
 });
 await expect.poll(()=>input.evaluate(e=>e.getBoundingClientRect().top+scrollY)).toBeGreaterThanOrEqual(before.documentTop+125);
 await expect.poll(async()=>Math.abs((await input.boundingBox()).y-before.top)).toBeLessThanOrEqual(2);
 await expect(input).toBeFocused();
 await expect(input).toHaveValue('0.5');
 await page.locator('#futuresLong').click();
 await expect(page.locator('#tradeDialog')).toBeVisible();
 await expect(page.locator('#tradeSubmit')).toBeDisabled();
 expect(posted).toHaveLength(0);
 expect(await page.evaluate(()=>window.calls.filter(x=>/sign|send/i.test(x.method)))).toEqual([]);
 await page.locator('#tradeClose').click();
});
