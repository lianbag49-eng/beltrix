const {test,expect}=require('@playwright/test');
const {fixture,connect,A,B,T}=require('./wallet-fixture.cjs');

test('personal deposit QR encodes address or an exact network/token payment request without a transfer',async({page})=>{
 await fixture(page);await connect(page);
 await page.locator('#wallet [data-funding=deposit]').click();
 await page.locator('#fundingWalletChoice').click();
 await expect(page.locator('#fundingQrText')).toHaveValue(A);
 await expect(page.locator('#fundingReceiveAssetInfo')).toContainText('does NOT encode');
 await page.locator('#fundingReceiveNetwork').selectOption('42161');
 await page.locator('#fundingReceiveAsset').selectOption('usdc');
 await page.locator('#fundingReceiveFormat').selectOption('payment');
 await page.locator('#fundingReceiveAmount').fill('1.234567');
 await expect(page.locator('#fundingQrText')).toHaveValue(new RegExp(`^ethereum:0xaf88d065e77c8cC2239327C5EDb3A432268e5831@42161/transfer\\?address=${A}&uint256=1234567$`,'i'));
 expect(await page.locator('#fundingReceiveQR').evaluate(x=>x.width)).toBeGreaterThan(200);
 const download=page.waitForEvent('download');await page.locator('#fundingSaveQR').click();
 expect((await download).suggestedFilename()).toBe('BELTRIX-wallet-deposit-42161.png');
 await page.locator('#fundingReceiveFormat').selectOption('address');
 await expect(page.locator('#fundingQrText')).toHaveValue(A);
 await expect(page.locator('#fundingReceiveAmount')).toBeDisabled();
 expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);
 await page.screenshot({path:'test-results/funding-wallet-qr.png',fullPage:true});
});

test('payment import only fills the existing send form and keeps its mandatory review',async({page})=>{
 await fixture(page);await connect(page);
 await page.locator('#wallet [data-funding=withdraw]').click();await page.locator('#fundingWalletChoice').click();
 await page.locator('#fundingPaymentImport summary').click();
 await page.locator('#fundingPaymentText').fill(`ethereum:${B}@1?value=150000000000000000`);
 await page.locator('#fundingApplyPayment').click();
 await expect(page.locator('#wSendTo')).toHaveValue(B);await expect(page.locator('#wSendAmount')).toHaveValue('0.15');
 expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);
 await page.locator('#wSendReview').click();await expect(page.locator('#wReviewAck')).toBeVisible();await expect(page.locator('#wSignTransfer')).toBeDisabled();
 expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);
});

test('foreign-network, foreign-token and executable QR requests cannot mutate the recipient or amount',async({page})=>{
 await fixture(page);await connect(page);await page.locator('.w-actions [data-action=send]').click();
 await page.locator('#wSendTo').fill(B);await page.locator('#wSendAmount').fill('0.1');await page.locator('#fundingPaymentImport summary').click();
 for(const text of [`ethereum:${A}@42161?value=100`,`ethereum:${A}@1/approve?address=${B}&uint256=1`,`ethereum:${A}@1?value=1&value=2`]){
  await page.locator('#fundingPaymentText').fill(text);await page.locator('#fundingApplyPayment').click();
  await expect(page.locator('#fundingImportStatus')).toContainText(/differs|allowed|duplicate/);
  await expect(page.locator('#wSendTo')).toHaveValue(B);await expect(page.locator('#wSendAmount')).toHaveValue('0.1');
 }
 await page.locator('#wSendAsset').selectOption(T);
 await page.locator('#fundingPaymentText').fill(`ethereum:${T}@1/transfer?address=${B}&uint256=1234567`);await page.locator('#fundingApplyPayment').click();
 await expect(page.locator('#wSendAmount')).toHaveValue('1.234567');
 expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);
});

test('changing an account removes the old deposit QR and narrow dialog fits without overflow',async({page})=>{
 await fixture(page);await connect(page);await page.setViewportSize({width:390,height:844});
 await page.locator('#wallet [data-funding=deposit]').click();await page.locator('#fundingWalletChoice').click();await expect(page.locator('#fundingQrText')).toHaveValue(A);
 const box=await page.locator('#fundingDialog').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);
 await page.evaluate(b=>{walletFixture.account=b;for(const fn of [...walletFixture.handlers.accountsChanged||[]])fn([b]);},B);
 await expect(page.locator('#fundingDialog')).not.toBeVisible();expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);
});
