const {test,expect}=require('@playwright/test');
const {privateKeyToAccount}=require('viem/accounts');
const {toFunctionSelector,encodeAbiParameters,decodeFunctionData,erc20Abi}=require('viem');
const {fixture,B,HASH}=require('./wallet-fixture.cjs');
// Deterministic TEST-ONLY signer; external RPC and exchange requests are intercepted.
const signer=privateKeyToAccount('0x'+'01'.repeat(32));
const routes={mainnet:{chain:'0xa4b1',token:'0xaf88d065e77c8cc2239327c5edb3a432268e5831',bridge:'0x2df1c51e09aecf9cacb7bc98cb1742757f163df7'},testnet:{chain:'0x66eee',token:'0x1baabb04529d43a73232b713c0fe471f7c7334d5',bridge:'0x08cfc1b6b2dcf36a1480b99353a354aa8ac56f89'}};
async function setup(page,kind='deposit',env='testnet'){
 await fixture(page,{A:signer.address});const posted=[],state={available:'100',ambiguous:false};
 await page.exposeFunction('fundingTestSignature',data=>signer.signTypedData({...data,domain:{...data.domain,chainId:Number(data.domain.chainId)}}));
 await page.route('**/info',async r=>{const q=r.request().postDataJSON();if(q.type==='clearinghouseState')return r.fulfill({json:{withdrawable:state.available,marginSummary:{accountValue:'100'},assetPositions:[]}});if(q.type==='userNonFundingLedgerUpdates')return r.fulfill({json:[]});return r.fallback();});
 await page.route('**/exchange',async r=>{posted.push(r.request().postDataJSON());return state.ambiguous?r.abort():r.fulfill({json:{status:'ok',response:{type:'default'}}});});
 await page.goto('/web/#markets');await expect(page.locator('html')).toHaveAttribute('data-funding-ux','v1');
 const route=routes[env];
 await page.evaluate(({route,pausedSelector,tokenSelector,encodedToken})=>{
  window.fundingSigned=[];window.fundingDrift=false;window.fundingPaused=false;
  const original=window.ethereum.request;
  window.ethereum.request=async req=>{
   if(req.method==='eth_call'&&req.params[0].to?.toLowerCase()===route.bridge){
    if(req.params[0].data.startsWith(pausedSelector))return '0x'+(window.fundingPaused?'1':'0').padStart(64,'0');
    if(req.params[0].data.startsWith(tokenSelector))return encodedToken;
   }
   if(req.method==='eth_signTypedData_v4'){
    const data=JSON.parse(req.params[1]);window.fundingSigned.push(data);const signature=await window.fundingTestSignature(data);
    if(window.fundingDrift){walletFixture.account='0x2222222222222222222222222222222222222222';for(const fn of [...walletFixture.handlers.accountsChanged||[]])fn([walletFixture.account]);}
    return signature;
   }
   return original(req);
  };
 },{route,pausedSelector:toFunctionSelector('paused()'),tokenSelector:toFunctionSelector('usdcToken()'),encodedToken:encodeAbiParameters([{type:'address'}],[route.token])});
 await page.locator(`#markets [data-funding=${kind==='deposit'?'deposit':'withdraw'}]`).click();await page.locator('#fundingTradingChoice').click();
 await page.locator('#fundingEnv').selectOption(env);
 await page.locator('#fundingSwitch').click();await expect(page.locator('#fundingFormStatus')).toContainText('Network switch');
 await page.locator('#fundingConnect').click();await expect(page.locator('#fundingReview')).toBeEnabled();
 return {posted,state,route};
}
async function review(page,kind='deposit'){
 await page.locator('#fundingAmount').fill(kind==='deposit'?'5':'10');if(kind==='withdraw')await page.locator('#fundingDestination').fill(B);
 await page.locator('#fundingReview').click();await expect(page.locator('#fundingAck')).toBeVisible();await expect(page.locator('#fundingSubmit')).toBeDisabled();
}

test('deposit requires review and acknowledgement then submits only an exact native-USDC transfer',async({page})=>{
 const {posted,route}=await setup(page);await review(page);expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);
 await page.locator('#fundingAck').check();await page.locator('#fundingSubmit').click();await expect(page.locator('#fundingTitle')).toHaveText('Funding request recorded');
 await expect(page.locator('#fundingBody h3')).toHaveText('Submitted');
 const sent=await page.evaluate(()=>walletFixture.sent);expect(sent).toHaveLength(1);expect(sent[0].to.toLowerCase()).toBe(route.token);expect(sent[0].chainId).toBe(route.chain);
 const decoded=decodeFunctionData({abi:erc20Abi,data:sent[0].data});expect(decoded.functionName).toBe('transfer');expect(decoded.args[0].toLowerCase()).toBe(route.bridge);expect(decoded.args[1]).toBe(5000000n);expect(posted).toEqual([]);
 await page.locator('#fundingShowHistory').click();await expect(page.locator('#fundingLocalHistory')).toContainText('Submitted');await expect(page.locator('#fundingLocalHistory')).not.toContainText('Credited');
});
for(const env of ['mainnet','testnet'])test(`withdrawal ${env} binds typed signature and records acceptance separately from delivery`,async({page})=>{
 const {posted,route}=await setup(page,'withdraw',env);await review(page,'withdraw');
 await expect(page.locator('#fundingBody')).toContainText('9 USDC');await page.locator('#fundingAck').check();
 await page.screenshot({path:`test-results/funding-${env}-review.png`,fullPage:true});
 await page.locator('#fundingSubmit').click();await expect(page.locator('#fundingBody h3')).toHaveText('Awaiting settlement');
 expect(posted).toHaveLength(1);expect(posted[0].action).toMatchObject({type:'withdraw3',hyperliquidChain:env==='mainnet'?'Mainnet':'Testnet',signatureChainId:route.chain,destination:B,amount:'10'});expect(posted[0].nonce).toBe(posted[0].action.time);
 expect(await page.evaluate(()=>walletFixture.sent.length)).toBe(0);expect(await page.evaluate(()=>fundingSigned.length)).toBe(1);
});
test('invalid minimum, unavailable balance and paused bridge fail before a wallet request',async({page})=>{
 await setup(page);await page.locator('#fundingAmount').fill('4.999999');await page.locator('#fundingReview').click();await expect(page.locator('#fundingFormStatus')).toContainText('Minimum');
 await page.locator('#fundingAmount').fill('5');await page.evaluate(()=>window.fundingPaused=true);await page.locator('#fundingReview').click();await expect(page.locator('#fundingFormStatus')).toContainText('paused');
 expect(await page.evaluate(()=>walletFixture.sent.length+fundingSigned.length)).toBe(0);
});
test('account change inside wallet signing withholds withdrawal submission',async({page})=>{
 const {posted}=await setup(page,'withdraw');await review(page,'withdraw');await page.evaluate(()=>window.fundingDrift=true);
 await page.locator('#fundingAck').check();await page.locator('#fundingSubmit').click();await expect(page.locator('#fundingFormStatus')).toContainText(/changed|closed/);
 expect(posted).toEqual([]);expect(await page.evaluate(()=>fundingSigned.length)).toBe(1);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('beltrix-funding-journal-v1')).records[0].status)).toBe('Not submitted');
});
test('ambiguous withdrawal is journaled and cannot be submitted again',async({page})=>{
 const {posted,state}=await setup(page,'withdraw');await review(page,'withdraw');state.ambiguous=true;
 await page.locator('#fundingAck').check();await page.locator('#fundingSubmit').click();await expect(page.locator('#fundingFormStatus')).toContainText('Do not repeat');
 expect(posted).toHaveLength(1);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('beltrix-funding-journal-v1')).records[0].status)).toBe('Unknown');
 await page.locator('#fundingBack').click();await page.locator('#fundingEnv').selectOption('testnet');await page.locator('#fundingConnect').click();await expect(page.locator('#fundingReview')).toBeEnabled();
 await page.locator('#fundingAmount').fill('10');await page.locator('#fundingReview').click();await expect(page.locator('#fundingFormStatus')).toContainText('unresolved');expect(posted).toHaveLength(1);
});
