const {test,expect}=require('@playwright/test');
const {setup}=require('./simple-trade-fixture.cjs');

test('Pearl Cobalt mounts the approved dashboard composition without replacing trade controls',async({page})=>{
 await page.setViewportSize({width:1440,height:920});
 await setup(page);
 await expect(page.locator('html')).toHaveAttribute('data-beltrix-ui','pearl-cobalt');
 await expect(page.locator('body')).toHaveAttribute('data-pearl-cobalt','ready');
 await expect(page.locator('#pcSidebar')).toBeVisible();
 await expect(page.locator('#pcMarketStrip')).toBeVisible();
 await expect(page.locator('#pcIntelligenceBar')).toBeVisible();
 await expect(page.locator('#pcProtocolCard')).toBeVisible();
 expect(await page.locator('.pc-ticker-card').count()).toBeGreaterThanOrEqual(3);
 await page.evaluate(()=>window.__pcTradeSize=document.getElementById('tradeSize'));
 expect(await page.evaluate(()=>window.__pcTradeSize===document.getElementById('tradeSize'))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Pearl Cobalt defaults to light, toggles dark, and persists',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 await setup(page);
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect(page.locator('#pcThemeToggle')).toBeVisible();
 await page.locator('#pcThemeToggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.evaluate(()=>localStorage.getItem('beltrix-ui-theme-v1'))).toBe('dark');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.locator('#pcThemeToggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 expect(await page.evaluate(()=>localStorage.getItem('beltrix-ui-theme-v1'))).toBe('light');
});

test('Pearl Cobalt keeps market intelligence synchronized with the selected market',async({page})=>{
 await page.setViewportSize({width:1440,height:920});
 await setup(page);
 await expect(page.locator('#marketPickerButton')).toBeVisible();
 await expect(page.locator('.order-ticket')).toBeVisible();
 await expect(page.locator('.terminal-account')).toBeVisible();
 await expect(page.locator('[data-pc-metric="funding"]')).not.toHaveText('—');
 await expect(page.locator('[data-pc-metric="oi"]')).not.toHaveText('—');
 await expect(page.locator('[data-pc-metric="volume"]')).not.toHaveText('—');
 await expect(page.locator('[data-pc-metric="oracle"]')).not.toHaveText('—');
});

test('Pearl Cobalt remains usable across desktop and mobile widths',async({page})=>{
 await setup(page);
 for(const width of [390,768,1280,1600]){
  await page.setViewportSize({width,height:900});
  await page.waitForTimeout(120);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('#tradeSize')).toBeAttached();
  await expect(page.locator('#marketSymbol')).toBeAttached();
  await expect(page.locator('#pcThemeToggle')).toBeVisible();
 }
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('#pcSidebar')).toBeHidden();
 await expect(page.locator('#pcRightRail')).toBeHidden();
});
