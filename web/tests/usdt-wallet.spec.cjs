const {test,expect}=require('@playwright/test');
const {Transaction}=require('@solana/web3.js');
const {TronWeb}=require('tronweb');
let fixtures;
test.beforeAll(async()=>{fixtures=await import('./usdt-fixtures.mjs');});
async function boot(page,kind='none'){
 const f=fixtures,state={writes:[],hash:null};
 if(kind==='tron')await page.exposeFunction('__usdtSignTron',async tx=>{const web=new TronWeb({fullHost:'https://api.trongrid.io'});web.setPrivateKey(f.TRON_KEY);return web.trx.sign(tx);});
 if(kind==='solana')await page.exposeFunction('__usdtSignSol',async encoded=>{const tx=Transaction.from(Buffer.from(encoded,'base64'));tx.partialSign(f.SOL_KEY);return Array.from(tx.signature);});
 await page.addInitScript(({kind,evm,tron,sol,hash})=>{
  window.__usdtWrites=[];const listeners={};
  const p={on:(e,cb)=>(listeners[e]||=[]).push(cb),removeListener:()=>{},request:async({method,params})=>{if(method==='eth_accounts'||method==='eth_requestAccounts')return[evm];if(method==='eth_chainId')return'0x1';if(method==='eth_sendTransaction'){window.__usdtWrites.push(params[0]);return hash;}throw Error('Unexpected wallet method '+method);}};
  if(kind==='evm')window.ethereum=p;
  if(kind==='tron')window.tron={request:async()=>[tron],on:()=>{},removeListener:()=>{},tronWeb:{defaultAddress:{base58:tron},trx:{getBlock:async()=>({blockID:'0'.repeat(64)}),sign:async tx=>window.__usdtSignTron(tx)}}};
  if(kind==='solana'){const pk={toString:()=>sol};window.solana={publicKey:pk,connect:async()=>({publicKey:pk}),on:()=>{},removeListener:()=>{},signTransaction:async tx=>{const sig=await window.__usdtSignSol(tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64'));tx.addSignature(tx.feePayer,Uint8Array.from(sig));return tx;}};}
 },{kind,evm:f.EVM_FROM,tron:f.TRON_FROM,sol:f.SOL_KEY.publicKey.toBase58(),hash:f.EVM_HASH});
 const hex=n=>'0x'+BigInt(n).toString(16),word=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(['localhost','127.0.0.1'].includes(u.hostname))return route.continue();
  let p;try{p=req.postDataJSON();}catch{}
  const fulfill=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  if(kind==='evm'&&u.hostname==='eth.drpc.org'){
   const result=async a=>{const m=a.method;let r;if(m==='eth_chainId')r='0x1';else if(m==='eth_call')r=a.params[0].data.startsWith('0x313ce567')?word(6):a.params[0].data.startsWith('0x70a08231')?word(100000000):'0x';else if(m==='eth_getBalance')r=hex(10n**19n);else if(m==='eth_getCode')r='0x';else if(m==='eth_estimateGas')r=hex(60000);else if(m==='eth_gasPrice')r=hex(1000000000);else if(m==='eth_getTransactionCount')r='0x7';else if(m==='eth_blockNumber')r='0x64';else if(m==='eth_getLogs')r=[];else throw Error('Unexpected mock RPC '+m);return{jsonrpc:'2.0',id:a.id,result:r};};
   return fulfill(Array.isArray(p)?await Promise.all(p.map(result)):await result(p));
  }
  if(kind==='tron'&&u.hostname==='api.trongrid.io'){
   if(u.pathname.endsWith('getblockbynum'))return fulfill({blockID:'0'.repeat(64)});
   if(u.pathname.endsWith('triggerconstantcontract'))return fulfill({result:{result:true},constant_result:[(p.function_selector==='decimals()'?6n:p.function_selector.startsWith('balance')?100000000n:1n).toString(16).padStart(64,'0')],energy_used:100000});
   if(u.pathname.endsWith('getaccount'))return fulfill({balance:1000000000,address:TronWeb.address.toHex(f.TRON_FROM)});
   if(u.pathname.endsWith('getchainparameters'))return fulfill({chainParameter:[{key:'getEnergyFee',value:100},{key:'getTransactionFee',value:1000}]});
   if(u.pathname.endsWith('triggersmartcontract')){const to=TronWeb.address.fromHex('41'+p.parameter.slice(24,64)),raw=BigInt('0x'+p.parameter.slice(64));return fulfill({result:{result:true},transaction:f.tronTx(to,raw,p.fee_limit)});}
   if(u.pathname.endsWith('broadcasttransaction')){state.writes.push(p);state.hash=p.txID;return fulfill({result:true,txid:p.txID});}
   return fulfill({});
  }
  if(kind==='solana'&&u.hostname==='api.mainnet-beta.solana.com'){
   const sf=f.solanaFixture(),obj=a=>a?{data:[a.data.toString('base64'),'base64'],owner:a.owner.toBase58(),lamports:a.lamports,executable:false,rentEpoch:0}:null;
   const one=async a=>{let result;switch(a.method){
    case'getGenesisHash':result=await sf.client.getGenesisHash();break;
    case'getAccountInfo':result={context:{slot:10},value:obj(await sf.client.getAccountInfo(new (require('@solana/web3.js').PublicKey)(a.params[0])))};break;
    case'getTokenAccountsByOwner':result={context:{slot:10},value:[{pubkey:sf.source.toBase58(),account:obj(f.tokenInfo(sf.owner))}]};break;
    case'getBalance':result={context:{slot:10},value:1000000000};break;
    case'getLatestBlockhash':result={context:{slot:10},value:await sf.client.getLatestBlockhash()};break;
    case'getMinimumBalanceForRentExemption':result=2039280;break;
    case'getFeeForMessage':result={context:{slot:10},value:6000};break;
    case'simulateTransaction':result={context:{slot:10},value:{err:null,logs:[],accounts:null,unitsConsumed:30000}};break;
    case'getBlockHeight':result=10;break;
    case'sendTransaction':state.writes.push(a.params[0]);result=(await import('bs58')).default.encode(Transaction.from(Buffer.from(a.params[0],'base64')).signature);state.hash=result;break;
    default:throw Error('Unexpected Solana test RPC '+a.method);
   }return{jsonrpc:'2.0',id:a.id,result};};return fulfill(Array.isArray(p)?await Promise.all(p.map(one)):await one(p));
  }
  return route.abort();
 });
 await page.goto('/web/#wallet');await page.locator('#walletUsdtEntry').click();await expect(page.locator('#usdtDialog')).toBeVisible();return state;
}

test('lazy USDT entry lists all eight networks and no connected wallet cannot send',async({page})=>{
 await boot(page);await expect(page.locator('#usdtNetwork option')).toHaveCount(8);await page.locator('[data-usdt-tab=send]').click();await expect(page.locator('#usdtReview')).toBeDisabled();expect(await page.evaluate(()=>window.__usdtWrites)).toHaveLength(0);await page.locator('#usdtClose').click();await expect(page.locator('#walletUsdtEntry')).toBeFocused();
});
test('all network receive QRs use their own address without key generation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await boot(page);
 const routes=['ethereum','bnb','arbitrum','optimism','polygon','avalanche','tron','solana'];
 for(const id of routes){await page.locator('#usdtNetwork').selectOption(id);const address=id==='tron'?fixtures.TRON_FROM:id==='solana'?fixtures.SOL_KEY.publicKey.toBase58():fixtures.EVM_FROM;await page.locator('.usdt-watch summary').click();await page.locator('#usdtWatchAddress').fill(address);await page.locator('#usdtWatch').click();await expect(page.locator('#usdtQrAddress')).toHaveText(address);await expect(page.locator('#usdtQR')).toBeVisible();expect(await page.locator('#usdtQR').evaluate(c=>c.width)).toBeGreaterThan(100);await page.locator('.usdt-session-details > summary').click();await page.locator('#usdtDisconnect').click();}
 expect(await page.evaluate(()=>window.__usdtWrites)).toHaveLength(0);
});
test('QR export and payment import preserve exact network and amount',async({page})=>{
 await boot(page,'evm');await page.locator('#usdtConnect').click();await expect(page.locator('#usdtBalance')).toContainText('100 USDT');await page.locator('#usdtQrMode').selectOption('payment');await page.locator('#usdtQrAmount').fill('1.234567');const download=page.waitForEvent('download');await page.locator('#usdtSaveQR').click();expect((await download).suggestedFilename()).toContain('ethereum-USDT');await page.locator('[data-usdt-tab=send]').click();await page.locator('#usdtPanel details summary').click();await page.locator('#usdtPayment').fill('ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7@1/transfer?address='+fixtures.EVM_TO+'&uint256=1234567');await page.locator('#usdtImportText').click();await expect(page.locator('#usdtAmount')).toHaveValue('1.234567');await expect(page.locator('#usdtRecipient')).toHaveValue(fixtures.EVM_TO);expect(await page.evaluate(()=>window.__usdtWrites)).toHaveLength(0);await page.locator('#usdtPayment').fill('ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7@56/transfer?address='+fixtures.EVM_TO);await page.locator('#usdtImportText').click();await expect(page.locator('#usdtStatus')).toContainText('does not match');
});
for(const kind of ['evm','tron','solana'])test(kind+' real form to reviewed external-wallet signature and single mocked broadcast',async({page})=>{
 await page.setViewportSize({width:390,height:844});const state=await boot(page,kind);if(kind!=='evm')await page.locator('#usdtNetwork').selectOption(kind);await page.locator('#usdtConnect').click();await expect(page.locator('#usdtBalance')).toContainText('100 USDT');await page.locator('[data-usdt-tab=send]').click();await page.locator('#usdtRecipient').fill(kind==='evm'?fixtures.EVM_TO:kind==='tron'?fixtures.TRON_TO:fixtures.SOL_TO);await page.locator('#usdtAmount').fill('1.234567');await page.locator('#usdtRecipientAck').check();await page.locator('#usdtReview').click();await expect(page.locator('#usdtSign')).toBeVisible();await expect(page.locator('#usdtSign')).toBeDisabled();expect(state.writes).toHaveLength(0);expect(await page.evaluate(()=>window.__usdtWrites)).toHaveLength(0);await page.screenshot({path:'test-results/usdt-'+kind+'-review-mobile.png',fullPage:true});await page.locator('#usdtSignAck').check();await page.locator('#usdtSign').click();await expect(page.locator('#usdtLocalHistory')).toContainText('Submitted');if(kind==='evm')expect(await page.evaluate(()=>window.__usdtWrites)).toHaveLength(1);else expect(state.writes).toHaveLength(1);await page.locator('[data-usdt-tab=send]').click();await page.locator('#usdtRecipient').fill(kind==='evm'?fixtures.EVM_TO:kind==='tron'?fixtures.TRON_TO:fixtures.SOL_TO);await page.locator('#usdtAmount').fill('1');await page.locator('#usdtRecipientAck').check();await page.locator('#usdtReview').click();await expect(page.locator('#usdtStatus')).toContainText('unresolved');
});
test('mobile USDT controls stay inside the dialog and do not navigate or jump',async({page})=>{
 await page.setViewportSize({width:320,height:700});await boot(page,'evm');await page.locator('#usdtConnect').click();await expect(page.locator('#usdtQR')).toBeVisible();await page.screenshot({path:'test-results/usdt-receive-mobile.png',fullPage:true});const box=await page.locator('#usdtDialog').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(321);const before=await page.evaluate(()=>scrollY);await page.locator('[data-usdt-tab=send]').click();await page.locator('#usdtAmount').fill('1');await expect(page.locator('#usdtAmount')).toBeFocused();expect(await page.evaluate(()=>scrollY)).toBe(before);await expect(page.locator('body')).toHaveAttribute('data-page','wallet');
});
test('saved payment QR image is decoded locally and cannot submit by itself',async({page})=>{
 await boot(page,'evm');await page.locator('#usdtConnect').click();await expect(page.locator('#usdtBalance')).toContainText('100 USDT');await page.locator('#usdtQrMode').selectOption('payment');await page.locator('#usdtQrAmount').fill('2.345678');const ready=page.waitForEvent('download');await page.locator('#usdtSaveQR').click();const file=await ready,bytes=require('fs').readFileSync(await file.path());await page.locator('[data-usdt-tab=send]').click();await page.locator('#usdtPanel details summary').click();await page.locator('#usdtQrFile').setInputFiles({name:'receive.png',mimeType:'image/png',buffer:bytes});await expect(page.locator('#usdtRecipient')).toHaveValue(fixtures.EVM_FROM);await expect(page.locator('#usdtAmount')).toHaveValue('2.345678');expect(await page.evaluate(()=>window.__usdtWrites)).toHaveLength(0);await page.locator('#usdtRecipientAck').check();await page.locator('#usdtReview').click();await expect(page.locator('#usdtStatus')).toContainText('sending address');
});
