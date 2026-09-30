const {test,expect}=require('@playwright/test');

async function createMnemonicFirst(page,{name='BELTRIX Wallet',password}={}){
 await page.locator('#wLocalCreate').click();
 if(name)await page.locator('#wLocalName').fill(name);
 await page.locator('#wLocalCreateConfirm').click();
 const recovery=await page.locator('#wLocalRecovery').inputValue();
 expect(recovery.trim().split(/\s+/)).toHaveLength(12);
 // Draft recovery material must not be persisted before explicit backup.
 expect(await page.evaluate(secret=>Object.entries(localStorage).some(([,v])=>String(v).includes(secret)),recovery)).toBe(false);
 expect(await page.evaluate(()=>new Promise(resolve=>{const q=indexedDB.open('beltrix-wallet-v1');q.onsuccess=()=>{const db=q.result;if(!db.objectStoreNames.contains('vaults'))return resolve(0);const tx=db.transaction('vaults','readonly');const r=tx.objectStore('vaults').count();r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(-1)};q.onerror=()=>resolve(0)}))).toBe(0);
 await page.locator('#wLocalRecoverySaved').check();
 await page.locator('#wLocalRecoveryNext').click();
 await page.locator('#wLocalPassword').fill(password);
 await page.locator('#wLocalPassword2').fill(password);
 await page.locator('#wLocalFinishCreate').click();
 await expect(page.locator('#wAccountMode')).toContainText('BELTRIX Wallet');
 return recovery;
}

test('BELTRIX local wallet creates mnemonic first then locks unlocks and registers as trading provider',async({page})=>{
 await page.goto('/web/#wallet');
 await expect(page.locator('#wBeltrixVault')).toBeVisible();
 await page.locator('#wBeltrixVault').click();
 const recovery=await createMnemonicFirst(page,{name:'Primary BELTRIX',password:'beltrix-wallet-pass-2026'});

 await expect(page.locator('#walletProvider')).toContainText('BELTRIX Wallet');
 await expect(page.locator('#wBeltrixMultichain')).toBeVisible();
 await expect(page.locator('#wBeltrixMultichain')).toContainText('EVM');
 await expect(page.locator('#wBeltrixMultichain')).toContainText('Solana');
 const chainState=await page.evaluate(()=>({
  evm:window.beltrixWallet?.provider?.address||null,
  sol:window.beltrixWallet?.solanaProvider?.publicKey?.toString()||null
 }));
 expect(chainState.evm).toMatch(/^0x[0-9a-f]{40}$/i);
 expect(chainState.sol).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
 expect(await page.evaluate(secret=>Object.entries(localStorage).some(([,v])=>String(v).includes(secret)),recovery)).toBe(false);

 await page.locator('#wLocalLock').click();
 await expect(page.locator('#wAccountMode')).toContainText('Connect a wallet');
 await expect(page.locator('#wBeltrixMultichain')).toBeHidden();
 expect(await page.evaluate(()=>window.beltrixWallet?.solanaProvider||null)).toBeNull();

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

test('BELTRIX mnemonic-first wallet rejects wrong local password after reload',async({page})=>{
 await page.goto('/web/#wallet');
 await page.locator('#wBeltrixVault').click();
 await createMnemonicFirst(page,{password:'another-wallet-pass-2026'});
 await page.locator('#wLocalLock').click();
 await page.locator('[data-unlock]').first().click();
 await page.locator('#wLocalUnlockPassword').fill('definitely-wrong-password');
 await page.locator('#wLocalUnlockConfirm').click();
 await expect(page.locator('#wLocalWalletStatus')).toContainText(/incorrect|damaged/i);
 await expect(page.locator('#wAccountMode')).toContainText('Connect a wallet');
});
