const {test,expect}=require('@playwright/test');

test('multi-venue selector loads Orderly catalog and keeps funded trading locked',async({page})=>{
 await page.addInitScript(()=>{window.WebSocket=class{
  constructor(){this.readyState=1;setTimeout(()=>this.onopen?.(),0);}
  send(){}
  close(){this.readyState=3;}
 };});
 await page.route('https://api.hyperliquid.xyz/info',async route=>{
  const body=route.request().postDataJSON();
  let data;
  if(body.type==='meta')data={universe:[{name:'ETH',maxLeverage:50}]};
  else if(body.type==='metaAndAssetCtxs')data=[{universe:[{name:'ETH'}]},[{markPx:'2500',oraclePx:'2500',dayNtlVlm:'1',openInterest:'1',funding:'0'}]];
  else data=[{t:Date.now()-60000,o:'2500',h:'2501',l:'2499',c:'2500',v:'1',s:body.req?.coin||'ETH',i:body.req?.interval||'15m'}];
  await route.fulfill({json:data});
 });
 await page.route('https://api.orderly.org/v1/public/info',route=>route.fulfill({json:{
  success:true,data:{rows:[
   {symbol:'PERP_BTC_USDC',quote_tick:0.1,base_min:0.001,max_leverage:20,index_price:70000},
   {symbol:'PERP_ETH_USDC',quote_tick:0.01,base_min:0.01,max_leverage:20,index_price:2500}
  ]}
 }}));
 await page.route(/https:\/\/api\.orderly\.org\/v1\/tv\/history.*/,route=>route.fulfill({json:{
  s:'ok',t:[1000,1900],o:[70000,70100],h:[70200,70300],l:[69900,70000],c:[70100,70200],v:[10,12]
 }}));
 await page.goto('/web/');
 await page.getByRole('button',{name:'Trade',exact:true}).click();
 await expect(page.locator('#marketVenue')).toBeVisible();
 await expect(page.locator('#marketVenue')).toHaveValue('hyperliquid');
 await page.locator('#marketVenue').selectOption('orderly');
 await expect(page.locator('#marketSymbol')).toHaveValue(/PERP_/);
 await expect(page.locator('#marketVenueNote')).toContainText('read-only');
 await expect(page.locator('#marketOHLC')).toContainText('O 70100');
 await expect(page.locator('#marketStatus')).toContainText('OHLCV');
 await expect(page.locator('#tradeConnect')).toBeDisabled();
 await expect(page.locator('#tradeReview')).toBeDisabled();
 await expect(page.locator('.testnet')).toContainText('READ ONLY');
 await expect(page.locator('#marketType')).toBeDisabled();
 await expect(page.locator('#terminalVenueServices')).toBeHidden();

 await page.locator('#marketVenue').selectOption('hyperliquid');
 await expect(page.locator('#tradeConnect')).toBeEnabled();
 await expect(page.locator('#marketType')).toBeEnabled();
 await expect(page.locator('#terminalVenueServices')).toBeVisible();
});
