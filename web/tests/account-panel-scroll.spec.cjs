const {test,expect}=require('@playwright/test');

// No artificial page height: exercise the actual document bottom and real tab handler.
test('empty account tabs keep document height and scroll stable near the bottom',async({page})=>{
 await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 await page.setViewportSize({width:390,height:844});
 await page.goto('/web/#markets');
 await expect(page.locator('html')).toHaveAttribute('data-futures-ux','v2');
 await page.waitForTimeout(300);
 await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
 const before=await page.evaluate(()=>({y:scrollY,height:document.documentElement.scrollHeight}));
 expect(before.y).toBeGreaterThan(0);
 for(const name of ['orders','positions','fills','balances','positions']){
  await page.locator(`[data-account-tab=${name}]`).click();
  await expect(page.locator('#account-'+name)).toBeVisible();
  await page.waitForTimeout(60);
  const after=await page.evaluate(()=>({y:scrollY,height:document.documentElement.scrollHeight}));
  expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.height-before.height)).toBeLessThanOrEqual(2);
 }
});
