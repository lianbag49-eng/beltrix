import {fundingView,finite,markView} from './terminal-core.js';
import {createMarketChart} from './chart-ui.js';
import './terminal-clean.js';
import {validCandle,normalizeCandles} from './chart-core.js';
import {hyperliquidNetwork,normalizeHyperliquidMarkets,normalizeHyperliquidAllPerpMarkets} from './hyperliquid-venue.js';
import {createMarketPicker} from './market-picker.js';
import {hyperliquidDisplaySymbol,hyperliquidLogoUrl} from './asset-logo.js';
const $=id=>document.getElementById(id);
const marketPicker=createMarketPicker($('marketSymbol'));
const intervals={'1m':60000,'3m':180000,'5m':300000,'15m':900000,'30m':1800000,'1h':3600000,'4h':14400000,'1d':86400000,'1w':604800000};
let generation=0,controller,socket,retry,heartbeat,lastUpdate=0,candles=[],book=null,trades=[],lastTradeTime=0,streamReceived=0,dirty=false;
let marketMeta=[],assetContext=null,contextReceived=0,candleFeed='snapshot',catalogSignature='';
let contextSource='',contextStreamAt=0,contextRequestAt=0,contextSubscribeAt=0,contextBusy=false,contextRevision=0,loadedContextKey='';
let socketAt=0,socketReceived=0,reconnectAttempt=0,snapshotBusy=false,snapshotAt=0,candleRevision=0,loadedKey='';
const liveCandleRevisions=new Map();
let pendingTrades=[],lastCandleAt=0;
function endpoint(){return hyperliquidNetwork($('marketNetwork').value).http}
function selection(){return marketMeta.find(x=>x.value===$('marketSymbol').value)}
function contextDetail(){return {network:$('marketNetwork').value,context:assetContext,contextReceived,contextSource,contextStreaming:socket?.readyState===1&&contextStreamAt>0}}
function emit(){window.dispatchEvent(new CustomEvent('beltrix:market',{detail:{...contextDetail(),market:selection(),book,received:streamReceived}}))}
function acceptContext(ctx,source){
 if(!finite(ctx?.markPx)||Number(ctx.markPx)<=0)return false;
 assetContext=ctx;contextReceived=Date.now();contextSource=source;contextRevision++;
 if(source==='live')contextStreamAt=contextReceived;
 paintContext();emit();return true;
}
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
function paintContext(){
 const spot=selection()?.spot,ctx=assetContext,stale=!contextReceived||Date.now()-contextReceived>90000;
 const display=(id,v,suffix='')=>{$(id).textContent=!stale&&finite(v)?Number(v).toLocaleString('en-US',{maximumFractionDigits:8})+suffix:'—'};
 const mark=markView(contextDetail());$('marketMark').textContent=mark.price;$('marketMark').dataset.state=mark.state;$('marketMark').title=mark.label;
 display('marketOracle',ctx?.oraclePx);display('marketVolume',ctx?.dayNtlVlm,' USDC');display('marketOI',ctx?.openInterest,selection()?' '+selection().value:'');
 const change=!stale&&Number(ctx?.prevDayPx)>0?(Number(ctx.markPx)/Number(ctx.prevDayPx)-1)*100:null;$('marketChange').textContent=finite(change)?`${change>=0?'+':''}${change.toFixed(2)}%`:'—';$('marketChange').className=finite(change)?change>=0?'green':'red':'';
 $('marketFundingCard').hidden=!!spot;$('marketFundingTime').hidden=!!spot;
 const f=fundingView(stale?null:ctx?.funding);$('marketFunding').textContent=f.label;$('marketFundingDirection').textContent=f.direction;$('marketFundingCountdown').textContent=f.countdown;$('marketFundingAt').textContent=new Date(f.next).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
 $('marketContextStatus').textContent=stale?'Market statistics unavailable or stale. Funding is not assumed to be zero.':`${spot?'Spot market · No funding or leverage':'Perpetual funding settles hourly · Current rate is indicative'} · Statistics updated ${Math.floor((Date.now()-contextReceived)/1000)}s ago`;
}
async function refreshContext(token,coin){
 if(token!==generation||contextBusy)return;
 contextBusy=true;contextRequestAt=Date.now();const revision=contextRevision;
 try{
  const selected=selection(),body=selected?.spot?{type:'spotMetaAndAssetCtxs'}:{type:'metaAndAssetCtxs',...(selected?.dex?{dex:selected.dex}:{})};
  const rows=await info(body,AbortSignal.any([controller.signal,AbortSignal.timeout(8000)]));if(token!==generation||coin!==selection()?.value||revision!==contextRevision)return;
  const local=selected?.dex&&coin.startsWith(selected.dex+':')?coin.slice(selected.dex.length+1):coin;
  const i=rows?.[0]?.universe?.findIndex(x=>x.name===coin||x.name===local);
  if(i>=0)acceptContext(rows[1]?.[i],'snapshot');
 }catch{if(token===generation)paintContext()}
 finally{if(token===generation)contextBusy=false;}
}
const canvas=$('marketCanvas'),chart=createMarketChart(canvas);
function status(text){$('marketStatus').textContent=text;}
async function info(body,signal){const r=await fetch(endpoint()+'/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
const normalize=validCandle;
function draw(){
 const selected=selection();
 chart.update(candles,{network:$('marketNetwork').value,coin:selected?.value,label:selected?.label,base:selected?.base||selected?.label?.split('/')[0].trim(),logo:selected?.logo||null,spot:!!selected?.spot,interval:$('marketInterval').value,received:lastUpdate,feed:candleFeed});
 const c=candles.at(-1);if(c){if(!lastTradeTime)$('marketPrice').textContent=c.c.toLocaleString(undefined,{maximumFractionDigits:8});$('marketOHLC').textContent=`O ${c.o}  H ${c.h}  L ${c.l}  C ${c.c}  V ${c.v}`;}
}
function applyLatestTrade(){
 const ms=intervals[$('marketInterval').value],now=Date.now();
 // Only actual executions are projected. Keep the venue's volume until the next
 // authoritative candle/backfill, avoiding double-counted trade snapshots.
 for(const trade of pendingTrades.splice(0).sort((a,b)=>a.time-b.time)){
  if(now-trade.time>5000||trade.time>now)continue;
  const t=Math.floor(trade.time/ms)*ms,price=Number(trade.px),last=candles.at(-1);
  if(last&&t<last.t)continue;
  const c=last?.t===t?{...last,c:price,h:Math.max(last.h,price),l:Math.min(last.l,price)}:{t,o:price,h:price,l:price,c:price,v:Number(trade.sz)};
  candles=last?.t===t?[...candles.slice(0,-1),c]:[...candles,c].slice(-1000);
  liveCandleRevisions.set(t,++candleRevision);lastUpdate=now;candleFeed='live';
 }
}
function closeSocket(){clearInterval(heartbeat);if(socket){socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null;socket.close();socket=null;}}
function cleanup(){clearTimeout(retry);retry=null;controller?.abort();closeSocket();}
async function refreshCandles(token,coin,interval){
 if(token!==generation||snapshotBusy)return;
 snapshotBusy=true;snapshotAt=Date.now();const revision=candleRevision;
 try{
 const endTime=Date.now(),startTime=candles.length?Math.max(endTime-intervals[interval]*600,candles.at(-1).t-intervals[interval]*2):endTime-intervals[interval]*600;
 const rows=await info({type:'candleSnapshot',req:{coin,interval,startTime,endTime}},AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]));
 if(token!==generation)return;
 const incoming=normalizeCandles(rows);
 // REST backfill must never overwrite candles received while the request was in flight.
 const newer=candles.filter(c=>(liveCandleRevisions.get(c.t)||0)>revision);
 candles=normalizeCandles([...candles,...incoming,...newer]);
 if(incoming.length){lastUpdate=Date.now();if(!newer.length)candleFeed='snapshot';}
 draw();if(!streamReceived)status(candles.length?'Snapshot received · Connecting live feed':'No candles for this market');
 }catch{if(token===generation)status(candles.length?'Candle refresh failed · Keeping chart · Retrying automatically':'Market request failed · Retrying automatically');}
 finally{if(token===generation)snapshotBusy=false;}
}
function reconnect(token,coin,interval){
 if(token!==generation||retry)return;
 closeSocket();streamReceived=0;emit();
 const delay=Math.min(15000,1000*2**Math.min(reconnectAttempt++,4));
 status(`Disconnected · Reconnecting in ${delay/1000}s · Chart retained`);
 retry=setTimeout(()=>{retry=null;if(token!==generation)return;startLive(token,coin,interval);refreshCandles(token,coin,interval);refreshContext(token,coin);},delay);
}
function startLive(token,coin,interval){
 if(token!==generation)return;
 let live;try{live=new WebSocket(hyperliquidNetwork($('marketNetwork').value).ws);}catch{reconnect(token,coin,interval);return;}
 socket=live;socketAt=socketReceived=Date.now();contextStreamAt=0;
 const current=()=>token===generation&&socket===live;
 live.onopen=()=>{if(!current())return;contextSubscribeAt=Date.now();for(const subscription of [{type:'candle',coin,interval},{type:'l2Book',coin,fast:$('bookDepth').value==='fast'},{type:'trades',coin},{type:'activeAssetCtx',coin}])live.send(JSON.stringify({method:'subscribe',subscription}));heartbeat=setInterval(()=>{if(current()&&live.readyState===1)live.send(JSON.stringify({method:'ping'}))},25000)};
 live.onmessage=e=>{if(!current())return;socketReceived=Date.now();try{
 const msg=JSON.parse(e.data);
 if(['activeAssetCtx','activeSpotAssetCtx'].includes(msg.channel)&&msg.data?.coin===coin)acceptContext(msg.data.ctx,'live');
 if(msg.channel==='l2Book'&&msg.data.coin===coin){const b=msg.data;if(!Array.isArray(b.levels)||b.levels.length!==2||!Number.isFinite(b.time)||Math.abs(Date.now()-b.time)>30000)return;if(!b.levels.every(xs=>Array.isArray(xs)&&xs.every(x=>Number(x.px)>0&&Number(x.sz)>=0)))return;if(b.levels[0].some((x,i,a)=>i&&Number(x.px)>Number(a[i-1].px))||b.levels[1].some((x,i,a)=>i&&Number(x.px)<Number(a[i-1].px)))return;if(b.levels[0][0]&&b.levels[1][0]&&Number(b.levels[0][0].px)>=Number(b.levels[1][0].px))return;if(book&&b.time<book.time)return;book=b;streamReceived=Date.now();reconnectAttempt=0;dirty=true;emit();}
 if(msg.channel==='trades'&&Array.isArray(msg.data)){for(const t of msg.data){if(t.coin!==coin||!Number.isFinite(t.time)||!Number.isFinite(Number(t.px))||Number(t.px)<=0||!Number.isFinite(Number(t.sz))||Number(t.sz)<0||t.time>Date.now()+5000)continue;if(trades.some(x=>x.tid===t.tid&&x.time===t.time))continue;trades.push(t);pendingTrades.push(t);}pendingTrades=pendingTrades.slice(-1000);trades.sort((a,b)=>a.time-b.time);trades=trades.slice(-100);dirty=true;}
 if(msg.channel==='candle'){for(const raw of (Array.isArray(msg.data)?msg.data:[msg.data])){if(raw?.s!==coin||raw.i!==interval)continue;const c=normalize(raw);if(!c||c.t>Date.now()+intervals[interval])continue;candles=normalizeCandles([...candles,c]);liveCandleRevisions.set(c.t,++candleRevision);for(const t of liveCandleRevisions.keys())if(t<candles[0].t)liveCandleRevisions.delete(t);lastCandleAt=lastUpdate=Date.now();candleFeed='live';dirty=true;}}
 }catch{status('Invalid market data')}};
 live.onclose=live.onerror=()=>{if(current())reconnect(token,coin,interval);};
}
async function selectMarket(){
 const token=++generation;cleanup();controller=new AbortController();snapshotBusy=false;snapshotAt=0;reconnectAttempt=0;
 const coin=$('marketSymbol').value,interval=$('marketInterval').value,key=[$('marketNetwork').value,coin,interval].join(':');
 const contextKey=[$('marketNetwork').value,$('marketType').value,coin].join(':');
 if(contextKey!==loadedContextKey){assetContext=null;contextReceived=0;contextSource='';}
 loadedContextKey=contextKey;contextBusy=false;contextRequestAt=contextStreamAt=contextSubscribeAt=0;contextRevision=0;
 const changed=key!==loadedKey;loadedKey=key;
 if(changed){candles=[];candleFeed='snapshot';lastUpdate=0;liveCandleRevisions.clear();candleRevision=0;$('marketPrice').textContent='—';$('marketOHLC').textContent='';}
 book=null;paintContext();trades=[];pendingTrades=[];lastCandleAt=0;lastTradeTime=0;streamReceived=0;dirty=false;emit();paintBook();draw();status('Connecting');
 if(!coin){status('No markets available');return;}
 refreshContext(token,coin);
 // Live updates do not depend on the history endpoint succeeding.
 startLive(token,coin,interval);await refreshCandles(token,coin,interval);
}
function buildMarketRows(payload,mode){
 const normalized=mode==='spot'
  ? normalizeHyperliquidMarkets(payload,'spot')
  : normalizeHyperliquidAllPerpMarkets(payload?.allMetas,payload?.perpDexs);
 return normalized.map(m=>{
  const base=m.base||m.symbol,quote=m.quote||'USDC',displaySymbol=hyperliquidDisplaySymbol(base),dex=m.raw?.dex||'';
  return {
   value:m.symbol,
   label:mode==='spot'?displaySymbol+'/'+quote:displaySymbol+' / '+quote+' PERP',
   base,quote,displaySymbol,
   fullName:m.raw?.baseToken?.fullName||m.raw?.baseToken?.name||displaySymbol,
   logo:hyperliquidLogoUrl(m),
   asset:m.nativeId,
   szDecimals:m.raw?.szDecimals,
   spot:m.marketType==='spot',
   maxLeverage:m.maxLeverage,
   onlyIsolated:m.raw?.onlyIsolated,
   delisted:m.raw?.isDelisted,
   dex,
   dexFullName:m.raw?.dexFullName||'Hyperliquid',
   hip3:!!dex
  };
 });
}
async function fetchCatalog(mode,signal){
 if(mode==='spot')return info({type:'spotMeta'},signal);
 try{
  const [perpDexs,allMetas]=await Promise.all([
   info({type:'perpDexs'},signal),
   info({type:'allPerpMetas'},signal)
  ]);
  if(Array.isArray(perpDexs)&&Array.isArray(allMetas)&&allMetas.length&&perpDexs.length===allMetas.length)return {perpDexs,allMetas};
 }catch(e){if(signal?.aborted)throw e}
 const meta=await info({type:'meta'},signal);
 return {perpDexs:[null],allMetas:[meta]};
}
function catalogKey(rows){return rows.map(x=>x.value+'|'+x.label+'|'+(x.maxLeverage??'')).join(';')}
function applyCatalog(rows,{preserve=true}={}){
 const select=$('marketSymbol'),previous=preserve?select.value:'';
 marketMeta=rows;select.replaceChildren();rows.forEach(r=>select.add(new Option(r.label,r.value)));
 if(previous&&rows.some(x=>x.value===previous))select.value=previous;
 else if($('marketType').value!=='spot'&&rows.some(x=>x.value==='ETH'))select.value='ETH';
 else if($('marketType').value==='spot'&&rows.some(x=>x.displaySymbol==='HYPE'))select.value=rows.find(x=>x.displaySymbol==='HYPE').value;
 else if(rows[0])select.value=rows[0].value;
 catalogSignature=catalogKey(rows);marketPicker.update(rows);
 return !!previous&&previous===select.value;
}
async function refreshCatalog(){
 if(document.hidden)return;
 const mode=$('marketType').value,network=$('marketNetwork').value;
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);
 try{
  const catalog=await fetchCatalog(mode,abort.signal);
  if(network!==$('marketNetwork').value||mode!==$('marketType').value)return;
  const rows=buildMarketRows(catalog,mode),signature=catalogKey(rows);
  if(signature===catalogSignature)return;
  const kept=applyCatalog(rows,{preserve:true});
  if(!kept)await selectMarket();
 }finally{clearTimeout(timeout)}
}
async function loadSymbols(){
 ++generation;cleanup();marketMeta=[];book=null;assetContext=null;contextReceived=0;paintContext();streamReceived=0;trades=[];pendingTrades=[];lastCandleAt=0;lastTradeTime=0;lastUpdate=0;candleFeed='snapshot';$('marketPrice').textContent='—';$('marketSymbol').replaceChildren();emit();paintBook();candles=[];draw();status('Loading markets');
 const mode=$('marketType').value,token=generation;const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),15000);
 try{
  const catalog=await fetchCatalog(mode,abort.signal);if(token!==generation)return;
  applyCatalog(buildMarketRows(catalog,mode),{preserve:false});await selectMarket();
 }catch{if(token===generation)status('Market list failed · Refresh to retry')}finally{clearTimeout(timeout)}
}
$('bookDepth').onchange=selectMarket;$('marketNetwork').onchange=loadSymbols;$('marketType').onchange=loadSymbols;$('marketSymbol').onchange=()=>{marketPicker.sync();selectMarket()};$('marketInterval').onchange=selectMarket;$('marketRefresh').onclick=()=> $('marketSymbol').options.length?selectMarket():loadSymbols();
new ResizeObserver(()=>chart.resize()).observe(canvas);
setInterval(()=>{
 // Keep a one-second real-time chart cadence, independent of order-book events.
 if(!document.hidden){applyLatestTrade();draw();}
 if(dirty){paintBook();dirty=false;const t=trades.at(-1);if(t){lastTradeTime=t.time;$('marketPrice').textContent=Number(t.px).toLocaleString(undefined,{maximumFractionDigits:8})}}
 const age=streamReceived?Date.now()-streamReceived:Infinity;
 paintContext();
 $('marketClock').textContent=new Date().toLocaleTimeString("en-US")+' · Refresh: 1s';
 if(age<5000&&socket?.readyState===1)status('Live · '+($('marketNetwork').value==='testnet'?'Testnet':'Mainnet')+' · Order book updated '+(age/1000).toFixed(1)+'s ago');
 else if(streamReceived)status('Stale order book · Orders locked');
 if(selection())emit();
 if(!document.hidden&&selection()){
  const coin=selection().value,interval=$('marketInterval').value,now=Date.now();
  // Recover a silent Mark channel even while books/trades/pongs remain active.
  // Only one REST request is in flight; healthy live updates require no polling.
  if(now-contextStreamAt>=5000&&now-contextRequestAt>=5000)refreshContext(generation,coin);
  if(socket?.readyState===1&&now-Math.max(contextStreamAt,contextSubscribeAt)>=15000){
   contextSubscribeAt=now;
   try{for(const method of ['unsubscribe','subscribe'])socket.send(JSON.stringify({method,subscription:{type:'activeAssetCtx',coin}}));}
   catch{reconnect(generation,coin,interval);}
  }
  if(socket&&(now-socketReceived>35000||now-(streamReceived||socketAt)>15000))reconnect(generation,coin,interval);
  if(now-lastCandleAt>15000&&now-snapshotAt>15000)refreshCandles(generation,coin,interval);
 }
},1000);
function resumeFeed(){if(document.hidden||!selection())return;const coin=selection().value,interval=$('marketInterval').value;if(!socket||socket.readyState!==1||Date.now()-(streamReceived||socketAt)>5000)reconnect(generation,coin,interval);refreshCandles(generation,coin,interval);refreshContext(generation,coin);}
window.addEventListener('online',resumeFeed);document.addEventListener('visibilitychange',resumeFeed);
window.addEventListener('pagehide',()=>{++generation;cleanup()});window.addEventListener('pageshow',e=>{if(e.persisted)loadSymbols()});setInterval(()=>refreshCatalog().catch(()=>{}),300000);loadSymbols();
