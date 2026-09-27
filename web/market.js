import {fundingView,finite} from './terminal-core.js';
import {createMarketChart} from './chart-ui.js';
import './terminal-clean.js';
import {validCandle,normalizeCandles} from './chart-core.js';
import {hyperliquidNetwork} from './hyperliquid-venue.js';
import {loadHyperliquidMarkets,loadHyperliquidContext,hyperliquidLogoUrl} from './hyperliquid-markets.js';

const $=id=>document.getElementById(id);
const intervals={'1m':60000,'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000};

let generation=0,controller,socket,retry,heartbeat,lastUpdate=0,candles=[],book=null,trades=[],lastTradeTime=0,streamReceived=0,dirty=false;
let marketMeta=[],assetContext=null,contextReceived=0,contextTimer,candleFeed='snapshot';

function endpoint(){return hyperliquidNetwork($('marketNetwork').value).http}
function selection(){return marketMeta.find(x=>x.value===$('marketSymbol').value)}
function emit(){
 window.dispatchEvent(new CustomEvent('beltrix:market',{detail:{
  venue:'hyperliquid',tradable:true,network:$('marketNetwork').value,
  market:selection(),book,received:streamReceived,context:assetContext,contextReceived
 }}));
}

function paintBook(){
 for(const [id,levels] of [['marketBids',book?.levels?.[0]],['marketAsks',book?.levels?.[1]]]){
  const box=$(id);box.replaceChildren();let total=0;
  const rows=(levels||[]).slice(0,$('bookDepth').value==='fast'?5:20).map(x=>({...x,total:total+=Number(x.sz)}));
  if(id==='marketAsks')rows.reverse();
  for(const level of rows){
   const row=document.createElement('button');row.type='button';row.className='book-level';
   row.style.setProperty('--depth-color',id==='marketBids'?'#53d6a01a':'#ff82901a');
   row.style.setProperty('--depth-width',`${total?level.total/total*100:0}%`);
   for(const value of [level.px,level.sz,level.total.toLocaleString('en-US',{maximumFractionDigits:6})]){
    const span=document.createElement('span');span.textContent=value;row.append(span);
   }
   row.setAttribute('aria-label','Use limit price '+level.px);
   row.onclick=()=>window.dispatchEvent(new CustomEvent('beltrix:book-price',{detail:{price:level.px,coin:selection()?.value,network:$('marketNetwork').value}}));
   box.append(row);
  }
 }
 const bid=Number(book?.levels?.[0]?.[0]?.px),ask=Number(book?.levels?.[1]?.[0]?.px);
 $('marketSpread').textContent=bid>0&&ask>=bid?`Spread ${(ask-bid).toPrecision(4)} · ${((ask-bid)/((ask+bid)/2)*100).toFixed(3)}%`:'Spread —';
 const box=$('marketTrades');box.replaceChildren();
 for(const t of trades.slice(-10).reverse()){
  const row=document.createElement('div');row.className='row space pair '+(t.side==='B'?'green':'red');
  row.textContent=`${new Date(t.time).toLocaleTimeString('en-US')}  ${t.side==='B'?'Buy':'Sell'}  ${t.px} · ${t.sz}`;
  box.append(row);
 }
}

function ensureMarketPicker(){
 const select=$('marketSymbol');
 if($('marketPickerButton'))return;
 const wrap=document.createElement('div');wrap.className='hl-market-picker';
 const button=document.createElement('button');button.type='button';button.id='marketPickerButton';button.className='hl-market-picker-button';
 button.innerHTML='<span class="hl-market-logo-wrap"><img id="marketPickerLogo" alt=""><span id="marketPickerFallback">?</span></span><span class="hl-market-picker-copy"><strong id="marketPickerSymbol">Markets</strong><small id="marketPickerName">Loading Hyperliquid markets…</small></span><span class="hl-market-picker-chevron">⌄</span>';
 const panel=document.createElement('div');panel.id='marketPickerPanel';panel.className='hl-market-picker-panel';panel.hidden=true;
 panel.innerHTML='<div class="hl-market-picker-search"><input id="marketSearch" type="search" placeholder="Search Hyperliquid markets" autocomplete="off"><span id="marketCount"></span></div><div id="marketPickerList" class="hl-market-picker-list"></div>';
 select.before(wrap);wrap.append(button,panel);select.classList.add('hl-native-market-select');
 button.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden){$('marketSearch').focus();renderMarketPicker($('marketSearch').value)}};
 $('marketSearch').addEventListener('input',e=>renderMarketPicker(e.target.value));
 document.addEventListener('click',e=>{if(!wrap.contains(e.target))panel.hidden=true});
}

function logoKey(row){
 const raw=String(row?.displaySymbol||row?.base||row?.value||'');
 return raw.includes(':')?raw.split(':').at(-1):raw;
}
function setLogo(img,fallback,row){
 const symbol=logoKey(row);
 fallback.textContent=(symbol||'?').slice(0,2).toUpperCase();
 img.hidden=false;fallback.hidden=true;img.alt=symbol?symbol+' logo':'';
 img.src=row?.logo||hyperliquidLogoUrl(symbol);
 img.onerror=()=>{img.hidden=true;fallback.hidden=false};
}
function syncMarketPicker(){
 const row=selection();if(!row)return;
 $('marketPickerSymbol').textContent=row.displaySymbol||row.base||row.value;
 $('marketPickerName').textContent=row.spot?`${row.base}/${row.quote} · Spot`:`${row.label}${row.dex?' · HIP-3':''}`;
 setLogo($('marketPickerLogo'),$('marketPickerFallback'),row);
}
function renderMarketPicker(query=''){
 const list=$('marketPickerList');if(!list)return;
 const q=String(query||'').trim().toLowerCase();
 const rows=marketMeta.filter(row=>!q||[row.displaySymbol,row.base,row.quote,row.label,row.dex].some(v=>String(v||'').toLowerCase().includes(q)));
 list.replaceChildren();
 $('marketCount').textContent=`${rows.length} / ${marketMeta.length}`;
 for(const row of rows){
  const button=document.createElement('button');button.type='button';button.className='hl-market-row';
  const logoWrap=document.createElement('span');logoWrap.className='hl-market-row-logo';
  const img=document.createElement('img'),fallback=document.createElement('span');logoWrap.append(img,fallback);setLogo(img,fallback,row);
  const copy=document.createElement('span');copy.className='hl-market-row-copy';
  const title=document.createElement('strong');title.textContent=row.displaySymbol||row.base||row.value;
  const subtitle=document.createElement('small');subtitle.textContent=row.spot?`${row.base}/${row.quote} · Spot`:`${row.quote} Perp${row.dex?' · '+row.dex:''}`;
  copy.append(title,subtitle);
  const badge=document.createElement('span');badge.className='hl-market-row-badge';badge.textContent=row.spot?'SPOT':row.dex?'HIP-3':'PERP';
  button.append(logoWrap,copy,badge);
  if(row.value===$('marketSymbol').value)button.setAttribute('aria-current','true');
  button.onclick=()=>{$('marketSymbol').value=row.value;$('marketPickerPanel').hidden=true;syncMarketPicker();selectMarket()};
  list.append(button);
 }
 if(!rows.length){const empty=document.createElement('p');empty.className='hl-market-empty';empty.textContent='No matching Hyperliquid market.';list.append(empty)}
}

function paintContext(){
 const spot=selection()?.spot,ctx=assetContext,stale=!contextReceived||Date.now()-contextReceived>90000;
 const display=(id,v,suffix='')=>{$(id).textContent=!stale&&finite(v)?Number(v).toLocaleString('en-US',{maximumFractionDigits:8})+suffix:'—'};
 display('marketMark',ctx?.markPx);display('marketOracle',ctx?.oraclePx);display('marketVolume',ctx?.dayNtlVlm,' USDC');display('marketOI',ctx?.openInterest,selection()?' '+(selection().displaySymbol||selection().value):'');
 const change=!stale&&Number(ctx?.prevDayPx)>0?(Number(ctx.markPx)/Number(ctx.prevDayPx)-1)*100:null;
 $('marketChange').textContent=finite(change)?`${change>=0?'+':''}${change.toFixed(2)}%`:'—';$('marketChange').className=finite(change)?change>=0?'green':'red':'';
 $('marketFundingCard').hidden=!!spot;$('marketFundingTime').hidden=!!spot;
 const f=fundingView(stale?null:ctx?.funding);$('marketFunding').textContent=f.label;$('marketFundingDirection').textContent=f.direction;$('marketFundingCountdown').textContent=f.countdown;$('marketFundingAt').textContent=new Date(f.next).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
 $('marketContextStatus').textContent=stale?'Market statistics unavailable or stale. Funding is not assumed to be zero.':`${spot?'Spot market · No funding or leverage':'Perpetual funding settles hourly · Current rate is indicative'} · Statistics updated ${Math.floor((Date.now()-contextReceived)/1000)}s ago`;
}

async function refreshContext(token,coin){
 try{
  const ctx=await loadHyperliquidContext({network:$('marketNetwork').value,market:selection(),signal:AbortSignal.timeout(10000)});
  if(token!==generation||coin!==selection()?.value)return;
  if(ctx&&finite(ctx.markPx)){assetContext=ctx;contextReceived=Date.now();paintContext();emit()}
 }catch{if(token===generation)paintContext()}
}

const canvas=$('marketCanvas'),chart=createMarketChart(canvas);
function status(text){$('marketStatus').textContent=text}
async function info(body,signal){
 const r=await fetch(endpoint()+'/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
 if(!r.ok)throw Error('HTTP '+r.status);return r.json();
}
const normalize=validCandle;
function draw(){
 const selected=selection();
 chart.update(candles,{network:$('marketNetwork').value,coin:selected?.value,label:selected?.label,base:selected?.base||selected?.displaySymbol,spot:!!selected?.spot,interval:$('marketInterval').value,received:lastUpdate,feed:candleFeed});
 const c=candles.at(-1);if(c){if(!lastTradeTime)$('marketPrice').textContent=c.c.toLocaleString(undefined,{maximumFractionDigits:8});$('marketOHLC').textContent=`O ${c.o}  H ${c.h}  L ${c.l}  C ${c.c}  V ${c.v}`}
}
function cleanup(){clearTimeout(retry);clearInterval(heartbeat);clearInterval(contextTimer);controller?.abort();if(socket){socket.onclose=null;socket.close();socket=null}}

async function selectMarket(){
 const token=++generation;cleanup();controller=new AbortController();candles=[];candleFeed='snapshot';book=null;assetContext=null;contextReceived=0;paintContext();trades=[];lastTradeTime=0;streamReceived=0;emit();paintBook();lastUpdate=0;$('marketPrice').textContent='—';$('marketOHLC').textContent='';draw();status('Connecting to Hyperliquid');
 const selected=selection(),coin=selected?.value,interval=$('marketInterval').value;
 if(!coin){status('No Hyperliquid markets available');return}
 syncMarketPicker();renderMarketPicker($('marketSearch')?.value||'');
 refreshContext(token,coin);contextTimer=setInterval(()=>{if(!document.hidden)refreshContext(token,coin)},30000);
 const ownController=controller,timeout=setTimeout(()=>ownController.abort(),15000);
 try{
  const endTime=Date.now();const rows=await info({type:'candleSnapshot',req:{coin,interval,startTime:endTime-intervals[interval]*600,endTime}},controller.signal);
  if(token!==generation)return;
  candles=normalizeCandles(rows);lastUpdate=Date.now();draw();status(candles.length?'Snapshot received · Connecting live feed':'No candles for this Hyperliquid market');
  socket=new WebSocket(hyperliquidNetwork($('marketNetwork').value).ws);
  socket.onopen=()=>{
   if(token!==generation)return;
   for(const subscription of [{type:'candle',coin,interval},{type:'l2Book',coin,fast:$('bookDepth').value==='fast'},{type:'trades',coin},{type:selected.spot?'activeSpotAssetCtx':'activeAssetCtx',coin}])socket.send(JSON.stringify({method:'subscribe',subscription}));
   heartbeat=setInterval(()=>{if(socket?.readyState===1)socket.send(JSON.stringify({method:'ping'}))},25000);
  };
  socket.onmessage=e=>{if(token!==generation)return;try{
   const msg=JSON.parse(e.data);
   if(['activeAssetCtx','activeSpotAssetCtx'].includes(msg.channel)&&msg.data?.coin===coin&&finite(msg.data.ctx?.markPx)){assetContext=msg.data.ctx;contextReceived=Date.now();paintContext();emit()}
   if(msg.channel==='l2Book'&&msg.data.coin===coin){
    const b=msg.data;
    if(!Array.isArray(b.levels)||b.levels.length!==2||!Number.isFinite(b.time)||Math.abs(Date.now()-b.time)>30000)return;
    if(!b.levels.every(xs=>Array.isArray(xs)&&xs.every(x=>Number(x.px)>0&&Number(x.sz)>=0)))return;
    if(b.levels[0].some((x,i,a)=>i&&Number(x.px)>Number(a[i-1].px))||b.levels[1].some((x,i,a)=>i&&Number(x.px)<Number(a[i-1].px)))return;
    if(b.levels[0][0]&&b.levels[1][0]&&Number(b.levels[0][0].px)>=Number(b.levels[1][0].px))return;
    if(book&&b.time<book.time)return;book=b;streamReceived=Date.now();dirty=true;emit();
   }
   if(msg.channel==='trades'&&Array.isArray(msg.data)){
    for(const t of msg.data){if(t.coin!==coin||!Number.isFinite(t.time)||!Number.isFinite(Number(t.px))||Number(t.px)<=0||Number(t.sz)<0||t.time>Date.now()+5000)continue;if(trades.some(x=>x.tid===t.tid&&x.time===t.time))continue;trades.push(t)}
    trades.sort((a,b)=>a.time-b.time);trades=trades.slice(-100);dirty=true;
   }
   if(msg.channel==='candle'){
    for(const raw of (Array.isArray(msg.data)?msg.data:[msg.data])){
     if(raw.s!==coin||raw.i!==interval)continue;const c=normalize(raw);if(!c)continue;
     const i=candles.findIndex(x=>x.t===c.t);if(i>=0)candles[i]=c;else candles.push(c);
     candles.sort((a,b)=>a.t-b.t);candles=candles.slice(-1000);lastUpdate=Date.now();candleFeed='live';dirty=true;
    }
   }
  }catch{status('Invalid Hyperliquid market data')}};
  socket.onclose=()=>{if(token!==generation)return;clearInterval(heartbeat);status('Disconnected · Reconnecting in 5s');retry=setTimeout(selectMarket,5000)};
  socket.onerror=()=>status('Hyperliquid live connection error');
 }catch(e){if(token===generation)status('Hyperliquid market request failed · Refresh to retry')}finally{clearTimeout(timeout)}
}

async function loadSymbols(){
 ++generation;cleanup();marketMeta=[];book=null;assetContext=null;contextReceived=0;paintContext();streamReceived=0;trades=[];lastTradeTime=0;lastUpdate=0;candleFeed='snapshot';$('marketPrice').textContent='—';$('marketSymbol').replaceChildren();emit();paintBook();candles=[];draw();status('Loading Hyperliquid markets');
 const mode=$('marketType').value,token=generation,abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),25000);
 try{
  marketMeta=await loadHyperliquidMarkets({network:$('marketNetwork').value,marketType:mode,signal:abort.signal});
  if(token!==generation)return;
  marketMeta.sort((a,b)=>{
   const rank=x=>['BTC','ETH','SOL','HYPE'].indexOf(String(x.displaySymbol||x.base).toUpperCase());
   const ar=rank(a),br=rank(b);if(ar>=0||br>=0)return (ar<0?99:ar)-(br<0?99:br);
   return String(a.displaySymbol||a.base).localeCompare(String(b.displaySymbol||b.base));
  });
  for(const row of marketMeta)$('marketSymbol').add(new Option(row.label,row.value));
  const preferred=marketMeta.find(x=>String(x.displaySymbol||x.base).toUpperCase()==='BTC')||marketMeta.find(x=>String(x.displaySymbol||x.base).toUpperCase()==='ETH')||marketMeta[0];
  if(preferred)$('marketSymbol').value=preferred.value;
  ensureMarketPicker();renderMarketPicker();syncMarketPicker();
  const note=$('marketVenueNote');if(note)note.textContent=`Hyperliquid · ${marketMeta.length} ${mode==='spot'?'spot':'perpetual'} markets loaded · official asset icons from Hyperliquid.`;
  await selectMarket();
 }catch(e){if(token===generation)status('Hyperliquid market list failed · '+String(e?.message||'Refresh to retry').slice(0,120))}
 finally{clearTimeout(timeout)}
}

$('bookDepth').onchange=selectMarket;
$('marketNetwork').onchange=loadSymbols;
$('marketType').onchange=loadSymbols;
$('marketSymbol').onchange=()=>{syncMarketPicker();selectMarket()};
$('marketInterval').onchange=selectMarket;
$('marketRefresh').onclick=()=> $('marketSymbol').options.length?selectMarket():loadSymbols();

new ResizeObserver(()=>chart.resize()).observe(canvas);
setInterval(()=>{
 if(dirty){draw();paintBook();dirty=false;const t=trades.at(-1);if(t){lastTradeTime=t.time;$('marketPrice').textContent=Number(t.px).toLocaleString(undefined,{maximumFractionDigits:8})}}
 const age=streamReceived?Date.now()-streamReceived:Infinity;paintContext();
 $('marketClock').textContent=new Date().toLocaleTimeString('en-US')+' · Refresh: 1s';
 if(age<5000&&socket?.readyState===1)status('Live · Hyperliquid '+($('marketNetwork').value==='testnet'?'Testnet':'Mainnet')+' · Order book updated '+(age/1000).toFixed(1)+'s ago');
 else if(streamReceived)status('Stale order book · Orders locked');
 if(streamReceived)emit();
},1000);

window.addEventListener('pagehide',()=>{++generation;cleanup()});
window.addEventListener('pageshow',e=>{if(e.persisted)loadSymbols()});
ensureMarketPicker();
loadSymbols();
