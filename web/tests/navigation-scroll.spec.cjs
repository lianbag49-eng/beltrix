const {test,expect}=require('@playwright/test');

// No real wallets or exchange requests: these are full-page click/focus regressions.
test.beforeEach(async({page})=>{
  await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.setViewportSize({width:390,height:740});
  await page.goto('/web/#markets');
  await expect(page.locator('html')).toHaveAttribute('data-futures-ux','v2');
  await expect(page.locator('html')).toHaveAttribute('data-wallet-ux','1');
  // Leave room below controls so collapsing content cannot clamp scrollY.
  await page.addStyleTag({content:'.page{min-height:2400px}'});
  await page.evaluate(()=>{
    window.scrollProbe={routes:[],scrolls:[]};
    const open=window.openPage,scroll=window.scrollTo.bind(window);
    window.openPage=(...args)=>{window.scrollProbe.routes.push(args[0]);return open(...args);};
    window.scrollTo=(...args)=>{window.scrollProbe.scrolls.push(args);return scroll(...args);};
  });
});
async function resetProbe(page){await page.evaluate(()=>{window.scrollProbe.routes=[];window.scrollProbe.scrolls=[];});}
async function expectNoNavigation(page){
  expect(await page.evaluate(()=>window.scrollProbe)).toEqual({routes:[],scrolls:[]});
}
async function scrolledClick(page,selector,{stable=true}={}){
  const el=page.locator(selector);
  await expect(el).toBeVisible();
  await el.evaluate(e=>window.scrollTo({top:Math.max(40,e.getBoundingClientRect().top+scrollY-200),behavior:'instant'}));
  await page.waitForTimeout(80);
  const before=await page.evaluate(()=>scrollY);
  expect(before).toBeGreaterThan(0);
  await resetProbe(page);
  await el.click();
  await page.waitForTimeout(80);
  await expectNoNavigation(page);
  if(stable)expect(Math.abs(await page.evaluate(()=>scrollY)-before)).toBeLessThanOrEqual(2);
  return before;
}

test('quantity click and keyboard entry keep scroll and input focus on mobile and desktop',async({page})=>{
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:740});
    await scrolledClick(page,'#tradeSize');
    await expect(page.locator('#tradeSize')).toBeFocused();
    await page.keyboard.type('0.75');
    await expect(page.locator('#tradeSize')).toHaveValue('0.75');
    await expect(page.locator('#tradeSize')).toBeFocused();
    await page.locator('#tradeSize').fill('');
    await expectNoNavigation(page);
  }
});

test('quick order buttons and account tabs do not invoke the page router',async({page})=>{
  for(const selector of ['[data-fast-side=sell]','[data-fast-type=Market]','[data-fast-type=Gtc]','[data-intent=close]','[data-intent=open]','[data-account-tab=orders]','[data-account-tab=positions]']){
    await scrolledClick(page,selector,{stable:false});
    await expect(page.locator('body')).toHaveAttribute('data-page','markets');
  }
  await expect(page.locator('#tradeSide')).toHaveValue('sell');
  await expect(page.locator('#tradeReduce')).not.toBeChecked();
  await expect(page.locator('#tradeType')).toHaveValue('Gtc');
});

test('chart, margin and account drawers expand and collapse without jumping to top',async({page})=>{
  for(const id of ['futuresChart','futuresLeverageDrawer','futuresExtra']){
    await scrolledClick(page,`#${id} > summary`);
    await expect(page.locator('#'+id)).toHaveAttribute('open','');
    await scrolledClick(page,`#${id} > summary`);
    expect(await page.locator('#'+id).evaluate(e=>e.open)).toBe(false);
  }
});

test('wallet categories, search and clear stay on the wallet without synthetic navigation',async({page})=>{
  await page.locator('.bottom-nav [data-page=wallet]').click();
  await scrolledClick(page,'#walletAssetFilter');
  await expect(page.locator('#walletAssetFilter')).toBeFocused();
  await page.keyboard.type('USDC');
  await scrolledClick(page,'#walletFilterClear');
  await expect(page.locator('#walletAssetFilter')).toHaveValue('');
  await expect(page.locator('#walletAssetFilter')).toBeFocused();
  await scrolledClick(page,'[data-tab=approvals]',{stable:false});
  await expect(page.locator('#wPanel-approvals')).toBeVisible();
  await scrolledClick(page,'[data-tab=crypto]',{stable:false});
  await expect(page.locator('#wPanel-crypto')).toBeVisible();
});

test('opening and closing a wallet dialog keeps its opener and viewport',async({page})=>{
  await page.locator('.bottom-nav [data-page=wallet]').click();
  const before=await scrolledClick(page,'.w-actions [data-action=more]');
  await expect(page.locator('#wDialog')).toBeVisible();
  await resetProbe(page);
  await page.locator('#wClose').click();
  await expect(page.locator('#wDialog')).not.toBeVisible();
  await expectNoNavigation(page);
  expect(Math.abs(await page.evaluate(()=>scrollY)-before)).toBeLessThanOrEqual(2);
});

test('current-page taps are inert but real navigation through nested SVG still works',async({page})=>{
  await page.evaluate(()=>window.scrollTo({top:350,behavior:'instant'}));
  await resetProbe(page);
  await page.locator('.bottom-nav [data-page=markets] svg').click();
  await expectNoNavigation(page);
  expect(await page.evaluate(()=>scrollY)).toBe(350);
  await page.locator('.bottom-nav [data-page=wallet] svg').click();
  await expect(page.locator('body')).toHaveAttribute('data-page','wallet');
  await expect(page).toHaveURL(/#wallet$/);
  expect(await page.evaluate(()=>scrollY)).toBe(0);
  expect(await page.evaluate(()=>window.scrollProbe.routes)).toEqual(['wallet']);
  expect(await page.locator('body').getAttribute('aria-current')).toBeNull();
  await page.goBack();
  await expect(page.locator('body')).toHaveAttribute('data-page','markets');
});

test('same-page API and keyboard account tabs do not steal focus or reset scroll',async({page})=>{
  await scrolledClick(page,'#tradeSize');
  const before=await page.evaluate(()=>scrollY);
  await page.evaluate(()=>window.openPage('markets'));
  await expect(page.locator('#tradeSize')).toBeFocused();
  expect(await page.evaluate(()=>scrollY)).toBe(before);
  expect(await page.evaluate(()=>window.openPage('tradeDialog'))).toBe(false);
  const tab=page.locator('[data-account-tab=orders]');
  await tab.evaluate(e=>{window.scrollTo({top:e.getBoundingClientRect().top+scrollY-200,behavior:'instant'});e.focus({preventScroll:true});});
  const tabY=await page.evaluate(()=>scrollY);
  await resetProbe(page);
  await tab.press('Enter');
  await expect(tab).toHaveAttribute('aria-selected','true');
  await expect(tab).toBeFocused();
  await expectNoNavigation(page);
  expect(Math.abs(await page.evaluate(()=>scrollY)-tabY)).toBeLessThanOrEqual(2);
});
