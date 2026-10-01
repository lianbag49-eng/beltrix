const {test,expect}=require('@playwright/test');

async function setup(page){
 const state={fail:false,hold:false,snapshots:0,contextFail:false,contextHold:false,contextRequests:0,contextReplies:0,mark:'2500'},errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8080/')||r.request().url().endsWith('/info')?r.fallback():r.abort());
 const meta={universe:[{name:'ETH',szDecimals:4,maxLeverage:25},{name:'BTC',szDecimals:5,maxLeverage:40}]};
 const ctx={markPx:'2500',oraclePx:'2500',prevDayPx:'2450',dayNtlVlm:'100000',openInterest:'100',funding:'0.0001'};
 await page.route('**/info',async r=>{
  const q=r.request().postDataJSON();let data=[];
  if(q.type==='perpDexs')data=[null];
  if(q.type==='allPerpMetas')data=[meta];
  if(q.type==='meta')data=meta;
  if(q.type==='metaAndAssetCtxs'){
   state.contextRequests++;data=[meta,[{...ctx,markPx:state.mark},{...ctx,markPx:'65000'}]];
   if(state.contextHold)await new Promise(resolve=>{state.releaseContext=resolve;});
   if(state.contextFail)return r.fulfill({status:503,body:'Context unavailable'});
   await r.fulfill({json:data});state.contextReplies++;return;
  }
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
  window.streamSockets=[];window.streamSilent=false;window.streamBookSilent=false;window.streamContextSilent=false;window.streamMark='2500';window.chartPaints=0;
  const clear=CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect=function(...a){if(this.canvas.id==='marketCanvas')window.chartPaints++;return clear.apply(this,a);};
  window.WebSocket=class{
   constructor(){this.readyState=0;this.subscriptions=[];streamSockets.push(this);setTimeout(()=>{this.readyState=1;this.onopen?.();},0);}
   message(channel,data){this.onmessage?.({data:JSON.stringify({channel,data})});}
   send(raw){const q=JSON.parse(raw);if(q.method==='ping'){if(!streamSilent)this.message('pong');return;}const s=q.subscription;if(!s)return;
    if(q.method==='unsubscribe'){if(s.type==='activeAssetCtx')clearInterval(this.contextTimer);return;}
    this.subscriptions.push(s);if(s.type==='candle')this.candle=s;
    if(s.type==='l2Book'){this.coin=s.coin;this.timer=setInterval(()=>{if(!streamSilent&&!streamBookSilent)this.message('l2Book',{coin:s.coin,time:Date.now(),levels:[[{px:'2499',sz:'2'}],[{px:'2501',sz:'3'}]]});},250);}
    if(s.type==='activeAssetCtx'){clearInterval(this.contextTimer);this.contextTimer=setInterval(()=>{if(!streamSilent&&!streamContextSilent)this.message('activeAssetCtx',{coin:s.coin,ctx:{markPx:s.coin==='BTC'?'65000':streamMark,oraclePx:'2500',prevDayPx:'2450',dayNtlVlm:'100000',openInterest:'100',funding:'0.0001'}});},1000);}
   }
   close(){clearInterval(this.timer);clearInterval(this.contextTimer);this.readyState=3;this.onclose?.();}
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

test('Mark stays synchronized when only the order book pauses',async({page})=>{
 await setup(page);await page.clock.install();
 await page.evaluate(()=>{window.streamBookSilent=true;window.streamMark='2533';});
 await page.clock.runFor(7000);
 await expect(page.locator('#futuresBookFeed')).toHaveText('Stale / unavailable');
 await expect(page.locator('#marketMark')).toHaveText('2,533');
 await expect(page.locator('#futuresBookPrice')).toHaveText('2,533');
 await expect(page.locator('#futuresMarkFeed')).toHaveText('Live · mainnet');
 await expect(page.locator('#tradeReview')).toBeDisabled();
});

test('a delayed context response cannot roll back a newer live Mark',async({page})=>{
 const {state}=await setup(page);state.contextHold=true;state.mark='2400';
 await page.evaluate(()=>{window.streamContextSilent=true;});
 await page.locator('#marketRefresh').click();await expect.poll(()=>!!state.releaseContext).toBe(true);
 const replies=state.contextReplies;
 await page.evaluate(()=>streamSockets.at(-1).message('activeAssetCtx',{coin:'ETH',ctx:{markPx:'2700'}}));
 await expect(page.locator('#marketMark')).toHaveText('2,700');
 state.contextHold=false;state.releaseContext();await expect.poll(()=>state.contextReplies).toBeGreaterThan(replies);
 await expect(page.locator('#marketMark')).toHaveText('2,700');
 await expect(page.locator('#futuresBookPrice')).toHaveText('2,700');
});

test('a silent Mark channel uses fresh snapshots and resubscribes without interrupting the book',async({page})=>{
 const {state,errors}=await setup(page);await page.clock.install();state.mark='2750';
 await page.evaluate(()=>{window.streamContextSilent=true;});
 await page.clock.runFor(6500);
 await expect(page.locator('#marketMark')).toHaveText('2,750');
 await expect(page.locator('#futuresBookPrice')).toHaveText('2,750');
 await expect(page.locator('#futuresBookFeed')).toHaveText('Live · mainnet');
 const requests=state.contextRequests;
 state.mark='2760';await page.clock.runFor(10500);
 await expect.poll(()=>state.contextRequests).toBeGreaterThan(requests);
 await expect(page.locator('#futuresBookPrice')).toHaveText('2,760');
 expect(await page.evaluate(()=>streamSockets.length)).toBe(1);
 expect(await page.evaluate(()=>streamSockets[0].subscriptions.filter(s=>s.type==='activeAssetCtx').length)).toBeGreaterThan(1);
 state.contextFail=true;await page.evaluate(()=>{window.streamContextSilent=false;window.streamMark='2770';});
 await page.clock.runFor(1200);
 await expect(page.locator('#marketMark')).toHaveText('2,770');
 await expect(page.locator('#futuresBookPrice')).toHaveText('2,770');
 await expect(page.locator('#futuresMarkFeed')).toHaveText('Live · mainnet');
 expect(errors).toEqual([]);
});

test('same-market refresh, depth and timeframe changes never blank the last Mark',async({page})=>{
 const {state}=await setup(page);state.contextFail=true;
 await page.evaluate(()=>{
  window.streamContextSilent=true;window.markBlanks=[];
  const check=()=>{for(const id of ['marketMark','futuresBookPrice'])if(document.getElementById(id).textContent==='—')markBlanks.push(id);};
  window.markObserver=new MutationObserver(check);
  for(const id of ['marketMark','futuresBookPrice'])markObserver.observe(document.getElementById(id),{childList:true});
 });
 await page.locator('#bookDepth').selectOption('deep');
 await page.locator('#marketInterval').selectOption('5m');
 await page.locator('#marketRefresh').click();
 await page.evaluate(()=>streamSockets.at(-1).close());
 await expect(page.locator('#futuresBookFeed')).toHaveText('Stale / unavailable');
 await expect(page.locator('#futuresBookPrice')).toHaveText('2,500');
 await expect(page.locator('#futuresBookFeed')).toHaveText('Live · mainnet');
 expect(await page.evaluate(()=>markBlanks)).toEqual([]);
});

test('failed recovery retains an explicitly stale Mark and network return restores both displays',async({page})=>{
 const {state,errors}=await setup(page);await page.clock.install();state.contextFail=true;
 await page.evaluate(()=>{window.streamSilent=true;});
 await page.clock.runFor(95000);
 await expect(page.locator('#marketMark')).toHaveText('2,500');
 await expect(page.locator('#futuresBookPrice')).toHaveText('2,500');
 await expect(page.locator('#marketMark')).toHaveAttribute('data-state','stale');
 await expect(page.locator('#futuresBookPrice')).toHaveAttribute('data-state','stale');
 await expect(page.locator('#futuresMarkFeed')).toContainText('Stale · Last update');
 await expect(page.locator('#tradeReview')).toBeDisabled();
 state.contextFail=false;state.mark='2800';
 await page.evaluate(()=>{window.streamSilent=false;window.streamMark='2800';window.dispatchEvent(new Event('online'));});
 await page.clock.runFor(18000);
 await expect(page.locator('#marketMark')).toHaveText('2,800');
 await expect(page.locator('#futuresBookPrice')).toHaveText('2,800');
 await expect(page.locator('#futuresMarkFeed')).toHaveText('Live · mainnet');
 expect(errors).toEqual([]);
});

test('market changes reject old-stream and invalid Mark values',async({page})=>{
 const {state}=await setup(page);state.contextFail=true;
 await page.evaluate(()=>{window.oldMarkStream=streamSockets.at(-1);window.streamContextSilent=true;});
 await page.locator('#marketSymbol').selectOption('BTC');
 await expect(page.locator('#marketMark')).toHaveText('—');
 await expect(page.locator('#futuresBookPrice')).toHaveText('—');
 await page.evaluate(()=>{
  oldMarkStream.message('activeAssetCtx',{coin:'ETH',ctx:{markPx:'9999'}});
  const live=streamSockets.at(-1);
  live.message('activeAssetCtx',{coin:'ETH',ctx:{markPx:'8888'}});
  for(const markPx of [null,'0','-10','NaN','Infinity'])live.message('activeAssetCtx',{coin:'BTC',ctx:{markPx}});
 });
 await expect(page.locator('#marketMark')).toHaveText('—');
 await page.evaluate(()=>streamSockets.at(-1).message('activeAssetCtx',{coin:'BTC',ctx:{markPx:'65000'}}));
 await expect(page.locator('#marketMark')).toHaveText('65,000');
 await expect(page.locator('#futuresBookPrice')).toHaveText('65,000');
 await page.locator('#marketNetwork').selectOption('testnet');
 await expect(page.locator('#marketMark')).toHaveText('—');
 await expect(page.locator('#futuresBookPrice')).toHaveText('—');
});
