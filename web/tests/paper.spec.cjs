const {test,expect}=require('@playwright/test');
test('fund practice accounts and complete futures without any wallet signature',async({page})=>{
 await page.route('**/api.hyperliquid-testnet.xyz/info',async route=>{const req=route.request().postDataJSON();if(req.type==='l2Book')return route.fulfill({json:{coin:req.coin,time:Date.now(),levels:[[{px:'50000',sz:'10'}],[{px:'50010',sz:'10'}]]}});return route.fulfill({json:[]})});
 await page.addInitScript(()=>{window.walletCalls=[];window.ethereum={on(){},request(x){window.walletCalls.push(x.method);throw Error('Wallet must not be used')}}});
 await page.goto('/web/#markets');await page.getByRole('button',{name:'Practice',exact:true}).click();
 await expect(page.locator('#paperCash')).toContainText('100,000.00');
 page.on('dialog',d=>d.accept());await page.locator('#paperTopup').click();
 await page.locator('#from').selectOption('USDC');await expect(page.locator('#balance')).toContainText('200000');
 await expect(page.locator('#paperOpen')).toBeEnabled();await page.locator('#paperOpen').click();await page.locator('#paperConfirm').click();
 await expect(page.locator('#paperPosition')).toContainText('BTC LONG');
 await page.locator('#paperClose').click();await page.locator('#paperConfirm').click();await expect(page.locator('#paperHistory')).toContainText('Net PnL');
 await page.reload();await page.getByRole('button',{name:'Practice',exact:true}).click();await expect(page.locator('#paperHistory')).toContainText('Net PnL');
 expect(await page.evaluate(()=>window.walletCalls.some(x=>/sign|send/i.test(x)))).toBe(false);
});
test('missing book cannot open a practice position',async({page})=>{
 await page.route('**/api.hyperliquid-testnet.xyz/info',route=>route.fulfill({json:{coin:'BTC',time:Date.now(),levels:[[],[]]}}));
 await page.goto('/web/#markets');await page.getByRole('button',{name:'Practice',exact:true}).click();
 await expect(page.locator('#paperMessage')).toContainText('unavailable');await expect(page.locator('#paperOpen')).toBeDisabled();
});
