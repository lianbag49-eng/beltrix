const {test,expect}=require('@playwright/test');
test('market selection loads spot metadata, candles, and shows failures',async({page})=>{
 const requests=[];
 // Book rendering is part of this test; never depend on an unmocked live socket.
 await page.addInitScript(()=>{window.WebSocket=class{
  constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0);}
  send(raw){const s=JSON.parse(raw).subscription;if(s?.type==='l2Book')this.timer=setInterval(()=>this.onmessage?.({data:JSON.stringify({channel:'l2Book',data:{coin:s.coin,time:Date.now(),levels:[[{px:'20',sz:'10'}],[{px:'22',sz:'12'}]]}})}),250);}
  close(){clearInterval(this.timer);this.readyState=3;}
 };});
 await page.route('https://api.hyperliquid.xyz/info',async route=>{const body=route.request().postDataJSON();requests.push(body);let data;
 if(body.type==='perpDexs')data=[null,{name:'xyz',fullName:'XYZ Markets'}];
 else if(body.type==='meta'&&body.dex==='xyz')data={universe:[{name:'xyz:ABC',maxLeverage:10,szDecimals:2}]};
 else if(body.type==='meta')data={universe:[{name:'ETH',maxLeverage:50,szDecimals:4},{name:'BTC',maxLeverage:40,szDecimals:5}]};
 else if(body.type==='spotMeta')data={tokens:[{name:'USDC',index:0},{name:'HYPE',index:150}],universe:[{name:'@107',tokens:[150,0]}]};
 else if(body.type==='metaAndAssetCtxs'&&body.dex==='xyz')data=[{universe:[{name:'xyz:ABC'}]},[{markPx:'7',oraclePx:'7',funding:'0',dayNtlVlm:'10',openInterest:'3'}]];
 else if(body.type==='metaAndAssetCtxs')data=[{universe:[{name:'ETH'},{name:'BTC'}]},[{markPx:'21',oraclePx:'21',funding:'0',dayNtlVlm:'100',openInterest:'10'},{markPx:'22',oraclePx:'22',funding:'0',dayNtlVlm:'100',openInterest:'10'}]];
 else if(body.type==='spotMetaAndAssetCtxs')data=[{universe:[{name:'@107'}]},[{markPx:'21',oraclePx:'21',dayNtlVlm:'100'}]];
 else data=[{t:Date.now()-60000,o:'20',h:'22',l:'19',c:'21',v:'100',s:body.req.coin,i:body.req.interval}];
 await route.fulfill({json:data});});
 await page.goto('/web/');await page.getByRole('button',{name:'Trade',exact:true}).click();
 await expect(page.locator('#marketPrice')).toHaveText('21');
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('.nav button')).toHaveText(['Wallet','Explore','Trade','Practice','Settings']);
 expect(await page.locator('body').innerText()).not.toMatch(/[가-힣]/);
 await expect(page.locator('#marketBids')).toBeVisible();
 await expect(page.locator('#marketPickerButton')).toBeVisible();
 await expect(page.locator('#marketPickerSymbol')).toHaveText('BTC');
 await page.screenshot({path:'test-results/beltrix-desktop.png',fullPage:true});
 await page.locator('#marketType').selectOption('spot');await expect(page.locator('#marketSymbol')).toHaveValue('@107');await expect(page.locator('#marketPrice')).toHaveText('21');
 expect(requests.some(x=>x.req?.coin==='@107')).toBe(true);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/beltrix-markets.png',fullPage:true});
 await page.route('https://api.hyperliquid.xyz/info',r=>r.fulfill({status:503,body:'Unavailable'}));
 await page.locator('#marketRefresh').click();await expect(page.locator('#marketStatus')).toContainText('failed');await expect(page.locator('#marketPrice')).toHaveText('—');
});
