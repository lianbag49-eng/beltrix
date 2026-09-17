const {test,expect}=require('@playwright/test');
function series(coin,interval){
 const ms={ '1m':60000,'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000 }[interval];
 const end=Math.floor(Date.now()/ms)*ms,scale=coin==='@0'?.015:1;
 return Array.from({length:600},(_,i)=>{const c=(2470+Math.sin(i*.07)*22+Math.cos(i*.27)*4+i*.033)*scale,o=c+Math.sin(i*.9)*4*scale;return {t:end-(599-i)*ms,o:String(o),h:String(Math.max(o,c)+4*scale),l:String(Math.min(o,c)-4*scale),c:String(c),v:String(20+Math.abs(Math.sin(i*.23))*300)};});
}
async function setup(page){
 const requests=[],state={fail:false},errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8080/')||r.request().url().endsWith('/info')?r.fallback():r.abort());
 const meta={universe:[{name:'ETH',szDecimals:4,maxLeverage:50},{name:'BTC',szDecimals:5,maxLeverage:40}]},spot={tokens:[{name:'USDC',index:0,szDecimals:2},{name:'HYPE',index:1,szDecimals:2}],universe:[{name:'@0',tokens:[1,0],index:0}]};
 const context={markPx:'2491.24',oraclePx:'2490.85',prevDayPx:'2530',dayNtlVlm:'145902351',openInterest:'50120',funding:'0.000096'};
 await page.route('**/info',r=>{const q=r.request().postDataJSON();requests.push(q);let data=[];
 if(q.type==='meta')data=meta;else if(q.type==='spotMeta')data=spot;else if(q.type==='metaAndAssetCtxs')data=[meta,[context,context]];else if(q.type==='spotMetaAndAssetCtxs')data=[spot,[{...context,markPx:'37.36',prevDayPx:'37.90'}]];
 else if(q.type==='candleSnapshot'){if(state.fail)return r.fulfill({status:503,body:'Test candle endpoint unavailable'});data=series(q.req.coin,q.req.interval);}
 return r.fulfill({json:data});});
 await page.addInitScript(()=>{
  window.chartTestSockets=[];
  window.WebSocket=class{constructor(){this.readyState=1;window.chartTestSockets.push(this);setTimeout(()=>this.onopen?.(),0);}send(raw){const q=JSON.parse(raw);if(q.subscription?.type==='candle')this.candle=q.subscription;if(q.subscription?.type==='l2Book'){const coin=q.subscription.coin,mid=coin==='@0'?37.36:2491.24,step=coin==='@0'?.01:.08;this.timer=setInterval(()=>this.onmessage?.({data:JSON.stringify({channel:'l2Book',data:{coin,time:Date.now(),levels:[Array.from({length:5},(_,i)=>({px:(mid-step*(i+1)).toFixed(2),sz:(2.15+i*9.73).toFixed(2)})),Array.from({length:5},(_,i)=>({px:(mid+step*(i+1)).toFixed(2),sz:(6.13+i*5.71).toFixed(2)}))]}})}),300)}}close(){clearInterval(this.timer);this.readyState=3;}};
 });
 await page.goto('/web/#markets');await expect(page.locator('html')).toHaveAttribute('data-clean-terminal','v1');
 if(await page.locator('#markets').getAttribute('data-trade-layout')!=='simple')await page.locator('#tradeLayoutMode').click();
 await expect(page.locator('#marketCanvas')).toHaveAttribute('data-chart-bars','600');return {requests,state,errors};
}
async function expand(page){await page.locator('#cleanOpenChart').click();await expect(page.locator('#chartFullscreen')).toBeVisible();await expect(page.locator('#marketCanvas')).toBeVisible();}
async function stamp(page){await page.evaluate(()=>{if(document.getElementById('chartPreviewStamp'))return;const d=document.createElement('div');d.id='chartPreviewStamp';d.textContent='DESIGN PREVIEW · SAMPLE DATA · NO REAL ACCOUNT';d.style.cssText='font:9px system-ui;color:#ceb480;background:#201b13;padding:7px 10px;text-align:center;letter-spacing:.4px';document.querySelector('.top').before(d);});}

test('one visible navigation; secondary routes remain accessible',async({page})=>{
 const {errors}=await setup(page);await expect(page.locator('.app>.nav')).toBeHidden();await expect(page.locator('.bottom-nav')).toBeVisible();
 expect(await page.locator('nav').evaluateAll(ns=>ns.filter(n=>n.getClientRects().length).length)).toBe(1);
 await page.locator('#cleanMore').click();await expect(page.locator('#cleanMoreDialog')).toBeVisible();await page.locator('[data-clean-route=settings]').click();await expect(page.locator('body')).toHaveAttribute('data-page','settings');
 await page.locator('.bottom-nav [data-page=markets]').click();await expect(page.locator('body')).toHaveAttribute('data-page','markets');expect(errors).toEqual([]);
});
test('folding really draws candles and saved indicator choices restore',async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:844});await expect(page.locator('#marketCanvas')).toBeHidden();
 await page.locator('#futuresChart > summary').click();await expect(page.locator('#marketCanvas')).toBeVisible();await expect(page.locator('#marketCanvas')).toHaveAttribute('data-visible-bars','60');
 expect(Number(await page.locator('#marketCanvas').getAttribute('data-rsi'))).toBeGreaterThan(0);
 for(const id of ['macd','ma','ema','boll'])await page.locator(`[data-chart-indicator=${id}]`).click();
 await page.locator('#chartMuteIndicators').click();await expect(page.locator('#marketCanvas')).toHaveAttribute('data-chart-indicators','');await page.locator('#chartMuteIndicators').click();
 await expect(page.locator('#marketCanvas')).toHaveAttribute('data-chart-indicators','VOL,RSI,MACD,MA,EMA,BOLL');
 await page.locator('#futuresChart > summary').click();await page.locator('#futuresChart > summary').click();await expect(page.locator('[data-chart-indicator=macd]')).toHaveAttribute('aria-pressed','true');
 await page.reload();await expect(page.locator('#marketCanvas')).toBeVisible();await expect(page.locator('[data-chart-indicator=boll]')).toHaveAttribute('aria-pressed','true');
});
test('timeframe, zoom, history and cursor act on real loaded candles',async({page})=>{
 const {requests}=await setup(page);await expand(page);await page.locator('[data-chart-interval="1h"]').click();await expect(page.locator('#marketInterval')).toHaveValue('1h');
 await expect.poll(()=>requests.some(q=>q.type==='candleSnapshot'&&q.req.interval==='1h')).toBe(true);
 await page.locator('#chartZoomIn').click();await expect(page.locator('#marketCanvas')).toHaveAttribute('data-visible-bars','46');
 await page.locator('#marketCanvas').focus();await page.keyboard.press('Home');await expect.poll(async()=>Number(await page.locator('#marketCanvas').getAttribute('data-history-offset'))).toBeGreaterThan(0);
 await page.keyboard.press('ArrowRight');await expect(page.locator('#chartCandleReadout')).toContainText('UTC');await page.locator('#chartLatest').click();await expect(page.locator('#marketCanvas')).toHaveAttribute('data-history-offset','0');
});
test('expanded chart restores the same canvas, inputs and scroll without any signer',async({page})=>{
 const {errors}=await setup(page);await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'.page{min-height:2300px}'});
 await page.locator('#tradeSize').fill('1.25');await page.evaluate(()=>{window.originalChart=document.getElementById('marketCanvas');window.originalSize=document.getElementById('tradeSize');scrollTo(0,100)});const before=await page.evaluate(()=>scrollY);
 await page.evaluate(()=>document.getElementById('cleanOpenChart').click());await expect(page.locator('#chartFullscreen')).toBeVisible();await page.locator('#chartExpand').click();
 await expect(page.locator('#chartFullscreen')).not.toBeVisible();await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(before);await expect(page.locator('#tradeSize')).toHaveValue('1.25');
 expect(await page.evaluate(()=>originalChart===document.getElementById('marketCanvas')&&originalSize===document.getElementById('tradeSize'))).toBe(true);
 await expect(page.locator('#futuresLong')).toBeDisabled();expect(await page.evaluate(()=>!window.ethereum&&!window.tronWeb&&!window.solana)).toBe(true);expect(errors).toEqual([]);
});
test('indicator period validation and failed-data retry never invent numbers',async({page})=>{
 const {state}=await setup(page);await expand(page);await page.locator('#chartSettingsToggle').click();await page.locator('#chartRsiPeriod').fill('999');await page.locator('#chartRsiPeriod').dispatchEvent('change');await expect(page.locator('#chartRsiPeriod')).toHaveAttribute('aria-invalid','true');
 await page.locator('#chartRsiPeriod').fill('7');await page.locator('#chartRsiPeriod').dispatchEvent('change');await expect(page.locator('#chartIndicatorReadout')).toContainText('RSI(7)');
 state.fail=true;await page.locator('#chartRetry').click();await expect(page.locator('#marketCanvas')).toHaveAttribute('data-chart-bars','0');await expect(page.locator('#chartCandleReadout')).toHaveText('No candles loaded');
 state.fail=false;await page.locator('#chartRetry').click();await expect(page.locator('#marketCanvas')).toHaveAttribute('data-chart-bars','600');
});
test('Spot and Perps keep an unclipped chart at narrow and wide sizes',async({page})=>{
 const {errors}=await setup(page);
 for(const product of ['spot','perp']){await page.locator(`[data-trade-product=${product}]`).click();await expect(page.locator('#marketSymbol')).toHaveValue(product==='spot'?'@0':'ETH');
 for(const width of [320,390,430,1280]){await page.setViewportSize({width,height:844});await page.waitForTimeout(160);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.setViewportSize({width:390,height:844});await expand(page);await expect(page.locator('#chartProductLabel')).toContainText(product==='spot'?'Spot':'Perpetual');await page.locator('#chartExpand').click();}
 expect(errors).toEqual([]);
});
test('render selectable preview screens with clearly labeled simulated data',async({page,browserName})=>{
 await setup(page);await page.setViewportSize({width:390,height:844});await stamp(page);await page.waitForTimeout(500);
 await page.screenshot({path:`test-results/clean-futures-${browserName}.png`,fullPage:true});
 await expand(page);await page.locator('[data-chart-indicator=macd]').click();await page.locator('[data-chart-indicator=ema]').click();
 await page.evaluate(()=>{const d=document.createElement('p');d.textContent='DESIGN PREVIEW · SIMULATED CANDLES';d.style.cssText='margin:0 0 6px;text-align:center;font:10px system-ui;color:#c9b27f';document.getElementById('chartFullscreen').prepend(d)});await page.waitForTimeout(250);
 await page.screenshot({path:`test-results/clean-chart-${browserName}.png`});await page.locator('#chartExpand').click();
 await page.locator('[data-trade-product=spot]').click();await expect(page.locator('#marketSymbol')).toHaveValue('@0');await page.waitForTimeout(500);
 await page.screenshot({path:`test-results/clean-spot-${browserName}.png`,fullPage:true});
});
