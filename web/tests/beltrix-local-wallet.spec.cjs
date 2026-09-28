const {test,expect}=require('@playwright/test');

test('BELTRIX local wallet creates locks unlocks and registers as trading provider',async({page})=>{
 await page.goto('/web/#wallet');
 await expect(page.locator('#wBeltrixVault')).toBeVisible();
 await page.locator('#wBeltrixVault').click();
 await page.locator('#wLocalCreate').click();
 await page.locator('#wLocalName').fill('Primary BELTRIX');
 await page.locator('#wLocalPassword').fill('beltrix-wallet-pass-2026');
 await page.locator('#wLocalPassword2').fill('beltrix-wallet-pass-2026');
 await page.locator('#wLocalCreateConfirm').click();

 const recovery=await page.locator('#wLocalRecovery').inputValue();
 expect(recovery).toMatch(/^0x[0-9a-f]{64}$/);
 await expect(page.locator('#wAccountMode')).toContainText('BELTRIX Wallet');
 await expect(page.locator('#walletProvider')).toContainText('BELTRIX Wallet');

 const storageLeak=await page.evaluate(key=>Object.entries(localStorage).some(([,v])=>String(v).includes(key)),recovery);
 expect(storageLeak).toBe(false);

 await page.locator('#wLocalRecoverySaved').check();
 await page.locator('#wLocalRecoveryDone').click();
 await page.locator('#wLocalLock').click();
 await expect(page.locator('#wAccountMode')).toContainText('Connect a wallet');

 await page.locator('[data-unlock]').first().click();
 await page.locator('#wLocalUnlockPassword').fill('beltrix-wallet-pass-2026');
 await page.locator('#wLocalUnlockConfirm').click();
 await expect(page.locator('#wAccountMode')).toContainText('BELTRIX Wallet');

 await page.locator('#wLocalWalletClose').click();
 await page.reload();
 await page.goto('/web/#wallet');
 await expect(page.locator('#wAccountMode')).toContainText('Connect a wallet');
 expect(await page.evaluate(()=>window.beltrixWallet?.provider||null)).toBeNull();
});

test('BELTRIX local wallet rejects wrong password after reload',async({page})=>{
 await page.goto('/web/#wallet');
 await page.locator('#wBeltrixVault').click();
 await page.locator('#wLocalCreate').click();
 await page.locator('#wLocalPassword').fill('another-wallet-pass-2026');
 await page.locator('#wLocalPassword2').fill('another-wallet-pass-2026');
 await page.locator('#wLocalCreateConfirm').click();
 await page.locator('#wLocalRecoverySaved').check();
 await page.locator('#wLocalRecoveryDone').click();
 await page.locator('#wLocalLock').click();
 await page.locator('[data-unlock]').first().click();
 await page.locator('#wLocalUnlockPassword').fill('definitely-wrong-password');
 await page.locator('#wLocalUnlockConfirm').click();
 await expect(page.locator('#wLocalWalletStatus')).toContainText(/incorrect|damaged/i);
 await expect(page.locator('#wAccountMode')).toContainText('Connect a wallet');
});
