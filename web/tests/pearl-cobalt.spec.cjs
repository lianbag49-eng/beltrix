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
 await expect(page.locator('#marketPickerSymbol')).not.toHaveText('Select market');
 const symbol=(await page.locator('#marketPickerSymbol').innerText()).trim();
 await expect(page.locator('[data-pc-intel="market"]')).toContainText(symbol);
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
  await expect(page.locator('#pcWalletSurfaceNav')).toBeVisible();
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
 await page.locator('#pcWalletSurfaceNav [data-pc-wallet-route="defi"]').click();
 await expect(page.locator('body')).toHaveAttribute('data-page','defi');
 await page.locator('#pcWalletSurfaceNav [data-pc-wallet-route="markets"]').click();
 await expect(page.locator('body')).toHaveAttribute('data-page','markets');
 await expect(page.locator('.order-ticket')).toBeVisible();
});


test('Pearl Cobalt desktop Wallet uses the full workspace and no legacy mobile shell',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/web/#wallet');
 await expect(page.locator('body')).toHaveAttribute('data-page','wallet');
 await expect(page.locator('#pcWalletSurfaceNav')).toBeVisible();
 await expect(page.locator('.bottom-nav')).toBeHidden();
 const layout=await page.locator('#wallet').evaluate(el=>{
  const r=el.getBoundingClientRect();
  const style=getComputedStyle(el);
  const token=getComputedStyle(document.documentElement);
  return {
   width:r.width,left:r.left,right:innerWidth-r.right,color:style.color,
   text:token.getPropertyValue('--text').trim(),
   bg:token.getPropertyValue('--card').trim()
  };
 });
 expect(layout.width).toBeGreaterThan(900);
 expect(Math.abs(layout.left-layout.right)).toBeLessThan(80);
 expect(layout.color).not.toBe('rgb(248, 249, 250)');
 await expect(page.locator('.w-search-button')).toBeVisible();
 await expect(page.locator('.w-actions')).toBeVisible();
});

test('Pearl Cobalt wallet workspace navigation covers Explore DeFi Boost and Trade',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/web/#wallet');
 for(const [label,pageId] of [['Explore','explore'],['DeFi','defi'],['Boost','boost'],['Wallet','wallet']]){
  await page.locator('#pcWalletSurfaceNav').getByRole('button',{name:label,exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-page',pageId);
  await expect(page.locator('#'+pageId)).toHaveClass(/active/);
 }
 await page.locator('#pcWalletSurfaceNav').getByRole('button',{name:'Trade',exact:true}).click();
 await expect(page.locator('body')).toHaveAttribute('data-page','markets');
 await expect(page.locator('.order-ticket')).toBeVisible();
});

test('Wallet and USDT surfaces inherit Pearl Cobalt light and dark tokens',async({page})=>{
 await page.goto('/web/#wallet');
 const light=await page.locator('.w-action-circle').first().evaluate(el=>({
  color:getComputedStyle(el).color,
  background:getComputedStyle(el).backgroundColor
 }));
 expect(light.color).not.toBe('rgb(230, 190, 114)');
 await page.locator('#pcThemeToggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 const dark=await page.locator('.w-action-circle').first().evaluate(el=>({
  color:getComputedStyle(el).color,
  background:getComputedStyle(el).backgroundColor
 }));
 expect(dark.background).not.toBe(light.background);
});


test('USDT wallet opens inside the Pearl Cobalt theme system',async({page})=>{
 await page.goto('/web/#wallet');
 await expect(page.locator('#walletUsdtEntry')).toBeVisible();
 await page.locator('#walletUsdtEntry').click();
 await expect(page.locator('#usdtDialog')).toBeVisible();
 const light=await page.locator('#usdtDialog').evaluate(el=>({
  bg:getComputedStyle(el).backgroundColor,
  color:getComputedStyle(el).color,
  border:getComputedStyle(el).borderColor
 }));
 expect(light.bg).not.toBe('rgb(22, 21, 19)');
 await page.locator('#usdtClose').click();
 await page.locator('#pcThemeToggle').click();
 await page.locator('#walletUsdtEntry').click();
 await expect(page.locator('#usdtDialog')).toBeVisible();
 const dark=await page.locator('#usdtDialog').evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(dark).not.toBe(light.bg);
});


test('Pearl Cobalt desktop wallet surfaces use the full workspace and unified navigation',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/web/#wallet');
 await expect(page.locator('body')).toHaveAttribute('data-page','wallet');
 await expect(page.locator('#wallet')).toBeVisible();
 await expect(page.locator('.pc-wallet-surface-nav')).toBeVisible();
 await expect(page.locator('.pc-wallet-surface-nav button')).toHaveCount(5);
 await expect(page.locator('.bottom-nav')).toBeHidden();
 const width=await page.locator('#wallet').evaluate(el=>el.getBoundingClientRect().width);
 expect(width).toBeGreaterThan(900);
 const colors=await page.locator('#wallet').evaluate(el=>({
  wallet:getComputedStyle(el).color,
  body:getComputedStyle(document.body).color,
  background:getComputedStyle(document.documentElement).getPropertyValue('--card').trim()
 }));
 expect(colors.wallet).toBe(colors.body);
 expect(colors.background).toBeTruthy();

 await page.locator('.pc-wallet-surface-nav [data-pc-wallet-route="explore"]').click();
 await expect(page.locator('body')).toHaveAttribute('data-page','explore');
 await expect(page.locator('#explore')).toBeVisible();

 await page.locator('#pcWalletSurfaceNav [data-pc-wallet-route="defi"]').click();
 await expect(page.locator('body')).toHaveAttribute('data-page','defi');
 await expect(page.locator('#defi')).toBeVisible();

 await page.locator('#pcWalletSurfaceNav [data-pc-wallet-route="boost"]').click();
 await expect(page.locator('body')).toHaveAttribute('data-page','boost');
 await expect(page.locator('#boost')).toBeVisible();

 await page.locator('#pcWalletSurfaceNav [data-pc-wallet-route="markets"]').click();
 await expect(page.locator('body')).toHaveAttribute('data-page','markets');
 await expect(page.locator('.order-ticket')).toBeVisible();
});

test('Pearl Cobalt Wallet and USDT modal follow light and dark themes',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/web/#wallet');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect(page.locator('#walletUsdtEntry')).toBeVisible();
 await page.locator('#walletUsdtEntry').click();
 await expect(page.locator('#usdtDialog')).toBeVisible();
 const light=await page.locator('#usdtDialog').evaluate(el=>({
  bg:getComputedStyle(el).backgroundColor,
  color:getComputedStyle(el).color
 }));
 await page.locator('#usdtClose').click();

 await page.locator('#pcThemeToggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.locator('#walletUsdtEntry').click();
 await expect(page.locator('#usdtDialog')).toBeVisible();
 const dark=await page.locator('#usdtDialog').evaluate(el=>({
  bg:getComputedStyle(el).backgroundColor,
  color:getComputedStyle(el).color
 }));
 expect(dark.bg).not.toBe(light.bg);
 expect(dark.color).not.toBe(light.color);
});


test('Pearl Cobalt desktop Wallet workspace uses the full shell and desktop workspace nav',async({page})=>{
 await page.goto('/web/#wallet');
 await expect(page.locator('body')).toHaveAttribute('data-page','wallet');
 await expect(page.locator('#pcWalletSurfaceNav')).toBeVisible();
 await expect(page.locator('.bottom-nav')).toBeHidden();
 await expect(page.locator('#pcSidebar')).toBeHidden();
 await expect(page.locator('#pcRightRail')).toBeHidden();
 await expect(page.locator('#wallet')).toBeVisible();
 const box=await page.locator('#wallet').boundingBox();
 expect(box.width).toBeGreaterThan(800);
 const textColor=await page.locator('#wallet').evaluate(el=>getComputedStyle(el).color);
 const background=await page.locator('.w-section-card').first().evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(textColor).not.toBe('rgb(248, 249, 250)');
 expect(background).not.toBe('rgb(20, 22, 24)');
 await page.locator('#pcWalletSurfaceNav [data-pc-wallet-route="defi"]').click();
 await expect(page.locator('body')).toHaveAttribute('data-page','defi');
 await expect(page.locator('#defi')).toBeVisible();
 await page.locator('#pcWalletSurfaceNav [data-pc-wallet-route="markets"]').click();
 await expect(page.locator('body')).toHaveAttribute('data-page','markets');
 await expect(page.locator('.order-ticket')).toBeVisible();
});

test('Pearl Cobalt mobile Wallet keeps bottom navigation and avoids desktop workspace nav',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/web/#wallet');
 await expect(page.locator('#pcWalletSurfaceNav')).toBeHidden();
 await expect(page.locator('.bottom-nav')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.locator('.bottom-nav [data-page="defi"]').click();
 await expect(page.locator('body')).toHaveAttribute('data-page','defi');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
