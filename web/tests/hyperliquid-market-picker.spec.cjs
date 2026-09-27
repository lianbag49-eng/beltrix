const {test,expect}=require('@playwright/test');

test('Hyperliquid market picker exposes validator and HIP-3 markets with logos and chart selection',async({page})=>{
 await page.addInitScript(()=>{window.WebSocket=class{
  constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0)}
  send(raw){
   const s=JSON.parse(raw).subscription;
   if(s?.type==='l2Book')setTimeout(()=>this.onmessage?.({data:JSON.stringify({channel:'l2Book',data:{coin:s.coin,time:Date.now(),levels:[[{px:'99',sz:'2'}],[{px:'101',sz:'2'}]]}})}),20);
  }
  close(){this.readyState=3}
 };});
 await page.route('https://api.hyperliquid.xyz/info',async route=>{
  const body=route.request().postDataJSON();let data;
  if(body.type==='allPerpMetas')data=[
   [{universe:[{name:'BTC',szDecimals:5,maxLeverage:50},{name:'ETH',szDecimals:4,maxLeverage:50}]},[{markPx:'70000'},{markPx:'3000'}]],
   [{universe:[{name:'xyz:XYZ100',szDecimals:2,maxLeverage:20,onlyIsolated:true}]},[{markPx:'100'}]]
  ];
  else if(body.type==='metaAndAssetCtxs'&&body.dex==='xyz')data=[{universe:[{name:'xyz:XYZ100'}]},[{markPx:'100',oraclePx:'100',dayNtlVlm:'1000',openInterest:'10',funding:'0',prevDayPx:'99'}]];
  else if(body.type==='metaAndAssetCtxs')data=[{universe:[{name:'BTC'},{name:'ETH'}]},[{markPx:'70000',oraclePx:'70000',dayNtlVlm:'1000',openInterest:'10',funding:'0',prevDayPx:'69000'},{markPx:'3000'}]];
  else if(body.type==='candleSnapshot')data=[
   {t:Date.now()-900000,o:'98',h:'102',l:'97',c:body.req.coin==='xyz:XYZ100'?'100':'70000',v:'12',s:body.req.coin,i:body.req.interval}
  ];
  else data={universe:[]};
  await route.fulfill({json:data});
 });
 await page.goto('/web/');
 await page.getByRole('button',{name:'Trade',exact:true}).click();
 await expect(page.locator('#marketPickerButton')).toContainText('ETH');
 await page.locator('#marketPickerButton').click();
 await expect(page.locator('#marketPickerCount')).toHaveText('3 markets');
 await expect(page.locator('.hl-market-row')).toHaveCount(3);
 await expect(page.locator('.hl-market-row').first().locator('img')).toHaveAttribute('src','https://app.hyperliquid.xyz/coins/BTC_USDC.svg');
 await page.locator('#marketPickerSearch').fill('XYZ100');
 await expect(page.locator('.hl-market-row')).toHaveCount(1);
 await page.locator('.hl-market-row').click();
 await expect(page.locator('#marketSymbol')).toHaveValue('xyz:XYZ100');
 await expect(page.locator('#marketPickerButton')).toContainText('XYZ100');
 await expect(page.locator('#marketOHLC')).toContainText('C 100');
 await expect(page.locator('#marketCanvas')).toHaveAttribute('data-chart-bars','1');
});
