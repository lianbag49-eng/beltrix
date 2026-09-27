const {test,expect}=require('@playwright/test');

test('Pearl Cobalt defaults to light, toggles dark, and persists',async({page})=>{
 await page.goto('/web/#markets');
 await expect(page.locator('html')).toHaveAttribute('data-beltrix-ui','pearl-cobalt');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect(page.locator('#pcThemeToggle')).toBeVisible();
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
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.locator('#pcThemeToggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});

test('Pearl Cobalt keeps trading controls available and market intelligence synchronized',async({page})=>{
 await page.goto('/web/#markets');
 await expect(page.locator('#marketPickerButton')).toBeVisible();
 await expect(page.locator('.order-ticket')).toBeVisible();
 await expect(page.locator('.terminal-account')).toBeVisible();
 await expect(page.locator('[data-pc-intel="market"]')).not.toHaveText('—');
 const symbol=await page.locator('#marketPickerSymbol').innerText();
 await expect(page.locator('[data-pc-intel="market"]')).toContainText(symbol.trim());
});

test('Pearl Cobalt mobile hides desktop rails and avoids horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/web/#markets');
 await expect(page.locator('#pcThemeToggle')).toBeVisible();
 await expect(page.locator('#pcSidebar')).toBeHidden();
 await expect(page.locator('#pcRightRail')).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.locator('#pcThemeToggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});


test('root route opens the Pearl Cobalt trading dashboard, not Wallet',async({page})=>{
 await page.goto('/web/');
 await expect(page.locator('body')).toHaveAttribute('data-page','markets');
 await expect(page.locator('#markets')).toHaveClass(/active/);
 await expect(page.locator('#wallet')).not.toHaveClass(/active/);
 const mobile=(page.viewportSize()?.width||1280)<=900;
 if(mobile){
  await expect(page.locator('#pcSidebar')).toBeHidden();
  await expect(page.locator('.bottom-nav')).toBeVisible();
 }else{
  await expect(page.locator('#pcSidebar')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toBeHidden();
 }
 await expect(page.locator('.order-ticket')).toBeVisible();
});

test('Wallet remains available only when explicitly requested',async({page})=>{
 await page.goto('/web/#wallet');
 await expect(page.locator('body')).toHaveAttribute('data-page','wallet');
 await expect(page.locator('#wallet')).toHaveClass(/active/);
 await expect(page.locator('#markets')).not.toHaveClass(/active/);
});
