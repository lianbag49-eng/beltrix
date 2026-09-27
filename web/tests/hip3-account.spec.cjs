const {test,expect}=require('@playwright/test');

test('HIP-3 selection scopes account orders, positions and sizing to its perp DEX',async({page})=>{
 const requests=[];
 await page.route('**/info',async route=>{
  const q=route.request().postDataJSON();requests.push(q);let data=[];
  if(q.type==='perpDexs')data=[null,{name:'xyz',fullName:'XYZ Markets'}];
  else if(q.type==='allPerpMetas')data=[
   {collateralToken:0,universe:[{name:'ETH',szDecimals:4,maxLeverage:50}]},
   {collateralToken:0,universe:[{name:'xyz:NVDA',szDecimals:3,maxLeverage:10}]}
  ];
  else if(q.type==='meta')data={universe:[{name:'ETH',szDecimals:4,maxLeverage:50}]};
  else if(q.type==='metaAndAssetCtxs'&&q.dex==='xyz')data=[
   {universe:[{name:'xyz:NVDA',szDecimals:3,maxLeverage:10}]},
   [{markPx:'180',oraclePx:'180',dayNtlVlm:'100',openInterest:'4',funding:'0.0001',prevDayPx:'175'}]
  ];
  else if(q.type==='metaAndAssetCtxs')data=[
   {universe:[{name:'ETH',szDecimals:4,maxLeverage:50}]},
   [{markPx:'2500',oraclePx:'2500',dayNtlVlm:'100',openInterest:'2',funding:'0.0001',prevDayPx:'2450'}]
  ];
  else if(q.type==='candleSnapshot')data=[
   {t:Date.now()-900000,o:'178',h:'181',l:'177',c:'180',v:'10',s:q.req.coin,i:q.req.interval},
   {t:Date.now(),o:'180',h:'182',l:'179',c:'181',v:'12',s:q.req.coin,i:q.req.interval}
  ];
  else if(q.type==='frontendOpenOrders')data=[];
  else if(q.type==='clearinghouseState')data={marginSummary:{accountValue:'1000'},withdrawable:'900',assetPositions:[{position:{coin:'xyz:NVDA',szi:'1',entryPx:'175',leverage:{type:'cross',value:5},marginUsed:'35',unrealizedPnl:'5',cumFunding:{sinceOpen:'0'}}}]};
  else if(q.type==='spotClearinghouseState')data={balances:[]};
  else if(q.type==='userFills'||q.type==='userFunding'||q.type==='twapHistory')data=[];
  else if(q.type==='activeAssetData')data={coin:q.coin,user:q.user,leverage:{type:'cross',value:5},maxTradeSzs:['5','5'],availableToTrade:['500','500'],markPx:'180'};
  await route.fulfill({json:data});
 });
 await page.route(/https:\/\/app\.hyperliquid\.xyz\/coins\/.*\.svg/,route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'}));
 await page.addInitScript(()=>{
  window.ethereum={on(){},removeListener(){},async request(q){
   if(q.method==='eth_accounts'||q.method==='eth_requestAccounts')return ['0x1111111111111111111111111111111111111111'];
   if(q.method==='eth_chainId')return '0x66eee';
   if(q.method==='wallet_switchEthereumChain')return null;
   throw Error(q.method);
  }};
  window.WebSocket=class{
   constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0)}
   send(raw){
    const sub=JSON.parse(raw).subscription;
    if(sub?.type==='l2Book')this.timer=setInterval(()=>this.onmessage?.({data:JSON.stringify({channel:'l2Book',data:{coin:sub.coin,time:Date.now(),levels:[[{px:'179.9',sz:'2'}],[{px:'180.1',sz:'2'}]]}})}),200);
   }
   close(){clearInterval(this.timer);this.readyState=3}
  };
 });
 await page.goto('/web/#markets');
 await page.locator('#marketNetwork').selectOption('testnet');
 await expect(page.locator('#marketPickerSymbol')).toHaveText('ETH');
 await page.locator('#marketPickerButton').click();
 await page.locator('#marketPickerList [data-market="xyz:NVDA"]').click();
 await expect(page.locator('#marketPickerSymbol')).toHaveText('NVDA');
 await expect(page.locator('#marketCanvas')).toHaveAttribute('data-chart-bars','2');

 await page.locator('#tradeConnect').click();
 await expect(page.locator('#tradeAccount')).toContainText('111111');
 await expect(page.locator('[data-account-tab=positions]')).toContainText('1');

 await expect.poll(()=>requests.some(q=>q.type==='clearinghouseState'&&q.dex==='xyz')).toBe(true);
 await expect.poll(()=>requests.some(q=>q.type==='frontendOpenOrders'&&q.dex==='xyz')).toBe(true);
 const hip3States=requests.filter(q=>q.type==='clearinghouseState'&&q.dex==='xyz');
 expect(hip3States.length).toBeGreaterThan(0);
});
