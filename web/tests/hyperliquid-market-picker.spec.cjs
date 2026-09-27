const {test,expect}=require('@playwright/test');

test('Hyperliquid picker exposes every returned perp with official logos and live chart',async({page})=>{
 await page.addInitScript(()=>{
  window.WebSocket=class{
   constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0);}
   send(raw){
    const sub=JSON.parse(raw).subscription;
    if(sub?.type==='l2Book')setTimeout(()=>this.onmessage?.({data:JSON.stringify({channel:'l2Book',data:{coin:sub.coin,time:Date.now(),levels:[[{px:'70000',sz:'1'}],[{px:'70001',sz:'1'}]]}})}),20);
   }
   close(){this.readyState=3;}
  };
 });
 await page.route('https://api.hyperliquid.xyz/info',async route=>{
  const body=route.request().postDataJSON();let data;
  if(body.type==='perpDexs')data=[null,{name:'xyz',fullName:'XYZ Markets'}];
  else if(body.type==='allPerpMetas')data=[
   {collateralToken:0,universe:[
    {name:'BTC',szDecimals:5,maxLeverage:40},
    {name:'ETH',szDecimals:4,maxLeverage:50},
    {name:'SOL',szDecimals:2,maxLeverage:20},
    {name:'HYPE',szDecimals:2,maxLeverage:10}
   ]},
   {collateralToken:0,universe:[{name:'xyz:NVDA',szDecimals:3,maxLeverage:10}]}
  ];
  else if(body.type==='metaAndAssetCtxs'&&body.dex==='xyz')data=[
   {universe:[{name:'xyz:NVDA',szDecimals:3,maxLeverage:10}]},
   [{markPx:'180',oraclePx:'180',dayNtlVlm:'50',openInterest:'1',funding:'0.0002',prevDayPx:'175'}]
  ];
  else if(body.type==='metaAndAssetCtxs')data=[
   {universe:[
    {name:'BTC',szDecimals:5,maxLeverage:40},
    {name:'ETH',szDecimals:4,maxLeverage:50},
    {name:'SOL',szDecimals:2,maxLeverage:20},
    {name:'HYPE',szDecimals:2,maxLeverage:10}
   ]},
   [
    {markPx:'70000',oraclePx:'70000',dayNtlVlm:'100',openInterest:'2',funding:'0.0001',prevDayPx:'69000'},
    {markPx:'2500',oraclePx:'2500',dayNtlVlm:'100',openInterest:'2',funding:'0.0001',prevDayPx:'2450'},
    {markPx:'150',oraclePx:'150',dayNtlVlm:'100',openInterest:'2',funding:'0.0001',prevDayPx:'145'},
    {markPx:'90',oraclePx:'90',dayNtlVlm:'100',openInterest:'2',funding:'0.0001',prevDayPx:'88'}
   ]
  ];
  else if(body.type==='candleSnapshot')data=[
   {t:Date.now()-900000,o:'2490',h:'2510',l:'2480',c:'2500',v:'10',s:body.req.coin,i:body.req.interval},
   {t:Date.now(),o:'2500',h:'2520',l:'2490',c:'2510',v:'12',s:body.req.coin,i:body.req.interval}
  ];
  else data={coin:body.coin||'ETH',levels:[[{px:'2509',sz:'1'}],[{px:'2511',sz:'1'}]],time:Date.now()};
  await route.fulfill({json:data});
 });
 await page.route(/https:\/\/app\.hyperliquid\.xyz\/coins\/.*\.svg/,route=>route.fulfill({
  status:200,contentType:'image/svg+xml',
  body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="16" fill="#fff"/></svg>'
 }));
 await page.goto('/web/');
 await page.getByRole('button',{name:'Trade',exact:true}).click();
 await expect(page.locator('#marketPickerButton')).toBeVisible();
 await expect(page.locator('#marketPickerSymbol')).toHaveText('ETH');
 await expect(page.locator('#marketPickerLogoWrap img')).toHaveAttribute('src',/\/coins\/ETH\.svg$/);
 await expect(page.locator('#marketCanvas')).toHaveAttribute('data-chart-bars','2');

 await page.locator('#marketPickerButton').click();
 await expect(page.locator('#marketPickerCount')).toHaveText('5 / 5 markets');
 await expect(page.locator('#marketPickerList .market-picker-row')).toHaveCount(5);
 await expect(page.locator('#marketPickerList img').first()).toHaveAttribute('src',/app\.hyperliquid\.xyz\/coins\//);

 await expect(page.locator('#marketPickerList [data-market="xyz:NVDA"] .market-picker-tag')).toHaveText('HIP-3');
 await page.locator('#marketPickerList [data-market="xyz:NVDA"]').click();
 await expect(page.locator('#marketSymbol')).toHaveValue('xyz:NVDA');
 await expect(page.locator('#marketPickerSymbol')).toHaveText('NVDA');
 await expect(page.locator('#chartAssetLogo')).toHaveAttribute('src',/\/coins\/NVDA\.svg$/);
 await expect(page.locator('#marketCanvas')).toHaveAttribute('data-chart-bars','2');
});

test('Hyperliquid spot picker uses token names and full spot universe',async({page})=>{
 await page.addInitScript(()=>{window.WebSocket=class{constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0)}send(){}close(){this.readyState=3}}});
 await page.route('https://api.hyperliquid.xyz/info',async route=>{
  const body=route.request().postDataJSON();let data;
  if(body.type==='perpDexs')data=[null];
  else if(body.type==='allPerpMetas')data=[{collateralToken:0,universe:[{name:'ETH',szDecimals:4,maxLeverage:50}]}];
  else if(body.type==='metaAndAssetCtxs')data=[{universe:[{name:'ETH'}]},[{markPx:'2500',oraclePx:'2500',dayNtlVlm:'1',openInterest:'1',funding:'0',prevDayPx:'2490'}]];
  else if(body.type==='spotMeta')data={
   tokens:[
    {name:'USDC',fullName:'USD Coin',index:0,szDecimals:2},
    {name:'HYPE',fullName:'Hyperliquid',index:150,szDecimals:2},
    {name:'UBTC',fullName:'Bitcoin',index:200,szDecimals:5}
   ],
   universe:[
    {name:'@107',index:107,tokens:[150,0]},
    {name:'@200',index:200,tokens:[200,0]}
   ]
  };
  else if(body.type==='spotMetaAndAssetCtxs')data=[
   {tokens:[],universe:[{name:'@107'},{name:'@200'}]},
   [{markPx:'90',dayNtlVlm:'1',prevDayPx:'89'},{markPx:'70000',dayNtlVlm:'1',prevDayPx:'69000'}]
  ];
  else if(body.type==='candleSnapshot')data=[{t:Date.now(),o:'90',h:'91',l:'89',c:'90',v:'1',s:body.req.coin,i:body.req.interval}];
  else data={};
  await route.fulfill({json:data});
 });
 await page.route(/https:\/\/app\.hyperliquid\.xyz\/coins\/.*\.svg/,route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'}));
 await page.goto('/web/');
 await page.getByRole('button',{name:'Trade',exact:true}).click();
 await page.locator('[data-trade-product="spot"]').click();
 await expect(page.locator('#marketPickerSymbol')).toHaveText('HYPE');
 await page.locator('#marketPickerButton').click();
 await expect(page.locator('#marketPickerCount')).toHaveText('2 / 2 markets');
 await expect(page.locator('#marketPickerList')).toContainText('Hyperliquid');
 await expect(page.locator('#marketPickerList')).toContainText('Bitcoin');
});
