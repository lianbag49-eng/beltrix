const {test,expect}=require('@playwright/test');

test('Pearl Cobalt production shell mounts and toggles dark mode',async({page})=>{
 await page.goto('/web/#markets');
 await expect(page.locator('html')).toHaveAttribute('data-beltrix-ui','pearl-cobalt');
 await expect(page.locator('#pcThemeToggle')).toBeVisible();
 await expect(page.locator('#pcMarketRibbon')).toBeVisible();
 await expect(page.locator('#pcIntelligenceStrip')).toBeVisible();

 const mobile=(page.viewportSize()?.width||1280)<=900;
 if(mobile){
  await expect(page.locator('#pcSidebar')).toBeHidden();
  await expect(page.locator('#pcRightRail')).toBeHidden();
 }else{
  await expect(page.locator('#pcSidebar')).toBeVisible();
  await expect(page.locator('#pcProtocolCard')).toBeVisible();
  await expect(page.locator('#pcMarketIntel')).toBeVisible();
 }

 await page.locator('#pcThemeToggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#07111f');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.locator('#pcThemeToggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});

test('Pearl Cobalt keeps the trading workspace and intelligence strip synchronized',async({page})=>{
 await page.goto('/web/#markets');
 await expect(page.locator('#marketPickerButton')).toBeVisible();
 await expect(page.locator('.chart-panel')).toBeVisible();
 await expect(page.locator('.depth')).toBeVisible();
 await expect(page.locator('.order-ticket')).toBeVisible();
 await expect(page.locator('.terminal-account')).toBeVisible();
 await expect(page.locator('[data-pc-strip="funding"]')).not.toHaveText('—');
 await expect(page.locator('[data-pc-strip="oi"]')).not.toHaveText('—');
 await expect(page.locator('[data-pc-strip="volume"]')).not.toHaveText('—');
});

test('Pearl Cobalt responsive layout avoids horizontal overflow',async({page})=>{
 for(const size of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(size);
  await page.goto('/web/#markets');
  await expect(page.locator('#pcMarketRibbon')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 }
});
