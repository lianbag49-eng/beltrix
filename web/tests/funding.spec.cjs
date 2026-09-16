const {test,expect}=require('@playwright/test');
const {encodeFunctionData,encodeFunctionResult,encodeAbiParameters,encodeEventTopics,erc20Abi,parseAbi}=require('viem');
const A='0x1111111111111111111111111111111111111111',B='0x2222222222222222222222222222222222222222',H='0x'+'a'.repeat(64);
const TOKEN='0x1baabb04529d43a73232b713c0fe471f7c7334d5',BRIDGE='0x08cfc1b6b2dcf36a1480b99353a354aa8ac56f89';
const ABI=parseAbi(['function paused() view returns (bool)','function usdcToken() view returns (address)']);
async function setup(page){
 const state={withdrawable:'20',mode:'disabled',fail:false,exchange:'ok'},posted=[];
 const config={A,B,H,TOKEN,BRIDGE,paused:encodeFunctionData({abi:ABI,functionName:'paused'}),token:encodeFunctionData({abi:ABI,functionName:'usdcToken'}),yes:encodeAbiParameters([{type:'bool'}],[true]),no:encodeAbiParameters([{type:'bool'}],[false]),decimals:encodeAbiParameters([{type:'uint8'}],[6]),symbol:encodeFunctionResult({abi:erc20Abi,functionName:'symbol',result:'USDC'}),name:encodeFunctionResult({abi:erc20Abi,functionName:'name',result:'USD Coin'})};
 await page.addInitScript(c=>{
  window.fMock={...c,account:c.A,chain:'0x66eee',handlers:{},sent:[],signed:[],nonce:3,native:'0xde0b6b3a7640000',tokens:'0x5f5e100',pausedFlag:false,gas:'0x10000',failure:null,receipt:null,logs:[],signatureChange:false};
  window.ethereum={on(k,fn){(fMock.handlers[k]??=[]).push(fn);},removeListener(k,fn){fMock.handlers[k]=(fMock.handlers[k]||[]).filter(x=>x!==fn);},async request(q){
   const f=fMock;
   if(['eth_accounts','eth_requestAccounts'].includes(q.method))return [f.account];
   if(q.method==='eth_chainId')return f.chain;
   if(q.method==='wallet_switchEthereumChain'){f.chain=q.params[0].chainId;return null;}
   if(q.method==='eth_getBalance')return f.native;
   if(q.method==='eth_getTransactionCount')return '0x'+f.nonce.toString(16);
   if(q.method==='eth_gasPrice')return '0x3b9aca00';
   if(q.method==='eth_estimateGas')return f.gas;
   if(q.method==='eth_getCode')return '0x';
   if(q.method==='eth_blockNumber')return '0x10000';
   if(q.method==='eth_getLogs')return f.logs;
   if(q.method==='eth_call'){
    const data=q.params[0].data||'';
    if(data===f.paused)return f.pausedFlag?f.yes:f.no;
    if(data===f.token){const token=f.chain==='0xa4b1'?'0xaf88d065e77c8cc2239327c5edb3a432268e5831':f.TOKEN;return '0x'+token.slice(2).padStart(64,'0');}
    if(data.startsWith('0x70a08231'))return '0x'+BigInt(f.tokens).toString(16).padStart(64,'0');
    if(data.startsWith('0x313ce567'))return f.decimals;
    if(data.startsWith('0x95d89b41'))return f.symbol;
    if(data.startsWith('0x06fdde03'))return f.name;
    if(data.startsWith('0xa9059cbb'))return f.rejectSimulation?f.no:f.yes;
    throw Error('Unexpected contract call '+data);
   }
   if(q.method==='eth_sendTransaction'){f.sent.push(q.params[0]);if(f.failure==='reject')throw {code:4001,message:'Rejected'};if(f.failure==='unknown')throw Error('Wallet response lost');return f.H;}
   if(q.method==='eth_signTypedData_v4'){f.signed.push(JSON.parse(q.params[1]));if(f.failure==='reject')throw {code:4001,message:'Rejected'};if(f.signatureChange){f.account=f.B;for(const fn of f.handlers.accountsChanged||[])fn([f.B]);}return '0x'+'11'.repeat(64)+'1b';}
   if(q.method==='eth_getTransactionByHash'){const tx=f.sent[0];return tx?{hash:f.H,from:f.A,to:tx.to,nonce:tx.nonce,value:'0x0',input:tx.data,gas:tx.gas,gasPrice:tx.gasPrice,blockHash:'0x'+'b'.repeat(64),blockNumber:'0x10000',transactionIndex:'0x0',type:'0x0',r:'0x'+'1'.repeat(64),s:'0x'+'2'.repeat(64),v:'0x1b'}:null;}
   if(q.method==='eth_getTransactionReceipt')return f.receipt;
   throw Error('Unexpected wallet RPC '+q.method);
  }};
  window.WebSocket=class{constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0)}send(){}close(){this.readyState=3}};
 },config);
 await page.route('**/*',async r=>{
  const url=new URL(r.request().url());if(['127.0.0.1','localhost'].includes(url.hostname))return r.continue();
  if(url.pathname==='/exchange'){posted.push(r.request().postDataJSON());if(state.exchange==='unknown')return r.abort();if(state.exchange==='reject')return r.fulfill({json:{status:'err',response:'Insufficient withdrawable balance'}});return r.fulfill({json:{status:'ok',response:{type:'default'}}});}
  if(url.pathname==='/info'){
   const q=r.request().postDataJSON();let data=[];
   const meta={universe:[{name:'ETH',szDecimals:4,maxLeverage:20}]},ctx={markPx:'2500',oraclePx:'2500',prevDayPx:'2550',dayNtlVlm:'10000000',openInterest:'1000',funding:'0.0001'};
   if(state.fail&&q.type==='clearinghouseState')return r.fulfill({status:503,body:'Unavailable'});
   if(q.type==='meta')data=meta;else if(q.type==='metaAndAssetCtxs')data=[meta,[ctx]];else if(q.type==='spotMeta')data={tokens:[{name:'USDC',index:0,szDecimals:2},{name:'HYPE',index:1,szDecimals:2}],universe:[{name:'@0',tokens:[1,0],index:0}]};
   else if(q.type==='spotMetaAndAssetCtxs')data=[{tokens:[],universe:[]},[]];
   else if(q.type==='clearinghouseState')data={withdrawable:state.withdrawable,marginSummary:{accountValue:'10000'},assetPositions:[]};
   else if(q.type==='spotClearinghouseState')data={balances:[{coin:'USDC',token:0,total:'30',hold:'5'}]};
   else if(q.type==='userAbstraction')data=state.mode;
   else if(q.type==='activeAssetData')data={coin:q.coin,user:q.user,leverage:{type:'cross',value:1},maxTradeSzs:['1','1'],availableToTrade:['20','20']};
   else if(q.type==='candleSnapshot')data=Array.from({length:20},(_,i)=>({t:Date.now()-(20-i)*60000,o:'2490',h:'2510',l:'2480',c:'2500',v:'10'}));
   return r.fulfill({json:data});
  }
  // All other services are intentionally unavailable. No network or wallet write leaves this test.
  return r.abort();
 });
 await page.goto('/web/#markets');await expect(page.locator('html')).toHaveAttribute('data-funding-ux','v1');
 return {state,posted};
}
async function connect(page,net='testnet'){await page.locator('#marketNetwork').selectOption(net);await page.locator('#tradeConnect').click();await expect(page.locator('#tradeConnect')).toContainText('0x1111');await expect(page.locator('#tradeConnect')).toBeEnabled();}
async function form(page,mode='deposit',value='5'){await page.locator({deposit:'#tradeDeposit',withdraw:'#tradeWithdraw',transfer:'#tradeTransferFunds'}[mode]).click();await expect(page.locator('#fReview')).toBeEnabled();await page.locator('#fAmount').fill(value);}
async function confirm(page){await page.locator('#fReview').click();await expect(page.locator('#fConfirm')).toBeDisabled();await page.locator('#fAck').check();await page.locator('#fConfirm').click();}
test('funding entry requires a real connected account; no placeholder QR',async({page})=>{const {posted}=await setup(page);await page.locator('#tradeDeposit').click();await expect(page.locator('#fConnect')).toBeVisible();await expect(page.locator('#fQR')).toHaveCount(0);expect(posted).toHaveLength(0);expect(await page.evaluate(()=>fMock.sent.length+fMock.signed.length)).toBe(0);});
test('personal USDC QR includes the selected network and never the shared bridge recipient',async({page})=>{await setup(page);await connect(page);await form(page);await page.locator('#fReceive').click();await expect(page.locator('#fQrSave')).toBeEnabled();await expect(page.locator('#fQrAddress')).toHaveText(A);await expect(page.locator('#fQR')).toHaveAttribute('data-payload',A);await page.locator('#fQrFormat').selectOption('request');await page.locator('#fQrAmount').fill('5.123456');await expect(page.locator('#fQR')).toHaveAttribute('data-payload',new RegExp('@421614/transfer\\?address='+A+'&uint256=5123456'));const download=page.waitForEvent('download');await page.locator('#fQrSave').click();expect((await download).suggestedFilename()).toContain('USDC-421614');await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/funding-receive.png',fullPage:true});expect(await page.evaluate(()=>fMock.sent.length+fMock.signed.length)).toBe(0);});
test('invalid QR amount clears the previous code and disables saving',async({page})=>{await setup(page);await connect(page);await form(page);await page.locator('#fReceive').click();await expect(page.locator('#fQrSave')).toBeEnabled();await page.locator('#fQrAmount').fill('1e9');await expect(page.locator('#fQrSave')).toBeDisabled();await expect(page.locator('#fQR')).not.toHaveAttribute('data-payload',/./);});
test('deposit signs one exact native USDC transfer to the pinned testnet bridge, no approvals',async({page})=>{const {posted}=await setup(page);await connect(page);await form(page,'deposit','5.123456');await page.locator('#fReview').click();await expect(page.locator('#fConfirm')).toBeDisabled();expect(await page.evaluate(()=>fMock.sent.length)).toBe(0);await page.locator('#fAck').check();await page.locator('#fConfirm').evaluate(b=>{b.click();b.click();});await expect(page.locator('#fLocalHistory')).toContainText('Pending');const sent=await page.evaluate(()=>fMock.sent);expect(sent).toHaveLength(1);expect(sent[0].chainId).toBe('0x66eee');expect(sent[0].to.toLowerCase()).toBe(TOKEN);expect(sent[0].data).toBe(encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[BRIDGE,5123456n]}));expect(posted).toHaveLength(0);});
for(const [title,configure,quantity,pattern] of [
 ['minimum',()=>{},'4.99','Minimum deposit'],['gas',()=>{fMock.native='0x0'},'5','Insufficient Arbitrum ETH'],['paused bridge',()=>{fMock.pausedFlag=true},'5','paused'],['simulation',()=>{fMock.rejectSimulation=true},'5','simulation']
])test('deposit rejects '+title+' before a wallet request',async({page})=>{await setup(page);await connect(page);await page.evaluate(configure);await form(page,'deposit',quantity);await page.locator('#fReview').click();await expect(page.locator('#fStatus')).toContainText(pattern);expect(await page.evaluate(()=>fMock.sent.length)).toBe(0);});
test('withdrawal confirms amount/fee then signs the correct mainnet action without an EVM send',async({page})=>{const {posted}=await setup(page);await connect(page,'mainnet');await form(page,'withdraw','10');await page.locator('#fDestination').fill(B);await page.locator('#fReview').click();await expect(page.locator('#fundingBody')).toContainText('9 USDC');await expect(page.locator('#fundingBody')).toContainText('REAL FUNDS');expect(posted).toHaveLength(0);await page.locator('#fAck').check();await page.locator('#fConfirm').click();await expect.poll(()=>posted.length).toBe(1);expect(posted[0].action).toMatchObject({type:'withdraw3',destination:B,amount:'10',hyperliquidChain:'Mainnet',signatureChainId:'0xa4b1'});expect(posted[0].nonce).toBe(posted[0].action.time);expect(await page.evaluate(()=>fMock.sent.length)).toBe(0);await expect(page.locator('#fLocalHistory')).toContainText('Withdrawal pending');await expect(page.locator('#fLocalHistory')).not.toContainText('Arbitrum confirmed');});
test('withdrawal rejects wrong-chain QR and equity instead of available balance',async({page})=>{await setup(page);await connect(page);await form(page,'withdraw','10');await page.locator('#fDestination').fill('ethereum:'+B+'@42161');await page.locator('#fReview').click();await expect(page.locator('#fStatus')).toContainText('network does not match');await page.locator('#fDestination').fill(B);await page.locator('#fAmount').fill('100');await page.locator('#fReview').click();await expect(page.locator('#fStatus')).toContainText('exceeds');expect(await page.evaluate(()=>fMock.signed.length)).toBe(0);});
test('review expiry and changed deposit nonce block submission',async({page})=>{await setup(page);await connect(page);await form(page);await page.locator('#fReview').click();await expect(page.locator('#fAck')).toBeVisible();await page.evaluate(()=>{fMock.nonce++});await page.locator('#fAck').check();await page.locator('#fConfirm').click();await expect(page.locator('#fStatus')).toContainText('Nonce or network gas changed');expect(await page.evaluate(()=>fMock.sent.length)).toBe(0);});
test('account changed inside withdrawal signature withholds the signed action',async({page})=>{const {posted}=await setup(page);await connect(page);await form(page,'withdraw');await page.locator('#fReview').click();await page.evaluate(()=>fMock.signatureChange=true);await page.locator('#fAck').check();await page.locator('#fConfirm').click();await expect(page.locator('#fStatus')).toContainText('changed');expect(posted).toHaveLength(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('beltrix-funding-v1'))[0].status)).toBe('Not submitted');});
test('unknown funding response stays locked across reload; no automatic retry',async({page})=>{const {state,posted}=await setup(page);state.exchange='unknown';await connect(page);await form(page,'withdraw');await confirm(page);await expect(page.locator('#fStatus')).toContainText('uncertain');expect(posted).toHaveLength(1);await page.reload();await connect(page);await form(page,'withdraw');await page.locator('#fReview').click();await expect(page.locator('#fStatus')).toContainText('earlier funding request');expect(posted).toHaveLength(1);});
test('Spot to Perps transfer encodes actual free-balance action; unified mode is rejected',async({page})=>{const {state,posted}=await setup(page);await connect(page);await form(page,'transfer','25');await confirm(page);await expect.poll(()=>posted.length).toBe(1);expect(posted[0].action).toMatchObject({type:'usdClassTransfer',amount:'25',toPerp:true,hyperliquidChain:'Testnet'});await page.locator('#fundingClose').click();state.mode='unifiedAccount';await form(page,'transfer','5');await page.locator('#fReview').click();await expect(page.locator('#fStatus')).toContainText('standard account');expect(posted).toHaveLength(1);});
test('deposit receipt verification requires a matching token transfer and does not invent trading credit',async({page})=>{
 await setup(page);await connect(page);await form(page);await confirm(page);await expect(page.locator('#fLocalHistory')).toContainText('Pending');
 const log={address:TOKEN,topics:encodeEventTopics({abi:erc20Abi,eventName:'Transfer',args:{from:A,to:BRIDGE}}),data:encodeAbiParameters([{type:'uint256'}],[5000000n]),blockNumber:'0x10000',blockHash:'0x'+'b'.repeat(64),transactionHash:H,transactionIndex:'0x0',logIndex:'0x0',removed:false};
 await page.evaluate(({log,A,TOKEN,H})=>{fMock.receipt={transactionHash:H,transactionIndex:'0x0',blockHash:'0x'+'b'.repeat(64),blockNumber:'0x10000',from:A,to:TOKEN,cumulativeGasUsed:'0x10000',gasUsed:'0x10000',effectiveGasPrice:'0x3b9aca00',status:'0x1',logs:[log],logsBloom:'0x'+'0'.repeat(512),type:'0x0',contractAddress:null}}, {log,A,TOKEN,H});
 await expect(page.locator('#fHistoryRefresh')).toBeEnabled();await page.locator('#fHistoryRefresh').click();await expect(page.locator('#fLocalHistory')).toContainText('Arbitrum confirmed');await expect(page.locator('#fLocalHistory')).toContainText('does not infer');
});
test('funding dialogs retain page scroll and fit mobile viewport',async({page})=>{await setup(page);await connect(page);await page.setViewportSize({width:390,height:740});await page.evaluate(()=>scrollTo(0,120));const y=await page.evaluate(()=>scrollY);await page.locator('#tradeDeposit').click();await expect(page.locator('#fReview')).toBeEnabled();await page.locator('#fAmount').click();await page.keyboard.type('10');await expect(page.locator('#fAmount')).toHaveValue('10');await expect(page.locator('#fAmount')).toBeFocused();await page.screenshot({path:'test-results/funding-deposit.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#fundingClose').click();expect(Math.abs(await page.evaluate(()=>scrollY)-y)).toBeLessThanOrEqual(2);});
