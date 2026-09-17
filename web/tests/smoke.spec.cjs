const {test,expect}=require('@playwright/test');
test('simulation validation, confirm, persistence and settings',async({page})=>{
 await page.goto('/web/#markets');
 await page.locator('#cleanMore').click();await page.locator('[data-clean-route=swap]').click();
 await page.locator('#pay').fill('999');
 await page.locator('#swapBtn').click();
 await expect(page.locator('#toast')).toContainText('Insufficient');
 await page.locator('#pay').fill('1');
 await page.locator('#to').selectOption('ETH');
 await page.locator('#swapBtn').click();
 await expect(page.locator('#toast')).toContainText('different tokens');
 await page.locator('#to').selectOption('USDC');
 await page.locator('#swapBtn').click();
 await expect(page.locator('#result')).toBeVisible();
 await page.locator('#confirmBtn').click();
 await expect(page.locator('#dialogTitle')).toHaveText('SIMULATION COMPLETE');
 await page.locator('#closeBtn').click();
 await page.reload();
 await page.locator('#cleanMore').click();await page.locator('[data-clean-route=swap]').click();
 await expect(page.locator('#activity')).toContainText('SIMULATED');
 await page.locator('#cleanMore').click();await page.locator('[data-clean-route=settings]').click();
 await page.locator('#slippage').fill('1.2');
 await page.locator('#slippage').blur();
 await page.reload();
 await page.locator('#cleanMore').click();await page.locator('[data-clean-route=settings]').click();
 await expect(page.locator('#slippage')).toHaveValue('1.2');
});
test('reject wrong chain and never send or sign',async({page})=>{
 await page.addInitScript(()=>{
 window.calls=[];
 window.ethereum={on(){},async request(x){window.calls.push(x.method);
 if(x.method==='eth_requestAccounts')return ['0x1111111111111111111111111111111111111111'];
 if(x.method==='wallet_switchEthereumChain')throw {code:4001};
 if(x.method==='eth_chainId')return '0x1';throw Error('Unexpected RPC');
 }};
 });
 await page.goto('/web/#markets');
 await page.locator('#tradeConnect').click();
 await expect(page.locator('#tradeConnect')).toHaveText('Connect wallet');
 const calls=await page.evaluate(()=>window.calls);
 expect(calls).not.toContain('eth_getBalance');
 expect(calls.some(x=>/send|sign|approve/i.test(x))).toBe(false);
});
test('mobile layout and navigation',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/web/#markets');
 for(const name of ['Trade','Practice','Settings']){
 if(name==='Trade')await page.locator('.bottom-nav [data-page=markets]').click();else{await page.locator('#cleanMore').click();await page.locator('[data-clean-route='+ (name==='Practice'?'swap':'settings') +']').click();}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect(await page.locator('body').innerText()).not.toMatch(/[가-힣]/);
 }
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
