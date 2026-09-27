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


test('Pearl Cobalt wallet surfaces use full desktop width and theme colors',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 await page.goto('/web/#wallet');
 await expect(page.locator('body')).toHaveAttribute('data-page','wallet');
 const walletBox=await page.locator('#wallet').boundingBox();
 expect(walletBox.width).toBeGreaterThan(900);
 expect(await page.evaluate(()=>getComputedStyle(document.querySelector('#wallet')).color===getComputedStyle(document.body).color)).toBe(true);
 await expect(page.locator('.bottom-nav')).toBeHidden();
 for(const route of ['explore','defi','boost']){
  await page.evaluate(id=>window.openPage(id),route);
  await expect(page.locator('body')).toHaveAttribute('data-page',route);
  const box=await page.locator('#'+route).boundingBox();
  expect(box.width).toBeGreaterThan(900);
  expect(await page.evaluate(id=>document.documentElement.scrollWidth<=window.innerWidth&&getComputedStyle(document.getElementById(id)).color===getComputedStyle(document.body).color,route)).toBe(true);
 }
});

test('Pearl Cobalt wallet remains readable in dark mode and USDT modal follows theme',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 await page.goto('/web/#wallet');
 await page.locator('#pcThemeToggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.evaluate(()=>getComputedStyle(document.querySelector('#wallet')).color===getComputedStyle(document.body).color)).toBe(true);
 await page.locator('#walletUsdtEntry').click();
 await expect(page.locator('#usdtDialog')).toBeVisible();
 expect(await page.evaluate(()=>{
  const modal=getComputedStyle(document.querySelector('#usdtDialog'));
  const card=getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
  const probe=document.createElement('div');probe.style.color=card;document.body.append(probe);
  const expected=getComputedStyle(probe).color;probe.remove();
  return modal.backgroundColor===expected;
 })).toBe(true);
});


test('Wallet, Explore, DeFi and Boost use the Pearl Cobalt desktop shell',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 for(const route of ['wallet','explore','defi','boost']){
  await page.goto('/web/#'+route);
  await expect(page.locator('body')).toHaveAttribute('data-page',route);
  await expect(page.locator('#'+route)).toHaveClass(/active/);
  await expect(page.locator('#'+route+' .pc-wallet-surface-nav')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toBeHidden();
  await expect(page.locator('#pcSidebar')).toBeHidden();
  await expect(page.locator('#pcRightRail')).toBeHidden();
  const width=await page.locator('#'+route).evaluate(el=>el.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(800);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('Wallet surfaces follow light and dark Pearl Cobalt theme tokens',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 await page.goto('/web/#wallet');
 const light=await page.locator('.w-search-button').evaluate(el=>({
  bg:getComputedStyle(el).backgroundColor,
  color:getComputedStyle(el).color
 }));
 await page.locator('#pcThemeToggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 const dark=await page.locator('.w-search-button').evaluate(el=>({
  bg:getComputedStyle(el).backgroundColor,
  color:getComputedStyle(el).color
 }));
 expect(dark.bg).not.toBe(light.bg);
 expect(dark.color).not.toBe(light.color);
});

test('Desktop Wallet workspace navigation reaches DeFi and returns to Trade',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 await page.goto('/web/#wallet');
 await page.locator('#wallet .pc-wallet-surface-nav [data-pc-wallet-route="defi"]').click();
 await expect(page.locator('body')).toHaveAttribute('data-page','defi');
 await page.locator('#defi .pc-wallet-surface-nav [data-pc-wallet-route="markets"]').click();
 await expect(page.locator('body')).toHaveAttribute('data-page','markets');
 await expect(page.locator('.order-ticket')).toBeVisible();
});
