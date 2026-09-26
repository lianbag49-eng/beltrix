import {fundingView,finite} from './terminal-core.js';
import {createMarketChart} from './chart-ui.js';
import './terminal-clean.js';
import {validCandle,normalizeCandles} from './chart-core.js';
import {hyperliquidNetwork} from './hyperliquid-venue.js';
import {loadVenueMarkets,loadVenueCandles,marketSnapshot,venueNetworks,venueIsTradable} from './market-venue-service.js';
const $=id=>document.getElementById(id);
const intervals={'1m':60000,'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000};
let generation=0,controller,socket,retry,heartbeat,lastUpdate=0,candles=[],book=null,trades=[],lastTradeTime=0,streamReceived=0,dirty=false;
let marketMeta=[],assetContext=null,contextReceived=0,contextTimer,candleFeed='snapshot',activeVenue='hyperliquid';
function endpoint(){return hyperliquidNetwork($('marketNetwork').value).http}
function selection(){return marketMeta.find(x=>x.value===$('marketSymbol').value)}
function emit(){window.dispatchEvent(new CustomEvent('beltrix:market',{detail:{venue:activeVenue,tradable:venueIsTradable(activeVenue),network:$('marketNetwork').value,market:selection(),book,received:streamReceived,context:assetContext,contextReceived}}))}
function paintBook(){
 for(const [id,levels] of [['marketBids',book?.levels?.[0]],['marketAsks',book?.levels?.[1]]]){
  const box=$(id);box.replaceChildren();let total=0;const rows=(levels||[]).slice(0,$('bookDepth').value==='fast'?5:20).map(x=>({...x,total:total+=Number(x.sz)}));
  if(id==='marketAsks')rows.reverse();for(const level of rows){const row=document.createElement('button');row.type='button';row.className='book-level';row.style.setProperty('--depth-color',id==='marketBids'?'#53d6a01a':'#ff82901a');row.style.setProperty('--depth-width',`${total?level.total/total*100:0}%`);
   for(const value of [level.px,level.sz,level.total.toLocaleString('en-US',{maximumFractionDigits:6})]){const span=document.createElement('span');span.textContent=value;row.append(span)}
   row.setAttribute('aria-label','Use limit price '+level.px);row.onclick=()=>window.dispatchEvent(new CustomEvent('beltrix:book-price',{detail:{price:level.px,coin:selection()?.value,network:$('marketNetwork').value}}));box.append(row);
  }
 }
 const bid=Number(book?.levels?.[0]?.[0]?.px),ask=Number(book?.levels?.[1]?.[0]?.px);$('marketSpread').textContent=bid>0&&ask>=bid?`Spread ${(ask-bid).toPrecision(4)} · ${((ask-bid)/((ask+bid)/2)*100).toFixed(3)}%`:'Spread —';
 const box=$('marketTrades');box.replaceChildren();for(const t of trades.slice(-10).reverse()){const row=document.createElement('div');row.className='row space pair '+(t.side==='B'?'green':'red');row.textContent=`${new Date(t.time).toLocaleTimeString('en-US')}  ${t.side==='B'?'Buy':'Sell'}  ${t.px} · ${t.sz}`;box.append(row)}
}
function setVenueUi(){
 activeVenue=$('marketVenue')?.value||'hyperliquid';
 const select=$('marketNetwork'),previous=select.value;
 select.replaceChildren();
 for(const item of venueNetworks(activeVenue))select.add(new Option(item.label,item.id));
 if([...select.options].some(o=>o.value===previous))select.value=previous;
 const hyper=activeVenue==='hyperliquid';
 $('marketType').disabled=!hyper;
 if(!hyper)$('marketType').value='perp';
 $('bookDepth').disabled=!hyper;
 const note=$('marketVenueNote');
 const labels={hyperliquid:'Hyperliquid · live market data and funded trading.',orderly:'Orderly · read-only market catalog POC. Funded orders stay disabled.',gmx:'GMX · read-only market catalog POC. Funded orders stay disabled.',paradex:'Paradex · read-only market catalog POC. Funded orders stay disabled.'};
 if(note)note.textContent=labels[activeVenue]||activeVenue;
 const link=$('marketSourceLink');
 const sources={
  hyperliquid:['https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api','Market data by Hyperliquid'],
  orderly:['https://orderly.network/docs/build-on-omnichain/evm-api/restful-api/public','Market data by Orderly'],
  gmx:['https://docs.gmx.io/docs/api/overview/','Market data by GMX'],
  paradex:['https://docs.paradex.trade/api/prod/markets/get-markets','Market data by Paradex']
 };
 if(link&&sources[activeVenue]){link.href=sources[activeVenue][0];link.textContent=sources[activeVenue][1]}
 const services=$('terminalVenueServices');if(services)services.hidden=!hyper;
}

function legacyMarket(m){
 return {
  value:m.symbol,
  label:(m.base||m.symbol)+' / '+(m.quote||'USDC')+(m.marketType==='perp'?' PERP':''),
  asset:m.nativeId,
  szDecimals:m.raw?.szDecimals,
  spot:m.marketType==='spot',
  maxLeverage:m.maxLeverage,
  onlyIsolated:m.raw?.onlyIsolated,
  delisted:m.raw?.isDelisted,
  raw:m.raw,
  normalized:m
 };
}

function snapshotContext(market){
 const s=marketSnapshot(market?.normalized||{raw:market?.raw});
 return {
  markPx:s.mark,
  oraclePx:s.oracle,
  dayNtlVlm:s.volume24h,
  openInterest:s.openInterest,
  funding:s.funding
 };
}

async function selectReadOnlyMarket(){
 const token=++generation;cleanup();controller=new AbortController();candles=[];candleFeed='snapshot';book=null;trades=[];streamReceived=0;lastTradeTime=0;lastUpdate=0;
 const selected=selection();assetContext=snapshotContext(selected);contextReceived=Date.now();paintContext();emit();paintBook();
 $('marketPrice').textContent='—';$('marketOHLC').textContent='';draw();
 if(!selected){status(marketVenueLabel()+' · No market selected');return}
 status(marketVenueLabel()+' · Loading candles');
 const load=async()=>{
  const rows=await loadVenueCandles({
   venueId:activeVenue,
   network:$('marketNetwork').value,
   market:selected.normalized,
   interval:$('marketInterval').value,
   limit:600,
   signal:controller?.signal
  });
  if(token!==generation)return;
  candles=normalizeCandles(rows);
  lastUpdate=Date.now();
  candleFeed='polling';
  draw();
  const last=candles.at(-1);
  if(last){
   assetContext={...(assetContext||{}),markPx:last.c,oraclePx:assetContext?.oraclePx??last.c};
   contextReceived=Date.now();
   paintContext();emit();
  }
  status(candles.length?marketVenueLabel()+' · Read-only OHLCV · '+candles.length+' candles':marketVenueLabel()+' · No candle data returned');
 };
 try{
  await load();
  contextTimer=setInterval(()=>{
   if(document.hidden||token!==generation)return;
   load().catch(()=>status(marketVenueLabel()+' · Candle refresh failed'));
  },30000);
 }catch(e){
  if(token===generation)status(marketVenueLabel()+' chart failed · '+String(e?.message||'Refresh to retry').slice(0,120));
 }
}

function marketVenueLabel(){return ({hyperliquid:'Hyperliquid',orderly:'Orderly',gmx:'GMX',paradex:'Paradex'})[activeVenue]||activeVenue}

function paintContext(){
 const spot=selection()?.spot,ctx=assetContext,stale=!contextReceived||Date.now()-contextReceived>90000;
 const display=(id,v,suffix='')=>{$(id).textContent=!stale&&finite(v)?Number(v).toLocaleString('en-US',{maximumFractionDigits:8})+suffix:'—'};
 display('marketMark',ctx?.markPx);display('marketOracle',ctx?.oraclePx);display('marketVolume',ctx?.dayNtlVlm,' USDC');display('marketOI',ctx?.openInterest,selection()?' '+selection().value:'');
 const change=!stale&&Number(ctx?.prevDayPx)>0?(Number(ctx.markPx)/Number(ctx.prevDayPx)-1)*100:null;$('marketChange').textContent=finite(change)?`${change>=0?'+':''}${change.toFixed(2)}%`:'—';$('marketChange').className=finite(change)?change>=0?'green':'red':'';
 $('marketFundingCard').hidden=!!spot;$('marketFundingTime').hidden=!!spot;
 const f=fundingView(stale?null:ctx?.funding);$('marketFunding').textContent=f.label;$('marketFundingDirection').textContent=f.direction;$('marketFundingCountdown').textContent=f.countdown;$('marketFundingAt').textContent=new Date(f.next).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
 $('marketContextStatus').textContent=stale?'Market statistics unavailable or stale. Funding is not assumed to be zero.':`${spot?'Spot market · No funding or leverage':'Perpetual funding settles hourly · Current rate is indicative'} · Statistics updated ${Math.floor((Date.now()-contextReceived)/1000)}s ago`;
}
async function refreshContext(token,coin){
 try{const rows=await info({type:selection()?.spot?'spotMetaAndAssetCtxs':'metaAndAssetCtxs'},AbortSignal.timeout(10000));if(token!==generation||coin!==selection()?.value)return;
 const i=rows?.[0]?.universe?.findIndex(x=>x.name===coin);if(i>=0&&rows[1]?.[i]&&finite(rows[1][i].markPx)){assetContext=rows[1][i];contextReceived=Date.now();paintContext();emit()}
 }catch{if(token===generation)paintContext()}
}
const canvas=$('marketCanvas'),chart=createMarketChart(canvas);
function status(text){$('marketStatus').textContent=text;}
async function info(body,signal){const r=await fetch(endpoint()+'/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
const normalize=validCandle;
function draw(){
 const selected=selection();
 chart.update(candles,{network:$('marketNetwork').value,coin:selected?.value,label:selected?.label,base:selected?.label.split('/')[0].trim(),spot:!!selected?.spot,interval:$('marketInterval').value,received:lastUpdate,feed:candleFeed});
 const c=candles.at(-1);if(c){if(!lastTradeTime)$('marketPrice').textContent=c.c.toLocaleString(undefined,{maximumFractionDigits:8});$('marketOHLC').textContent=`O ${c.o}  H ${c.h}  L ${c.l}  C ${c.c}  V ${c.v}`;}
}
function cleanup(){clearTimeout(retry);clearInterval(heartbeat);clearInterval(contextTimer);controller?.abort();if(socket){socket.onclose=null;socket.close();socket=null}}
async function selectMarket(){
 if(activeVenue!=='hyperliquid'){await selectReadOnlyMarket();return}
 const token=++generation;cleanup();controller=new AbortController();candles=[];candleFeed='snapshot';book=null;assetContext=null;contextReceived=0;paintContext();trades=[];lastTradeTime=0;streamReceived=0;emit();paintBook();lastUpdate=0;$('marketPrice').textContent='—';$('marketOHLC').textContent='';draw();status('Connecting');
 const coin=$('marketSymbol').value,interval=$('marketInterval').value;if(!coin){status('No markets available');return}
 refreshContext(token,coin);contextTimer=setInterval(()=>{if(!document.hidden)refreshContext(token,coin)},30000);
 const ownController=controller;const timeout=setTimeout(()=>ownController.abort(),15000);
 try{
 const endTime=Date.now();const rows=await info({type:'candleSnapshot',req:{coin,interval,startTime:endTime-intervals[interval]*600,endTime}},controller.signal);
 if(token!==generation)return;
 candles=normalizeCandles(rows);lastUpdate=Date.now();draw();status(candles.length?'Snapshot received · Connecting live feed':'No candles for this market');
 socket=new WebSocket(hyperliquidNetwork($('marketNetwork').value).ws);
 socket.onopen=()=>{if(token!==generation)return;for(const subscription of [{type:'candle',coin,interval},{type:'l2Book',coin,fast:$('bookDepth').value==='fast'},{type:'trades',coin},{type:'activeAssetCtx',coin}])socket.send(JSON.stringify({method:'subscribe',subscription}));heartbeat=setInterval(()=>{if(socket?.readyState===1)socket.send(JSON.stringify({method:'ping'}))},25000)};
 socket.onmessage=e=>{if(token!==generation)return;try{
 const msg=JSON.parse(e.data);
 if(['activeAssetCtx','activeSpotAssetCtx'].includes(msg.channel)&&msg.data?.coin===coin&&finite(msg.data.ctx?.markPx)){assetContext=msg.data.ctx;contextReceived=Date.now();paintContext();emit();}
 if(msg.channel==='l2Book'&&msg.data.coin===coin){const b=msg.data;if(!Array.isArray(b.levels)||b.levels.length!==2||!Number.isFinite(b.time)||Math.abs(Date.now()-b.time)>30000)return;if(!b.levels.every(xs=>Array.isArray(xs)&&xs.every(x=>Number(x.px)>0&&Number(x.sz)>=0)))return;if(b.levels[0].some((x,i,a)=>i&&Number(x.px)>Number(a[i-1].px))||b.levels[1].some((x,i,a)=>i&&Number(x.px)<Number(a[i-1].px)))return;if(b.levels[0][0]&&b.levels[1][0]&&Number(b.levels[0][0].px)>=Number(b.levels[1][0].px))return;if(book&&b.time<book.time)return;book=b;streamReceived=Date.now();dirty=true;emit();}
 if(msg.channel==='trades'&&Array.isArray(msg.data)){for(const t of msg.data){if(t.coin!==coin||!Number.isFinite(t.time)||!Number.isFinite(Number(t.px))||Number(t.px)<=0||Number(t.sz)<0||t.time>Date.now()+5000)continue;if(trades.some(x=>x.tid===t.tid&&x.time===t.time))continue;trades.push(t);}trades.sort((a,b)=>a.time-b.time);trades=trades.slice(-100);dirty=true;}
 if(msg.channel==='candle'){for(const raw of (Array.isArray(msg.data)?msg.data:[msg.data])){if(raw.s!==coin||raw.i!==interval)continue;const c=normalize(raw);if(!c)continue;const i=candles.findIndex(x=>x.t===c.t);if(i>=0)candles[i]=c;else candles.push(c);candles.sort((a,b)=>a.t-b.t);candles=candles.slice(-1000);lastUpdate=Date.now();candleFeed='live';dirty=true;}}
 }catch{status('Invalid market data')}};
 socket.onclose=()=>{if(token!==generation)return;clearInterval(heartbeat);status('Disconnected · Reconnecting in 5s');retry=setTimeout(selectMarket,5000)};
 socket.onerror=()=>status('Live connection error');
 }catch(e){if(token===generation)status('Market request failed · Refresh to retry')}finally{clearTimeout(timeout)}
}
async function loadSymbols(){
 ++generation;cleanup();marketMeta=[];book=null;assetContext=null;contextReceived=0;paintContext();streamReceived=0;trades=[];lastTradeTime=0;lastUpdate=0;candleFeed='snapshot';$('marketPrice').textContent='—';$('marketSymbol').replaceChildren();emit();paintBook();candles=[];draw();status('Loading markets');
 setVenueUi();
 const mode=$('marketType').value,token=generation;const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),15000);
 try{
  const normalized=await loadVenueMarkets({venueId:activeVenue,network:$('marketNetwork').value,marketType:mode,signal:abort.signal});
  if(token!==generation)return;
  marketMeta=normalized.map(legacyMarket);
  for(const row of marketMeta)$('marketSymbol').add(new Option(row.label,row.value));
  const preferred=marketMeta.find(x=>['BTC','ETH','BTC-USD-PERP','ETH-USD-PERP','PERP_BTC_USDC','PERP_ETH_USDC'].includes(x.value))||marketMeta[0];
  if(preferred)$('marketSymbol').value=preferred.value;
  await selectMarket();
 }catch(e){if(token===generation)status(marketVenueLabel()+' market list failed · '+String(e?.message||'Refresh to retry').slice(0,120))}
 finally{clearTimeout(timeout)}
}
$('bookDepth').onchange=selectMarket;$('marketVenue').onchange=()=>{setVenueUi();loadSymbols()};$('marketNetwork').onchange=loadSymbols;$('marketType').onchange=loadSymbols;$('marketSymbol').onchange=selectMarket;$('marketInterval').onchange=selectMarket;$('marketRefresh').onclick=()=> $('marketSymbol').options.length?selectMarket():loadSymbols();
new ResizeObserver(()=>chart.resize()).observe(canvas);
setInterval(()=>{
 if(dirty){draw();paintBook();dirty=false;const t=trades.at(-1);if(t){lastTradeTime=t.time;$('marketPrice').textContent=Number(t.px).toLocaleString(undefined,{maximumFractionDigits:8})}}
 const age=streamReceived?Date.now()-streamReceived:Infinity;
 paintContext();
 $('marketClock').textContent=new Date().toLocaleTimeString("en-US")+' · Refresh: 1s';
 if(age<5000&&socket?.readyState===1)status('Live · '+($('marketNetwork').value==='testnet'?'Testnet':'Mainnet')+' · Order book updated '+(age/1000).toFixed(1)+'s ago');
 else if(streamReceived)status('Stale order book · Orders locked');
 if(streamReceived)emit();
},1000);
window.addEventListener('pagehide',()=>{++generation;cleanup()});window.addEventListener('pageshow',e=>{if(e.persisted)loadSymbols()});setVenueUi();loadSymbols();
