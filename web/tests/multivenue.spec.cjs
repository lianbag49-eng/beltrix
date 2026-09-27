const {test,expect}=require('@playwright/test');

test('Hyperliquid terminal exposes default and HIP-3 markets with official icon URLs',async({page})=>{
 await page.addInitScript(()=>{window.WebSocket=class{
  constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0);}
  send(raw){const s=JSON.parse(raw).subscription;if(s?.type==='l2Book')this.timer=setInterval(()=>this.onmessage?.({data:JSON.stringify({channel:'l2Book',data:{coin:s.coin,time:Date.now(),levels:[[{px:'20',sz:'10'}],[{px:'22',sz:'12'}]]}})}),250);}
  close(){clearInterval(this.timer);this.readyState=3;}
 };});
 await page.route('https://api.hyperliquid.xyz/info',async route=>{
  const body=route.request().postDataJSON();
  let data;
  if(body.type==='perpDexs')data=[null,{name:'xyz',fullName:'XYZ Markets'}];
  else if(body.type==='meta'&&body.dex==='xyz')data={universe:[{name:'xyz:ABC',maxLeverage:10,szDecimals:2}]};
  else if(body.type==='meta')data={universe:[{name:'BTC',maxLeverage:40,szDecimals:5},{name:'ETH',maxLeverage:50,szDecimals:4}]};
  else if(body.type==='metaAndAssetCtxs'&&body.dex==='xyz')data=[{universe:[{name:'xyz:ABC'}]},[{markPx:'7',oraclePx:'7',funding:'0',dayNtlVlm:'10',openInterest:'3'}]];
  else if(body.type==='metaAndAssetCtxs')data=[{universe:[{name:'BTC'},{name:'ETH'}]},[{markPx:'21',oraclePx:'21',funding:'0',dayNtlVlm:'100',openInterest:'10'},{markPx:'22',oraclePx:'22',funding:'0',dayNtlVlm:'100',openInterest:'10'}]];
  else if(body.type==='candleSnapshot')data=[{t:Date.now()-60000,o:'20',h:'22',l:'19',c:'21',v:'100',s:body.req.coin,i:body.req.interval}];
  else data={};
  await route.fulfill({json:data});
 });
 await page.goto('/web/');
 await page.getByRole('button',{name:'Trade',exact:true}).click();
 await expect(page.locator('#marketVenue')).toHaveCount(0);
 await expect(page.locator('#marketPickerButton')).toBeVisible();
 await expect(page.locator('#marketPickerSymbol')).toHaveText('BTC');
 await page.locator('#marketPickerButton').click();
 await expect(page.locator('#marketPickerList .hl-market-row')).toHaveCount(3);
 await expect(page.locator('#marketPickerList')).toContainText('ABC');
 await page.locator('#marketSearch').fill('ABC');
 await expect(page.locator('#marketPickerList .hl-market-row')).toHaveCount(1);
 const icon=page.locator('#marketPickerList .hl-market-row img');
 await expect(icon).toHaveAttribute('src','https://app.hyperliquid.xyz/coins/ABC.svg');
 await page.locator('#marketPickerList .hl-market-row').click();
 await expect(page.locator('#marketPickerSymbol')).toHaveText('ABC');
 await expect(page.locator('#marketOHLC')).toContainText('O 20');
 await expect(page.locator('#marketStatus')).toContainText(/Snapshot|Live/);
});
