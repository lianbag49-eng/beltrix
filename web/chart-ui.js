import {INDICATORS, CHART_DEFAULTS, chartPreferences, calculateIndicators, visibleWindow} from './chart-core.js';
for(const name of ['chart-studio.css','terminal-clean.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./'+name,import.meta.url).href;document.head.append(link);}
const KEY='beltrix-chart-indicators-v1', OPEN_KEY='beltrix-chart-open-v1';
const labels={volume:'VOL',rsi:'RSI',macd:'MACD',ma:'MA',ema:'EMA',boll:'BOLL'};
const colors={up:'#51c6aa',down:'#ee687c',gold:'#e0bc7a',purple:'#b497ee',blue:'#7caefa',grid:'#20252d',muted:'#8c96a3',text:'#dbe1e8'};
const num=(n,dp=2)=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:dp}):'—';
const compact=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n):'—';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const $=id=>document.getElementById(id);
function element(tag,cls,html=''){const e=document.createElement(tag);e.className=cls;e.innerHTML=html;return e;}

/** Interactive read-only chart. Reuses the original canvas and interval selector. */
export function createMarketChart(canvas) {
 const ctx=canvas.getContext('2d'),panel=canvas.closest('.chart-panel'),drawer=$('futuresChart');
 let prefs={...CHART_DEFAULTS};try{prefs=chartPreferences(JSON.parse(localStorage.getItem(KEY)));}catch{}
 let candles=[],values={},meta={},marketKey='',count=60,offset=0,cross=-1,drawPending=false,geometry=null,sourceAt=0,feed='snapshot';
 let fullscreen=false,home=null,returnFocus=null,savedY=0,savedPage='',collapsed=false,drag=null,pinch=null;
 const pointers=new Map();
 panel.classList.add('chart-studio');
 const heading=element('div','chart-heading',`<div><strong id="chartPairLabel">Chart</strong><small id="chartProductLabel">OHLCV · Hyperliquid</small></div><div class="chart-heading-actions"><button type="button" id="chartExpand" aria-label="Expand chart">⛶</button><button type="button" id="chartCollapse" aria-label="Hide chart">⌄</button></div>`);
 const toolbar=element('div','chart-toolbar',`<div class="chart-intervals" role="group" aria-label="Chart timeframe">${['1m','5m','15m','1h','4h','1d'].map(i=>`<button type="button" data-chart-interval="${i}">${i}</button>`).join('')}</div><button type="button" id="chartSettingsToggle" aria-expanded="false" aria-controls="chartIndicatorSettings">Indicators</button>`);
 const chips=element('div','chart-indicator-chips',`${INDICATORS.map(id=>`<button type="button" data-chart-indicator="${id}" aria-pressed="false">${labels[id]}</button>`).join('')}<button type="button" id="chartMuteIndicators" aria-label="Hide all selected indicators" aria-pressed="false">Hide all</button>`);
 const settings=element('section','chart-indicator-settings',`<div class="chart-period-grid"><label>RSI length<input id="chartRsiPeriod" data-chart-period="rsiPeriod" type="number" min="2" max="200" step="1"></label><label>MA length<input data-chart-period="maPeriod" type="number" min="2" max="200" step="1"></label><label>EMA length<input data-chart-period="emaPeriod" type="number" min="2" max="200" step="1"></label><label>BOLL length<input data-chart-period="bollPeriod" type="number" min="2" max="200" step="1"></label><label>BOLL deviation<input data-chart-period="bollWidth" type="number" min="0.5" max="5" step="0.5"></label><span>MACD<br><b>12 / 26 / 9</b></span></div><p id="chartSettingsMessage">Close-price indicators. RSI: Wilder smoothing. Periods are candles, not days.</p><button type="button" id="chartResetSettings">Reset indicators</button>`);settings.id='chartIndicatorSettings';settings.hidden=true;
 const readout=element('div','chart-readout','<span id="chartCandleReadout">Waiting for candle data</span><span id="chartIndicatorReadout">RSI —</span>');readout.setAttribute('aria-live','off');
 const content=element('div','chart-content');content.id='chartContent';
 const stage=element('div','chart-stage');canvas.before(stage);stage.append(canvas);canvas.tabIndex=0;canvas.setAttribute('aria-describedby','chartInteractionHint');canvas.setAttribute('aria-label','Interactive price chart. Arrow keys inspect candles, plus and minus zoom.');
 const controls=element('div','chart-controls',`<span id="chartRangeInfo">—</span><div><button type="button" id="chartZoomOut" aria-label="Zoom chart out">−</button><button type="button" id="chartZoomIn" aria-label="Zoom chart in">+</button><button type="button" id="chartLatest">Latest</button><button type="button" id="chartRetry">Retry data</button></div>`);
 const hint=element('p','chart-hint','Drag sideways to inspect history · Tap a candle for values · Pinch in expanded view.');hint.id='chartInteractionHint';
 const dataStatus=element('p','chart-data-status','Loading candle data…');dataStatus.id='chartDataStatus';dataStatus.setAttribute('role','status');
 panel.prepend(heading);heading.after(content);content.append(toolbar,chips,settings,readout,stage,controls,dataStatus,hint);
 const modal=element('dialog','chart-fullscreen');modal.id='chartFullscreen';modal.setAttribute('aria-label','Expanded market chart');document.body.append(modal);
 if(drawer){
  drawer.querySelector(':scope > summary').innerHTML='<span id="chartDrawerTitle">Chart</span><span id="chartDrawerState">VOL · RSI</span>';
  try{drawer.open=localStorage.getItem(OPEN_KEY)==='1';}catch{}
  drawer.addEventListener('toggle',()=>{try{localStorage.setItem(OPEN_KEY,drawer.open?'1':'0');}catch{}schedule();});
 }
 function save(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{dataStatus.textContent='Chart preferences will last for this session only.';}}
 function sync(){
  const interval=$('marketInterval');
  for(const b of toolbar.querySelectorAll('[data-chart-interval]')){b.setAttribute('aria-pressed',String(b.dataset.chartInterval===interval.value));b.disabled=interval.disabled;}
  for(const b of chips.querySelectorAll('[data-chart-indicator]')){b.setAttribute('aria-pressed',String(prefs[b.dataset.chartIndicator]&&!prefs.muted));b.classList.toggle('chart-muted-selection',prefs[b.dataset.chartIndicator]&&prefs.muted);}
  $('chartMuteIndicators').textContent=prefs.muted?'Show all':'Hide all';$('chartMuteIndicators').setAttribute('aria-pressed',String(prefs.muted));$('chartMuteIndicators').setAttribute('aria-label',prefs.muted?'Restore selected indicators':'Hide all selected indicators');
  for(const input of settings.querySelectorAll('[data-chart-period]'))if(document.activeElement!==input)input.value=prefs[input.dataset.chartPeriod];
  $('chartExpand').textContent=fullscreen?'×':'⛶';$('chartExpand').setAttribute('aria-label',fullscreen?'Exit expanded chart':'Expand chart');
  $('chartCollapse').hidden=fullscreen;$('chartCollapse').textContent=collapsed?'⌃':'⌄';$('chartCollapse').setAttribute('aria-label',collapsed?'Show chart':'Hide chart');
  $('chartZoomIn').disabled=candles.length<12||count<=12;$('chartZoomOut').disabled=candles.length<=count;
  const selected=INDICATORS.filter(id=>prefs[id]&&!prefs.muted).map(id=>labels[id]);
  if($('chartDrawerState'))$('chartDrawerState').textContent=selected.join(' · ')||'Price only';
  canvas.dataset.chartIndicators=selected.join(',');canvas.dataset.chartBars=String(candles.length);
 }
 function schedule(){if(drawPending)return;drawPending=true;requestAnimationFrame(()=>{drawPending=false;draw();});}
 function line(arr,start,end,x,y,color,dash=[]){ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1.35;ctx.setLineDash(dash);let running=false;for(let i=start;i<end;i++){if(!finite(arr?.[i])){running=false;continue;}if(running)ctx.lineTo(x(i),y(arr[i]));else{ctx.moveTo(x(i),y(arr[i]));running=true;}}ctx.stroke();ctx.setLineDash([]);}
 function draw(){
  sync();if(!canvas.isConnected||!canvas.getClientRects().length||canvas.clientWidth<50||collapsed||document.hidden)return;
  const on=id=>prefs[id]&&!prefs.muted,w=Math.floor(canvas.clientWidth),priceHeight=fullscreen?Math.max(230,Math.min(440,innerHeight-380)):w>680?300:230;
  const panes=[{name:'Price',height:priceHeight}];if(on('volume'))panes.push({name:'VOL',height:64});if(on('rsi'))panes.push({name:'RSI',height:94});if(on('macd'))panes.push({name:'MACD',height:100});
  const h=panes.reduce((s,p)=>s+p.height,0)+25,dpr=Math.min(devicePixelRatio||1,3);
  canvas.style.setProperty('--chart-height',h+'px');canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#0c0f14';ctx.fillRect(0,0,w,h);ctx.font='10px system-ui';
  if(!candles.length){ctx.fillStyle=colors.muted;ctx.textAlign='center';ctx.fillText('Candle data is not available yet.',w/2,priceHeight/2-8);ctx.fillText('Use Retry data to reconnect.',w/2,priceHeight/2+12);ctx.textAlign='left';geometry=null;readout.firstChild.textContent='No candles loaded';readout.lastChild.textContent='Indicators need historical candles.';return;}
  const win=visibleWindow(candles.length,count,offset);offset=win.offset;const {start,end}=win;const rows=candles.slice(start,end),right=w-68,left=8,step=(right-left)/rows.length,x=i=>left+(i-start+.5)*step;
  let low=Math.min(...rows.map(c=>c.l)),high=Math.max(...rows.map(c=>c.h));
  for(const arr of [on('ma')&&values.ma,on('ema')&&values.ema,...(on('boll')?[values.boll?.upper,values.boll?.lower]:[])])if(arr)for(let i=start;i<end;i++)if(finite(arr[i])){low=Math.min(low,arr[i]);high=Math.max(high,arr[i]);}
  const pad=(high-low||high*.005)*.1;ySetup();
  function ySetup(){geometry={start,end,left,right,step,priceHeight,h,w};}
  const y=p=>30+(high+pad-p)/(high-low+pad*2)*(priceHeight-50);
  for(let i=0;i<5;i++){const p=low+(high-low)*i/4,py=y(p);ctx.strokeStyle=colors.grid;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(right,py);ctx.stroke();ctx.fillStyle=colors.muted;ctx.fillText(num(p,p<1?5:2),right+5,py+3);}
  if(on('boll')){line(values.boll.upper,start,end,x,y,colors.blue);line(values.boll.lower,start,end,x,y,colors.blue);line(values.boll.middle,start,end,x,y,colors.muted,[3,3]);}
  for(let i=start;i<end;i++){const c=candles[i];ctx.strokeStyle=ctx.fillStyle=c.c>=c.o?colors.up:colors.down;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x(i),y(c.h));ctx.lineTo(x(i),y(c.l));ctx.stroke();ctx.fillRect(x(i)-step*.32,Math.min(y(c.o),y(c.c)),Math.max(1,step*.64),Math.max(1,Math.abs(y(c.o)-y(c.c))));}
  if(on('ma'))line(values.ma,start,end,x,y,colors.gold);if(on('ema'))line(values.ema,start,end,x,y,colors.purple);
  const selected=cross>=start&&cross<end?cross:end-1,c=candles[selected];
  const legend=[on('ma')&&`MA(${prefs.maPeriod}) ${num(values.ma[selected])}`,on('ema')&&`EMA(${prefs.emaPeriod}) ${num(values.ema[selected])}`,on('boll')&&`BOLL(${prefs.bollPeriod},${prefs.bollWidth})`].filter(Boolean);
  ctx.fillStyle=colors.gold;ctx.fillText(legend.join('  '),left,14);
  let top=priceHeight;
  for(const pane of panes.slice(1)){
   ctx.strokeStyle=colors.grid;ctx.beginPath();ctx.moveTo(0,top);ctx.lineTo(w,top);ctx.stroke();
   const t=top+23,b=top+pane.height-9;
   if(pane.name==='VOL'){
    const max=Math.max(...rows.map(c=>c.v),1);for(let i=start;i<end;i++){ctx.globalAlpha=.6;ctx.fillStyle=candles[i].c>=candles[i].o?colors.up:colors.down;const vh=candles[i].v/max*(b-t);ctx.fillRect(x(i)-step*.32,b-vh,Math.max(1,step*.64),vh);}ctx.globalAlpha=1;ctx.fillStyle=colors.muted;ctx.fillText(`VOL  ${compact(c.v)}${meta.base?' '+meta.base:''}`,left,top+14);ctx.fillText(compact(max),right+5,t+5);
   }
   if(pane.name==='RSI'){
    const ry=v=>b-v/100*(b-t);for(const threshold of [30,70]){ctx.strokeStyle='#4e435c';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(left,ry(threshold));ctx.lineTo(right,ry(threshold));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=colors.muted;ctx.fillText(String(threshold),right+5,ry(threshold)+3);}line(values.rsi,start,end,x,ry,colors.purple);ctx.fillStyle=colors.purple;ctx.fillText(`RSI(${prefs.rsiPeriod})  ${num(values.rsi[selected])}`,left,top+14);
   }
   if(pane.name==='MACD'){
    const arrays=[values.macd.line,values.macd.signal,values.macd.histogram];let max=0;for(const arr of arrays)for(let i=start;i<end;i++)if(finite(arr[i]))max=Math.max(max,Math.abs(arr[i]));max=max||1;const my=v=>(t+b)/2-v/max*(b-t)/2;
    ctx.strokeStyle=colors.grid;ctx.beginPath();ctx.moveTo(left,my(0));ctx.lineTo(right,my(0));ctx.stroke();
    for(let i=start;i<end;i++){const v=values.macd.histogram[i];if(!finite(v))continue;ctx.fillStyle=v>=0?colors.up:colors.down;ctx.globalAlpha=.55;ctx.fillRect(x(i)-step*.32,Math.min(my(v),my(0)),Math.max(1,step*.64),Math.max(.5,Math.abs(my(v)-my(0))));}ctx.globalAlpha=1;line(values.macd.line,start,end,x,my,colors.gold);line(values.macd.signal,start,end,x,my,colors.blue);ctx.fillStyle=colors.gold;ctx.fillText(`MACD(12,26,9)  ${num(values.macd.line[selected])} / ${num(values.macd.signal[selected])}`,left,top+14);ctx.fillStyle=colors.muted;ctx.fillText('0',right+5,my(0)+3);
   }
   top+=pane.height;
  }
  ctx.fillStyle=colors.muted;const stamp=i=>new Date(candles[i].t).toLocaleString('en-GB',{timeZone:'UTC',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  ctx.fillText(stamp(start),left,h-7);const endLabel=stamp(end-1);ctx.fillText(endLabel,Math.max(left,right-ctx.measureText(endLabel).width),h-7);
  if(cross>=start&&cross<end){ctx.strokeStyle='#8193a5';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x(cross),20);ctx.lineTo(x(cross),h-23);ctx.moveTo(left,y(c.c));ctx.lineTo(right,y(c.c));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=colors.text;ctx.beginPath();ctx.arc(x(cross),y(c.c),3,0,2*Math.PI);ctx.fill();}
  $('chartCandleReadout').textContent=`${new Date(c.t).toISOString().slice(5,16).replace('T',' ')} UTC  O ${num(c.o)}  H ${num(c.h)}  L ${num(c.l)}  C ${num(c.c)}`;
  const indicators=[];if(on('rsi'))indicators.push(`RSI(${prefs.rsiPeriod}) ${num(values.rsi[selected])}`);if(on('macd'))indicators.push(`MACD ${num(values.macd.line[selected])}`);if(on('ma'))indicators.push(`MA ${num(values.ma[selected])}`);if(on('ema'))indicators.push(`EMA ${num(values.ema[selected])}`);if(on('boll'))indicators.push(`BOLL ${num(values.boll.lower[selected])}–${num(values.boll.upper[selected])}`);
  $('chartIndicatorReadout').textContent=indicators.join('  ·  ')||'Indicators hidden';$('chartRangeInfo').textContent=`${rows.length} / ${candles.length} bars${offset?' · history':''}`;
  canvas.dataset.visibleBars=String(rows.length);canvas.dataset.historyOffset=String(offset);canvas.dataset.rsi=finite(values.rsi[selected])?String(values.rsi[selected]):'';
  const age=sourceAt?Math.max(0,Math.floor((Date.now()-sourceAt)/1000)):null;
  dataStatus.textContent=`${meta.network==='testnet'?'Testnet':'Mainnet'} · Hyperliquid ${meta.spot?'Spot':'Perpetual'} candles · ${feed==='live'?'Candle update':'Snapshot'}${age===null?'':` ${age}s ago`}${age>90?' · stale / no recent candle update':''}. Latest candle is provisional.`;
 }
 function zoom(factor){count=Math.max(12,Math.min(Math.max(12,Math.min(candles.length,500)),Math.round(count*factor)));cross=-1;schedule();}
 function pick(e){if(!geometry)return;const px=e.clientX-canvas.getBoundingClientRect().left;cross=Math.max(geometry.start,Math.min(geometry.end-1,geometry.start+Math.floor((px-geometry.left)/geometry.step)));schedule();}
 canvas.addEventListener('pointerdown',e=>{
  if(!geometry)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const p=[...pointers.values()];pinch={distance:Math.abs(p[1].x-p[0].x),count};drag=null;}else{drag={x:e.clientX,y:e.clientY,offset,step:geometry.step};pick(e);}
  canvas.setPointerCapture?.(e.pointerId);
 });
 canvas.addEventListener('pointermove',e=>{
  if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&pointers.size===2){const p=[...pointers.values()],distance=Math.abs(p[1].x-p[0].x);if(distance>15&&pinch.distance>15){count=Math.max(12,Math.min(500,Math.round(pinch.count*pinch.distance/distance)));cross=-1;schedule();}return;}
  if(drag&&pointers.has(e.pointerId)&&Math.abs(e.clientX-drag.x)>7){offset=visibleWindow(candles.length,count,drag.offset+(e.clientX-drag.x)/drag.step).offset;cross=-1;schedule();}else if(e.pointerType==='mouse')pick(e);
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{pointers.delete(e.pointerId);drag=null;pinch=null;});
 canvas.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();zoom(e.deltaY>0?1.2:1/1.2);},{passive:false});
 canvas.addEventListener('keydown',e=>{
  if(['+','=','-','ArrowLeft','ArrowRight','Home','End','Escape'].includes(e.key))e.preventDefault();else return;
  if(e.key==='+'||e.key==='=')zoom(1/1.3);else if(e.key==='-')zoom(1.3);else if(e.key==='End'){offset=0;cross=-1;}else if(e.key==='Home'){offset=Math.max(0,candles.length-count);cross=-1;}else if(e.key==='Escape'){cross=-1;}else{cross=Math.max(0,Math.min(candles.length-1,(cross<0?candles.length-offset-1:cross)+(e.key==='ArrowLeft'?-1:1)));const v=visibleWindow(candles.length,count,offset);if(cross<v.start)offset=candles.length-cross-v.count;else if(cross>=v.end)offset=candles.length-cross-1;}schedule();
 });
 function expand(){
  if(fullscreen)return;returnFocus=document.activeElement;savedY=scrollY;savedPage=document.body.dataset.page;home=document.createComment('chart-dialog-home');panel.before(home);modal.append(panel);fullscreen=true;collapsed=false;content.hidden=false;modal.showModal();sync();schedule();
 }
 function restore(){
  if(!fullscreen)return;fullscreen=false;const target=matchMedia('(max-width:680px)').matches?drawer:$('markets').querySelector('.trade-layout');if(target){if(target===drawer)target.append(panel);else target.prepend(panel);}else if(home?.parentNode)home.after(panel);home?.remove();home=null;sync();requestAnimationFrame(()=>{if(document.body.dataset.page===savedPage)window.scrollTo(0,savedY);if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});schedule();});
 }
 modal.addEventListener('close',restore);modal.addEventListener('cancel',()=>{});
 $('chartExpand').onclick=()=>fullscreen?modal.close():expand();
 $('chartCollapse').onclick=()=>{if(drawer?.contains(panel)&&!drawer.hidden){drawer.open=false;drawer.querySelector(':scope > summary').focus({preventScroll:true});}else{collapsed=!collapsed;content.hidden=collapsed;sync();schedule();}};
 $('chartZoomIn').onclick=()=>zoom(1/1.3);$('chartZoomOut').onclick=()=>zoom(1.3);$('chartLatest').onclick=()=>{offset=0;cross=-1;schedule();};$('chartRetry').onclick=()=>{if(!$('marketRefresh').disabled)$('marketRefresh').click();};
 $('chartSettingsToggle').onclick=()=>{settings.hidden=!settings.hidden;$('chartSettingsToggle').setAttribute('aria-expanded',String(!settings.hidden));schedule();};
 chips.addEventListener('click',e=>{const b=e.target.closest('[data-chart-indicator]');if(!b)return;prefs[b.dataset.chartIndicator]=!prefs[b.dataset.chartIndicator];prefs.muted=false;save();schedule();});
 $('chartMuteIndicators').onclick=()=>{prefs.muted=!prefs.muted;save();schedule();};
 $('chartResetSettings').onclick=()=>{prefs={...CHART_DEFAULTS};save();values=calculateIndicators(candles,prefs);sync();schedule();};
 settings.addEventListener('change',e=>{const key=e.target.dataset.chartPeriod;if(!key)return;const value=Number(e.target.value),valid=key==='bollWidth'?value>=.5&&value<=5:Number.isInteger(value)&&value>=2&&value<=200;if(!valid){$('chartSettingsMessage').textContent=key==='bollWidth'?'Band deviation must be 0.5–5.':'Choose a whole number from 2 to 200.';e.target.setAttribute('aria-invalid','true');return;}prefs[key]=value;e.target.removeAttribute('aria-invalid');$('chartSettingsMessage').textContent='Saved on this device. Indicators are based on the selected candle interval.';save();values=calculateIndicators(candles,prefs);schedule();});
 toolbar.addEventListener('click',e=>{const b=e.target.closest('[data-chart-interval]'),s=$('marketInterval');if(!b||b.disabled||s.disabled||s.value===b.dataset.chartInterval)return;s.value=b.dataset.chartInterval;s.dispatchEvent(new Event('change',{bubbles:true}));sync();});
 new ResizeObserver(schedule).observe(canvas);new ResizeObserver(schedule).observe(panel);
 new MutationObserver(ms=>{if(!ms.some(m=>[...m.addedNodes,...m.removedNodes].includes(panel)))return;if(fullscreen&&!modal.contains(panel))modal.append(panel);schedule();}).observe($('markets'),{childList:true,subtree:true});
 window.addEventListener('beltrix:chart-open',e=>{if(e.detail?.expanded){expand();return;}if(drawer&&!drawer.hidden)drawer.open=true;collapsed=false;content.hidden=false;schedule();});
 window.addEventListener('beltrix:page',()=>{if(fullscreen)modal.close();schedule();});document.addEventListener('visibilitychange',schedule);window.addEventListener('resize',schedule);
 window.addEventListener('beltrix:market',sync);
 return {
  update(rows,next={}){
   const key=[next.network,next.coin,next.interval].join(':');if(key!==marketKey){count=60;offset=0;cross=-1;marketKey=key;}else if(offset>0&&rows.length>candles.length)offset+=rows.length-candles.length;
   candles=rows;meta=next;sourceAt=next.received||0;feed=next.feed||'snapshot';values=calculateIndicators(candles,prefs);
   $('chartPairLabel').textContent=next.label||'Chart';$('chartProductLabel').textContent=`${next.spot?'Spot':'Perpetual'} · ${next.interval||$('marketInterval').value} · ${next.network||'Connecting'}`;
   if($('chartDrawerTitle'))$('chartDrawerTitle').textContent=(next.label||'Market')+' chart';schedule();
  },
  resize:schedule
 };
}
