const { test, expect } = require('@playwright/test');

// No real accounts, balances, exchange writes or external data are needed for these UI checks.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
  });
  await page.addInitScript(() => {
    window.uxWalletCalls = [];
    window.ethereum = { on() {}, removeListener() {}, async request(request) {
      window.uxWalletCalls.push(request.method);
      throw new Error('Wallet requests are disabled in the UX fixture');
    } };
  });
});

async function openWallet(page, hash = 'wallet') {
  await page.goto('/web/#' + hash);
  await expect(page.locator('html')).toHaveAttribute('data-wallet-ux', '1');
  await expect(page.locator('#wallet')).toBeVisible();
}
async function fixtureAssets(page, symbols) {
  await page.evaluate(values => {
    const rows = values.map((symbol, index) => {
      const row = document.createElement('button');
      row.className = 'w-token-row';
      row.dataset.token = index === 0 ? 'native' : '0x' + 'a'.repeat(40);
      const name = document.createElement('span');
      name.className = 'w-token-name'; name.textContent = symbol;
      row.append(name); return row;
    });
    document.getElementById('wAssets').replaceChildren(...rows);
  }, symbols);
}

test('wallet entries select Spot or Perps and browser back restores the wallet without signing', async ({ page }) => {
  await openWallet(page);
  const network = await page.locator('#marketNetwork').inputValue();
  await page.locator('#walletSpotEntry').click();
  await expect(page.locator('#markets')).toBeVisible();
  await expect(page.locator('#marketType')).toHaveValue('spot');
  await expect(page).toHaveURL(/#markets$/);
  await page.goBack();
  await expect(page.locator('#wallet')).toBeVisible();
  await page.locator('#walletPerpsEntry').click();
  await expect(page.locator('#marketType')).toHaveValue('perp');
  await expect(page.locator('#marketNetwork')).toHaveValue(network);
  expect(await page.evaluate(() => window.uxWalletCalls.some(method => /sign|send|approve/i.test(method)))).toBe(false);
});

test('asset filters survive refreshed rows without retaining previous account data', async ({ page }) => {
  await openWallet(page);
  await fixtureAssets(page, ['ETH', 'USDC']);
  await expect(page.locator('#walletFilterSummary')).toHaveText('2 of 2 loaded assets shown');
  await page.locator('#walletAssetFilter').fill(' ＵＳＤＣ ');
  await expect(page.locator('#walletFilterSummary')).toHaveText('1 of 2 loaded assets shown');
  await expect(page.locator('#wAssets [data-token="native"]')).toBeHidden();
  await fixtureAssets(page, ['ETH']);
  await expect(page.locator('#walletFilterEmpty')).toBeVisible();
  await expect(page.locator('#wAssets')).not.toContainText('USDC');
  await page.locator('#walletFilterClear').click();
  await expect(page.locator('#walletFilterSummary')).toHaveText('1 of 1 loaded assets shown');
  await fixtureAssets(page, []);
  await expect(page.locator('#walletFilterEmpty')).toBeHidden();
  await expect(page.locator('#walletFilterSummary')).toContainText('Connect or refresh');
});

test('unknown routes cannot activate dialogs and legacy asset links still work', async ({ page }) => {
  await openWallet(page, 'assets');
  await expect(page).toHaveURL(/#wallet$/);
  expect(await page.evaluate(() => window.openPage('wDialog'))).toBe(false);
  expect(await page.evaluate(() => window.openPage('__proto__'))).toBe(false);
  await expect(page.locator('#wallet')).toBeVisible();
  await page.evaluate(() => { location.hash = 'not-a-page'; });
  await expect(page.locator('#wallet')).toBeVisible();
  await expect(page.locator('#wDialog')).not.toBeVisible();
});

test('wallet entries and asset filter remain usable at narrow mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openWallet(page);
  await fixtureAssets(page, ['ETH', 'USDC']);
  await page.locator('#walletAssetFilter').fill('USDC');
  await expect(page.locator('#walletFilterSummary')).toHaveText('1 of 2 loaded assets shown');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/wallet-ux-mobile.png', fullPage: true });
});
