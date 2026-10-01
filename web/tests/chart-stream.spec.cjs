const {test,expect}=require('@playwright/test');

async function setup(page){
 const state={fail:false,hold:false,snapshots:0},errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8080/')||r.request().url().endsWith('/info')?r.fallback():r.abort());
 const meta={universe:[{name:'ETH',szDecimals:4,maxLeverage:25},{name:'BTC',szDecimals:5,maxLeverage:40}]};
 const ctx={markPx:'2500',oraclePx:'2500',prevDayPx:'2450',dayNtlVlm:'100000',openInterest:'100',funding:'0.0001'};
 await page.route('**/info',async r=>{
  const q=r.request().postDataJSON();let data=[];
  if(q.type==='perpDexs')data=[null];
  if(q.type==='allPerpMetas')data=[meta];
  if(q.type==='meta')data=meta;
  if(q.type==='metaAndAssetCtxs')data=[meta,[ctx,ctx]];
  if(q.type==='candleSnapshot'){
   state.snapshots++;
   if(state.hold)await new Promise(resolve=>{state.release=resolve;});
   if(state.fail)return r.fulfill({status:503,body:'Snapshot unavailable'});
   const ms={'1m':60000,'3m':180000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000}[q.req.interval],end=Math.floor(q.req.endTime/ms)*ms;
   data=Array.from({length:80},(_,i)=>({t:end-(79-i)*ms,o:'2500',h:'2510',l:'2490',c:String(2500+i/10),v:'100',s:q.req.coin,i:q.req.interval}));
  }
  return r.fulfill({json:data});
 });
 await page.addInitScript(()=>{
  window.streamSockets=[];window.streamSilent=false;window.chartPaints=0;
  const clear=CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect=function(...a){if(this.canvas.id==='marketCanvas')window.chartPaints++;return clear.apply(this,a);};
  window.WebSocket=class{
   constructor(){this.readyState=0;this.subscriptions=[];streamSockets.push(this);setTimeout(()=>{this.readyState=1;this.onopen?.();},0);}
   message(channel,data){this.onmessage?.({data:JSON.stringify({channel,data})});}
   send(raw){const q=JSON.parse(raw);if(q.method==='ping'){if(!streamSilent)this.message('pong');return;}const s=q.subscription;if(!s)return;this.subscriptions.push(s);if(s.type==='candle')this.candle=s;if(s.type==='l2Book'){this.coin=s.coin;this.timer=setInterval(()=>{if(!streamSilent)this.message('l2Book',{coin:s.coin,time:Date.now(),levels:[[{px:'2499',sz:'2'}],[{px:'2501',sz:'3'}]]});},250);}}
   close(){clearInterval(this.timer);this.readyState=3;this.onclose?.();}
  };
 });
 await page.goto('/web/#markets');
 await expect(page.locator('html')).toHaveAttribute('data-clean-terminal','v1');
 await expect(page.locator('#marketCanvas')).toHaveAttribute('data-chart-bars','80');
 await expect(page.locator('#futuresBookFeed')).toHaveText('Live · mainnet');
 return {state,errors};
}

test('reconnecting keeps candles and history while refilling the feed',async({page})=>{
 const {state,errors}=await setup(page);
 await page.locator('#cleanOpenChart').click();
 await page.locator('#marketCanvas').focus();await page.keyboard.press('Home');
 await expect.poll(async()=>Number(await page.locator('#marketCanvas').getAttribute('data-history-offset'))).toBeGreaterThan(0);
 const offset=await page.locator('#marketCanvas').getAttribute('data-history-offset');
 expect(Number(offset)).toBeGreaterThan(0);
 state.hold=true;
 await page.evaluate(()=>streamSockets.at(-1).close());
 await expect(page.locator('#futuresBookFeed')).toHaveText('Stale / unavailable');
 await expect.poll(()=>state.snapshots,{timeout:12000}).toBeGreaterThan(1);
 await expect(page.locator('#marketCanvas')).toHaveAttribute('data-chart-bars','80');
 await expect(page.locator('#marketCanvas')).toHaveAttribute('data-history-offset',offset);
 state.hold=false;state.release();
 await expect(page.locator('#futuresBookFeed')).toHaveText('Live · mainnet');
 expect(errors).toEqual([]);
});

test('a stalled open socket recovers automatically without clearing the chart',async({page})=>{
 await setup(page);await page.clock.install();
 await page.evaluate(()=>{window.streamSilent=true;});
 await page.clock.runFor(46000);
 await expect.poll(()=>page.evaluate(()=>streamSockets.length)).toBeGreaterThan(1);
 await expect.poll(async()=>Number(await page.locator('#marketCanvas').getAttribute('data-chart-bars'))).toBeGreaterThanOrEqual(80);
 await page.evaluate(()=>{window.streamSilent=false;});
 await page.clock.runFor(1200);
 await expect(page.locator('#futuresBookFeed')).toHaveText('Live · mainnet');
});

test('the chart maintains a one-second cadence without redrawing for every book tick',async({page})=>{
 await setup(page);await page.locator('#cleanOpenChart').click();
 await expect(page.locator('#marketCanvas')).toBeVisible();
 await page.waitForTimeout(800);
 const before=await page.evaluate(()=>chartPaints);
 await page.waitForTimeout(1800);
 const draws=await page.evaluate(n=>chartPaints-n,before);
 expect(draws).toBeGreaterThanOrEqual(1);expect(draws).toBeLessThanOrEqual(3);
});

test('executed trade prices reach the provisional candle within one second',async({page})=>{
 await setup(page);await page.locator('#cleanOpenChart').click();
 await page.locator('#chartLatest').click();await page.mouse.move(1,1);
 await page.evaluate(()=>streamSockets.at(-1).message('trades',[{coin:'ETH',time:Date.now(),tid:123,px:'2533',sz:'2',side:'B'}]));
 await expect(page.locator('#marketOHLC')).toContainText('C 2533',{timeout:1500});
 await expect(page.locator('#chartCandleReadout')).toContainText('C 2,533');
 await expect(page.locator('#marketPrice')).toHaveText('2,533');
});

test('a delayed history response cannot roll back newer live candles',async({page})=>{
 const {state}=await setup(page);state.hold=true;
 await page.locator('#marketRefresh').click();await expect.poll(()=>!!state.release).toBe(true);
 await page.evaluate(()=>{const live=streamSockets.at(-1),ms={'1m':60000,'5m':300000,'15m':900000}[live.candle.interval];live.message('candle',{s:live.candle.coin,i:live.candle.interval,t:Math.floor(Date.now()/ms)*ms,o:'2500',h:'2700',l:'2490',c:'2700',v:'125'});});
 await expect(page.locator('#marketOHLC')).toContainText('C 2700');
 state.hold=false;state.release();
 await expect(page.locator('#marketOHLC')).toContainText('C 2700');
 await page.waitForTimeout(1100);await expect(page.locator('#marketOHLC')).toContainText('C 2700');
});

test('changing the interval ignores the previous stream and starts a fresh history',async({page})=>{
 await setup(page);await page.evaluate(()=>{window.oldStream=streamSockets.at(-1);});
 await page.locator('#marketInterval').selectOption('5m');
 await expect(page.locator('#chartProductLabel')).toContainText('5m');
 await page.evaluate(()=>oldStream.message('candle',{s:'ETH',i:'15m',t:Date.now(),o:'9000',h:'9000',l:'9000',c:'9000',v:'1'}));
 await expect(page.locator('#marketOHLC')).toContainText('C 2507.9');
 await expect(page.locator('#marketCanvas')).toHaveAttribute('data-chart-bars','80');
});
